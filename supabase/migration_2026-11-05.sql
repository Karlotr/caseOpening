-- Migracija 5.11.: Trinity → Rulet, Slide → Crash (multiplayer), leveli do 500.
-- Pokreni u Supabase SQL editoru u isto vrijeme kad deployaš novi frontend
-- (stari frontend zove play_slide / play_trinity, koji nakon ovoga više ne postoje).
-- Uključuje i multiplayer Crash (runde kao jackpot).
-- Sigurno za ponovno pokretanje. Isto je već ugrađeno i u schema.sql.

begin;

insert into public.site_limits (key, value, min_value, max_value, label, sort) values
  ('rulet_min_bet', 0.1, 0.1, 1000, 'Rulet najmanji ulog', 7),
  ('rulet_max_bet', 10000, 1, 1000000, 'Rulet najveći ulog', 8),
  ('crash_min_bet', 0.1, 0.1, 1000, 'Crash najmanji ulog', 9),
  ('crash_max_bet', 10000, 1, 1000000, 'Crash najveći ulog', 10)
on conflict (key) do update set min_value = excluded.min_value, max_value = excluded.max_value, label = excluded.label, sort = excluded.sort;

-- ---------- PREIMENOVANJE: Trinity → Rulet, Slide → Crash (jednokratno, sigurno za ponovno pokretanje) ----------
-- zadrži vrijednosti koje je admin već postavio na starim ključevima
update public.site_limits n set value = o.value
  from public.site_limits o
 where (o.key, n.key) in (('trinity_min_bet','rulet_min_bet'), ('trinity_max_bet','rulet_max_bet'),
                          ('slide_min_bet','crash_min_bet'), ('slide_max_bet','crash_max_bet'));
delete from public.site_limits where key in ('trinity_min_bet', 'trinity_max_bet', 'slide_min_bet', 'slide_max_bet');
update public.game_log set game = 'rulet' where game = 'trinity';
update public.game_log set game = 'crash' where game = 'slide';
drop function if exists public.play_trinity(numeric, text);
drop function if exists public.play_slide(numeric, numeric);

-- ---------- RULET (30 polja: 14 crvena x2, 14 crna x2, 2 zlatna x14) ----------
-- polje 0 i 15 = zlatna, ostala neparna = crvena, parna = crna
create or replace function public.play_rulet(p_bet numeric, p_color text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  slot int;
  color text;
  mult numeric;
  payout numeric := 0;
  lvl jsonb;
begin
  if p_color not in ('red','black','gold') then raise exception 'Neispravna boja.'; end if;
  if p_bet < public._limit('rulet_min_bet', 0.1) or p_bet > public._limit('rulet_max_bet', 10000) then
    raise exception 'Ulog mora biti % – %.', public._limit('rulet_min_bet', 0.1), public._limit('rulet_max_bet', 10000);
  end if;
  perform public._charge(uid, p_bet);
  slot := floor(random()::numeric * 30)::int;
  color := case when slot in (0, 15) then 'gold' when slot % 2 = 1 then 'red' else 'black' end;
  mult := case color when 'gold' then 14 else 2 end;
  if color = p_color then
    payout := round(p_bet * mult, 2);
    update public.profiles set balance = balance + payout where id = uid;
  end if;
  lvl := public._apply_wager(uid, p_bet);
  insert into public.game_log (user_id, game, wager, payout, details)
  values (uid, 'rulet', p_bet, payout, jsonb_build_object('pick', p_color, 'slot', slot, 'color', color));
  return jsonb_build_object('slot', slot, 'color', color, 'won', color = p_color, 'payout', payout) || lvl;
end $$;


grant execute on function public.play_rulet(numeric, text) to authenticated;

-- ---------- CRASH (multiplayer runde, kao jackpot; 4% house edge) ----------
-- Runde se vrte jedna za drugom: klađenje (crash_bet_sec) → let → crash → 3 s pauze → nova runda.
-- Multiplikator raste kao m(t) = e^(0.32·t). Crash točka se zna unaprijed na serveru, ali se klijentu
-- otkriva tek kad runda crasha (tablice nemaju RLS politike → čitaju se samo preko crash_state()).
-- Svatko igra protiv kuće: ručni cashout (crash_cashout) ili opcionalni auto cashout.
drop function if exists public.play_crash(numeric, numeric);

create table if not exists public.crash_rounds (
  id bigserial primary key,
  starts_at timestamptz not null,           -- kraj klađenja = početak leta
  crash_point numeric(10,2) not null,
  crash_at timestamptz not null,            -- starts_at + ln(crash_point) / 0.32 s
  settled boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists crash_rounds_starts_idx on public.crash_rounds(starts_at desc);
create table if not exists public.crash_bets (
  id bigserial primary key,
  round_id bigint not null references public.crash_rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  auto_cashout numeric(10,2),               -- null = samo ručno
  cashout numeric(10,2),                    -- multiplikator na kojem je izašao (null = još leti / izgubio)
  payout numeric(14,2) not null default 0,
  cashed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (round_id, user_id)
);
create index if not exists crash_bets_round_idx on public.crash_bets(round_id);
alter table public.crash_rounds enable row level security;
alter table public.crash_bets enable row level security;

insert into public.site_limits (key, value, min_value, max_value, label, sort) values
  ('crash_bet_sec', 8, 4, 30, 'Crash: trajanje klađenja (sekunde)', 11)
on conflict (key) do update set min_value = excluded.min_value, max_value = excluded.max_value, label = excluded.label, sort = excluded.sort;

-- auto cashouti koji su prošli + obračun crashanih rundi
create or replace function public._crash_tick()
returns void language plpgsql security definer set search_path = public as $$
declare
  b record;
  r public.crash_rounds;
  pay numeric;
begin
  perform pg_advisory_xact_lock(7300431);
  for b in
    select cb.id, cb.user_id, cb.amount, cb.auto_cashout, rr.starts_at
      from public.crash_bets cb join public.crash_rounds rr on rr.id = cb.round_id
     where not rr.settled and cb.cashout is null and cb.auto_cashout is not null
       and cb.auto_cashout <= rr.crash_point
       and rr.starts_at + make_interval(secs => ln(cb.auto_cashout) / 0.32) <= now()
  loop
    pay := round(b.amount * b.auto_cashout, 2);
    update public.crash_bets set cashout = b.auto_cashout, payout = pay,
           cashed_at = b.starts_at + make_interval(secs => ln(b.auto_cashout) / 0.32) where id = b.id;
    update public.profiles set balance = balance + pay where id = b.user_id;
  end loop;

  for r in select * from public.crash_rounds where not settled and crash_at <= now() order by starts_at loop
    for b in select * from public.crash_bets where round_id = r.id loop
      perform public._apply_wager(b.user_id, b.amount);
      insert into public.game_log (user_id, game, wager, payout, details)
      values (b.user_id, 'crash', b.amount, b.payout, jsonb_build_object('round', r.id, 'crash', r.crash_point, 'cashout', b.cashout, 'auto', b.auto_cashout));
    end loop;
    update public.crash_rounds set settled = true where id = r.id;
  end loop;
end $$;

-- trenutna runda (klađenje, let ili 3 s prikaza crasha); ako je nema, kreće nova
create or replace function public._crash_current()
returns public.crash_rounds language plpgsql security definer set search_path = public as $$
declare
  r public.crash_rounds;
  sec numeric := greatest(4, public._limit('crash_bet_sec', 8));
  cp numeric;
begin
  select * into r from public.crash_rounds order by starts_at desc limit 1;
  if found and r.crash_at + interval '3 seconds' > now() then return r; end if;
  cp := greatest(1, least(1000, floor(96 / (1 - random()::numeric)) / 100));
  insert into public.crash_rounds (starts_at, crash_point, crash_at)
  values (now() + make_interval(secs => sec), cp, now() + make_interval(secs => sec + ln(cp) / 0.32))
  returning * into r;
  return r;
end $$;

create or replace function public.crash_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r public.crash_rounds;
  ph text;
begin
  perform public._crash_tick();
  r := public._crash_current();
  ph := case when now() < r.starts_at then 'betting' when now() < r.crash_at then 'flying' else 'crashed' end;
  return jsonb_build_object(
    'id', r.id, 'now', now(), 'starts_at', r.starts_at, 'phase', ph, 'k', 0.32,
    'bet_sec', greatest(4, public._limit('crash_bet_sec', 8)),
    'min_bet', public._limit('crash_min_bet', 0.1), 'max_bet', public._limit('crash_max_bet', 10000),
    -- crash točka (i vrijeme crasha) tek nakon crasha
    'crash_point', case when ph = 'crashed' then r.crash_point end,
    'bets', (select coalesce(jsonb_agg(x order by x.amount desc), '[]'::jsonb) from (
        select cb.user_id, p.username, p.level, cb.amount, cb.cashout, cb.payout,
               case when cb.user_id = uid then cb.auto_cashout end as auto_cashout
          from public.crash_bets cb join public.profiles p on p.id = cb.user_id
         where cb.round_id = r.id) x),
    'history', (select coalesce(jsonb_agg(x.crash_point order by x.starts_at desc), '[]'::jsonb) from (
        select crash_point, starts_at from public.crash_rounds
         where settled and id <> r.id order by starts_at desc limit 20) x)
  );
end $$;

create or replace function public.crash_bet(p_amount numeric, p_auto numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  r public.crash_rounds;
  amt numeric := round(coalesce(p_amount, 0), 2);
  auto numeric := case when p_auto is null or p_auto <= 0 then null else round(p_auto, 2) end;
begin
  if amt < public._limit('crash_min_bet', 0.1) or amt > public._limit('crash_max_bet', 10000) then
    raise exception 'Ulog mora biti % – %.', public._limit('crash_min_bet', 0.1), public._limit('crash_max_bet', 10000);
  end if;
  if auto is not null and (auto < 1.01 or auto > 1000) then raise exception 'Auto cashout mora biti 1.01x–1000x.'; end if;
  perform public._crash_tick();
  r := public._crash_current();
  if now() > r.starts_at - interval '300 milliseconds' then raise exception 'Runda je već krenula, pričekaj sljedeću.'; end if;
  if exists (select 1 from public.crash_bets where round_id = r.id and user_id = uid) then raise exception 'Već imaš ulog u ovoj rundi.'; end if;
  perform public._charge(uid, amt);
  insert into public.crash_bets (round_id, user_id, amount, auto_cashout) values (r.id, uid, amt, auto);
  return public.crash_state();
end $$;

-- povuci ulog dok traje klađenje
create or replace function public.crash_withdraw()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  r public.crash_rounds;
  b public.crash_bets;
begin
  perform public._crash_tick();
  r := public._crash_current();
  if now() > r.starts_at - interval '300 milliseconds' then raise exception 'Runda je već krenula.'; end if;
  delete from public.crash_bets where round_id = r.id and user_id = uid returning * into b;
  if not found then raise exception 'Nemaš uloga u ovoj rundi.'; end if;
  update public.profiles set balance = balance + b.amount where id = uid;
  return public.crash_state();
end $$;

-- ručni cashout tijekom leta (po serverskom vremenu)
create or replace function public.crash_cashout()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  r public.crash_rounds;
  b public.crash_bets;
  m numeric;
  pay numeric;
begin
  perform public._crash_tick();
  r := public._crash_current();
  if now() < r.starts_at then raise exception 'Runda još nije krenula.'; end if;
  if now() >= r.crash_at then raise exception 'Prekasno — crash na %×.', r.crash_point; end if;
  select * into b from public.crash_bets where round_id = r.id and user_id = uid for update;
  if not found then raise exception 'Nemaš uloga u ovoj rundi.'; end if;
  if b.cashout is not null then raise exception 'Već si izašao na %×.', b.cashout; end if;
  m := least(r.crash_point, greatest(1, floor(exp(0.32 * extract(epoch from now() - r.starts_at)) * 100) / 100));
  pay := round(b.amount * m, 2);
  update public.crash_bets set cashout = m, payout = pay, cashed_at = now() where id = b.id;
  update public.profiles set balance = balance + pay where id = uid;
  return public.crash_state() || jsonb_build_object('my_cashout', m, 'my_payout', pay);
end $$;

grant execute on function public.crash_state() to anon, authenticated;
grant execute on function public.crash_bet(numeric, numeric) to authenticated;
grant execute on function public.crash_withdraw() to authenticated;
grant execute on function public.crash_cashout() to authenticated;
revoke all on function public._crash_tick() from public, anon, authenticated;
revoke all on function public._crash_current() from public, anon, authenticated;

-- ---------- LEVELI DO 500 (teži nakon 100) ----------
-- XP za level L: do 100 → 25·(L−1)²; nakon 100 svaki level je 3× skuplji → 245.025 + 75·((L−1)² − 99²); max 500
create or replace function public.xp_for_level(p_level int)
returns numeric language sql immutable as $$
  select (case when p_level <= 100 then 25 * (greatest(p_level, 1) - 1) ^ 2
               else 245025 + 75 * ((least(p_level, 500) - 1) ^ 2 - 9801) end)::numeric;
$$;
create or replace function public.level_for_xp(p_xp numeric)
returns int language sql immutable as $$
  select case when greatest(p_xp, 0) < 245025 then floor(sqrt(greatest(p_xp, 0) / 25))::int + 1
              else least(500, floor(sqrt((p_xp - 245025) / 75 + 9801))::int + 1) end;
$$;

create or replace function public.admin_set_level(p_user uuid, p_level int)
returns void language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin();
begin
  if p_level < 1 or p_level > 500 then raise exception 'Level mora biti 1–500.'; end if;
  update public.profiles set level = p_level, xp = public.xp_for_level(p_level) where id = p_user;
  perform public._admin_log(a, p_user, 'level', jsonb_build_object('level', p_level));
end $$;

commit;
