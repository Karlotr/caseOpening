-- Migracija 5.11.: Trinity → Rulet, Slide → Crash (multiplayer), leveli do 500, nove kutije (50/50, 30/70, high-end), Crossroad.
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

-- ===== NOVE KUTIJE (5.11.): 50/50, 30/70 i high-end =====
-- sort 100+ da dođu iza postojećih; cijene i šanse: EV ≈ 92% cijene
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('50-50-ulica', '50/50 Ulica', 'Golf II ili GTI Mk1. Bacanje novčića.', 'normal', 10, null, 0, null, '#38bdf8', 100) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='50-50-ulica');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (14, 527273), (55, 472727)) as v(item_id, w) where c.slug='50-50-ulica';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('30-70-yu', '30/70 Yu', '70% Stojadin, 30% Mini Cooper.', 'normal', 6.8, null, 0, null, '#ef4444', 101) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='30-70-yu');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (3, 699048), (83, 300952)) as v(item_id, w) where c.slug='30-70-yu';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('kamikaza', 'Kamikaza', 'Najčešće Panda. Ponekad Supra.', 'normal', 5, null, 0, null, '#f43f5e', 102) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='kamikaza');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (16, 157033), (1, 146185), (6, 137599), (20, 137599), (5, 130571), (18, 130571), (14, 69409), (55, 41308), (27, 31466), (32, 18258)) as v(item_id, w) where c.slug='kamikaza';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('50-50-jdm', '50/50 JDM', 'Silvia ili Supra — ništa između.', 'normal', 80, null, 0, null, '#e11d48', 103) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='50-50-jdm');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (27, 515556), (32, 484444)) as v(item_id, w) where c.slug='50-50-jdm';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('zeleni-pakao', 'Zeleni pakao', 'Nürburgring legende: od E46 do Carrere GT.', 'normal', 200, null, 0, null, '#16a34a', 104) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='zeleni-pakao');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (70, 246219), (57, 182940), (58, 119531), (33, 106665), (59, 106665), (35, 81295), (60, 66182), (72, 57528), (64, 20603), (66, 12373)) as v(item_id, w) where c.slug='zeleni-pakao';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('30-70-muscle', '30/70 Muscle', '70% Charger R/T, 30% Shelby Cobra 427.', 'normal', 1090, null, 0, null, '#3b82f6', 105) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='30-70-muscle');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (42, 700772), (46, 299228)) as v(item_id, w) where c.slug='30-70-muscle';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('mega-50-50', 'Mega 50/50', 'Testarossa ili F40. Pola-pola.', 'normal', 1450, null, 0, null, '#dc2626', 106) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='mega-50-50');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (73, 494857), (76, 505143)) as v(item_id, w) where c.slug='mega-50-50';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('30-70-talijan', '30/70 Talijan', '70% Huracán STO, 30% LaFerrari.', 'normal', 1550, null, 0, null, '#b91c1c', 107) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='30-70-talijan');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (72, 701362), (79, 298638)) as v(item_id, w) where c.slug='30-70-talijan';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('jedan-posto', '1% klub', '99% Fiat Panda. 1% Uhlenhaut od 100.000.', 'normal', 1100, null, 0, null, '#a855f7', 108) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='jedan-posto');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (16, 989885), (101, 10115)) as v(item_id, w) where c.slug='jedan-posto';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('elitni-salon', 'Elitni salon', 'Ništa ispod Lexusa LFA.', 'normal', 2500, null, 0, null, '#f59e0b', 109) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='elitni-salon');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (37, 115408), (96, 115408), (64, 92581), (65, 84144), (88, 71039), (45, 65856), (75, 50798), (66, 48015), (76, 43244), (77, 33182), (46, 30760), (89, 30760), (78, 28656), (67, 25970), (97, 23727), (79, 22427), (98, 21257), (68, 19706), (90, 15808), (80, 14368), (99, 12130), (100, 11245), (47, 10476), (81, 9205), (91, 3830)) as v(item_id, w) where c.slug='elitni-salon';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('ultra-50-50', 'Ultra 50/50', 'Carrera GT ili Jesko Absolut.', 'normal', 5150, null, 0, null, '#fb923c', 110) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='ultra-50-50');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (66, 502182), (100, 497818)) as v(item_id, w) where c.slug='ultra-50-50';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('1-u-10', '1 u 10', '90% Lexus LFA, 10% Ferrari 250 GTO.', 'normal', 6300, null, 0, null, '#facc15', 111) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='1-u-10');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (37, 900285), (82, 99715)) as v(item_id, w) where c.slug='1-u-10';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('milijunaski-klub', 'Milijunaški klub', 'Samo hypercari i muzejski primjerci.', 'normal', 7500, null, 0, null, '#eab308', 112) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='milijunaski-klub');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (66, 75080), (76, 72049), (77, 64913), (46, 63005), (89, 63005), (78, 61271), (67, 58942), (97, 56883), (79, 55635), (98, 54473), (68, 52872), (90, 48477), (80, 46687), (99, 43676), (100, 42393), (47, 41226), (81, 39179), (91, 27738), (82, 18664), (101, 13830)) as v(item_id, w) where c.slug='milijunaski-klub';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('hyper-50-50', 'Hyper 50/50', 'Chiron ili McLaren F1.', 'normal', 14650, null, 0, null, '#f97316', 113) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='hyper-50-50');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (99, 501692), (91, 498308)) as v(item_id, w) where c.slug='hyper-50-50';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('kraljevska-garaza', 'Kraljevska garaža', 'Ulaz od 20.000. Unutra Uhlenhaut i rekordni E30.', 'normal', 20000, null, 0, null, '#c084fc', 114) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='kraljevska-garaza');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (90, 152469), (80, 145950), (99, 135077), (100, 130476), (47, 126315), (81, 119060), (91, 79725), (82, 50320), (101, 35526), (102, 25082)) as v(item_id, w) where c.slug='kraljevska-garaza';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('mythic-50-50', 'Mythic 50/50', 'McLaren F1 ili Ferrari 250 GTO.', 'normal', 38000, null, 0, null, '#fde047', 115) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='mythic-50-50');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (91, 501333), (82, 498667)) as v(item_id, w) where c.slug='mythic-50-50';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('muzej', 'Muzej', 'Četiri najskuplja auta na svijetu, i ništa drugo.', 'normal', 60000, null, 0, null, '#fef3c7', 116) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='muzej');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (81, 309840), (91, 242028), (82, 182294), (101, 147114), (102, 118724)) as v(item_id, w) where c.slug='muzej';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('rekord-ili-nista', 'Rekord ili ništa', '50% Uhlenhaut od 100.000, 50% rekordni E30 od 200.000.', 'normal', 163000, null, 0, null, '#ffffff', 117) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='rekord-ili-nista');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (101, 500400), (102, 499600)) as v(item_id, w) where c.slug='rekord-ili-nista';

-- ---------- CROSSROAD (prijeđi autocestu traku po traku; 4% house edge) ----------
-- Svaki korak: preživiš s vjerojatnošću p (ovisno o težini). Multiplikator na traci n = 0.96 / p^n.
-- Izlaziš kad hoćeš (cashout); na zadnjoj traci isplata ide sama. Ishod svakog koraka bira server u trenutku koraka.
create table if not exists public.crossroad_games (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  bet numeric(14,2) not null check (bet > 0),
  difficulty text not null check (difficulty in ('easy','medium','hard','hardcore')),
  lane int not null default 0,
  status text not null default 'active' check (status in ('active','cashed','crashed')),
  payout numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index if not exists crossroad_one_active on public.crossroad_games(user_id) where status = 'active';
create index if not exists crossroad_user_idx on public.crossroad_games(user_id, created_at desc);
alter table public.crossroad_games enable row level security;

insert into public.site_limits (key, value, min_value, max_value, label, sort) values
  ('crossroad_min_bet', 0.1, 0.1, 1000, 'Crossroad najmanji ulog', 12),
  ('crossroad_max_bet', 10000, 1, 1000000, 'Crossroad najveći ulog', 13)
on conflict (key) do update set min_value = excluded.min_value, max_value = excluded.max_value, label = excluded.label, sort = excluded.sort;

-- p = šansa da prođeš traku, lanes = broj traka do kraja
create or replace function public._crossroad_cfg(p_diff text)
returns jsonb language sql immutable as $$
  select case p_diff
    when 'easy' then '{"p": 0.90, "lanes": 24}'::jsonb
    when 'medium' then '{"p": 0.80, "lanes": 20}'::jsonb
    when 'hard' then '{"p": 0.65, "lanes": 15}'::jsonb
    else '{"p": 0.45, "lanes": 10}'::jsonb end;
$$;
create or replace function public._crossroad_mult(p_diff text, p_lane int)
returns numeric language sql immutable as $$
  select case when p_lane <= 0 then 1
              else floor(0.96 / power(((public._crossroad_cfg(p_diff))->>'p')::numeric, p_lane) * 100) / 100 end;
$$;

create or replace function public._crossroad_json(g public.crossroad_games)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when g.id is null then null else jsonb_build_object(
    'id', g.id, 'bet', g.bet, 'difficulty', g.difficulty, 'lane', g.lane, 'status', g.status, 'payout', g.payout,
    'lanes', ((public._crossroad_cfg(g.difficulty))->>'lanes')::int,
    'mult', public._crossroad_mult(g.difficulty, g.lane),
    'next_mult', public._crossroad_mult(g.difficulty, g.lane + 1)) end;
$$;

create or replace function public.crossroad_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g public.crossroad_games;
begin
  select * into g from public.crossroad_games where user_id = uid and status = 'active' limit 1;
  return jsonb_build_object(
    'game', public._crossroad_json(g),
    'min_bet', public._limit('crossroad_min_bet', 0.1), 'max_bet', public._limit('crossroad_max_bet', 10000),
    'tables', (select jsonb_object_agg(d, jsonb_build_object('p', (public._crossroad_cfg(d))->>'p', 'lanes', ((public._crossroad_cfg(d))->>'lanes')::int,
                 'mults', (select jsonb_agg(public._crossroad_mult(d, n) order by n) from generate_series(1, ((public._crossroad_cfg(d))->>'lanes')::int) n)))
                 from unnest(array['easy','medium','hard','hardcore']) d),
    'history', (select coalesce(jsonb_agg(x order by x.ended_at desc), '[]'::jsonb) from (
        select difficulty, lane, status, bet, payout, ended_at from public.crossroad_games
         where user_id = uid and status <> 'active' order by ended_at desc limit 12) x)
  );
end $$;

create or replace function public.crossroad_start(p_bet numeric, p_difficulty text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  amt numeric := round(coalesce(p_bet, 0), 2);
begin
  if p_difficulty not in ('easy','medium','hard','hardcore') then raise exception 'Neispravna težina.'; end if;
  if amt < public._limit('crossroad_min_bet', 0.1) or amt > public._limit('crossroad_max_bet', 10000) then
    raise exception 'Ulog mora biti % – %.', public._limit('crossroad_min_bet', 0.1), public._limit('crossroad_max_bet', 10000);
  end if;
  if exists (select 1 from public.crossroad_games where user_id = uid and status = 'active') then raise exception 'Već imaš igru u tijeku.'; end if;
  perform public._charge(uid, amt);
  insert into public.crossroad_games (user_id, bet, difficulty) values (uid, amt, p_difficulty);
  return public.crossroad_state();
end $$;

create or replace function public._crossroad_end(g public.crossroad_games, p_status text, p_payout numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare lvl jsonb;
begin
  update public.crossroad_games set status = p_status, payout = p_payout, ended_at = now() where id = g.id;
  if p_payout > 0 then update public.profiles set balance = balance + p_payout where id = g.user_id; end if;
  lvl := public._apply_wager(g.user_id, g.bet);
  insert into public.game_log (user_id, game, wager, payout, details)
  values (g.user_id, 'crossroad', g.bet, p_payout, jsonb_build_object('difficulty', g.difficulty, 'lane', g.lane, 'status', p_status));
  return lvl;
end $$;

-- jedan korak naprijed
create or replace function public.crossroad_step()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  g public.crossroad_games;
  cfg jsonb;
  lvl jsonb := '{}'::jsonb;
  ok boolean;
begin
  select * into g from public.crossroad_games where user_id = uid and status = 'active' for update;
  if not found then raise exception 'Nemaš igru u tijeku.'; end if;
  cfg := public._crossroad_cfg(g.difficulty);
  ok := random()::numeric < (cfg->>'p')::numeric;
  if not ok then
    lvl := public._crossroad_end(g, 'crashed', 0);
    g.status := 'crashed';
  else
    g.lane := g.lane + 1;
    update public.crossroad_games set lane = g.lane where id = g.id;
    if g.lane >= (cfg->>'lanes')::int then
      g.payout := round(g.bet * public._crossroad_mult(g.difficulty, g.lane), 2);
      lvl := public._crossroad_end(g, 'cashed', g.payout);
      g.status := 'cashed';
    end if;
  end if;
  return jsonb_build_object('ok', ok, 'result', public._crossroad_json(g)) || public.crossroad_state() || coalesce(lvl, '{}'::jsonb);
end $$;

create or replace function public.crossroad_cashout()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  g public.crossroad_games;
  lvl jsonb;
begin
  select * into g from public.crossroad_games where user_id = uid and status = 'active' for update;
  if not found then raise exception 'Nemaš igru u tijeku.'; end if;
  if g.lane < 1 then raise exception 'Prijeđi barem jednu traku.'; end if;
  g.payout := round(g.bet * public._crossroad_mult(g.difficulty, g.lane), 2);
  lvl := public._crossroad_end(g, 'cashed', g.payout);
  g.status := 'cashed';
  return jsonb_build_object('result', public._crossroad_json(g)) || public.crossroad_state() || coalesce(lvl, '{}'::jsonb);
end $$;

grant execute on function public.crossroad_state() to authenticated;
grant execute on function public.crossroad_start(numeric, text) to authenticated;
grant execute on function public.crossroad_step() to authenticated;
grant execute on function public.crossroad_cashout() to authenticated;
revoke all on function public._crossroad_end(public.crossroad_games, text, numeric) from public, anon, authenticated;
revoke all on function public._crossroad_json(public.crossroad_games) from public, anon, authenticated;

commit;
