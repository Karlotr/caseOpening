-- =====================================================================
--  CaseBattle (auto tema) — Supabase shema
--  Pokreni cijeli file u Supabase → SQL Editor (može se pokretati više puta).
--  Sva logika igara (rollovi, balans, XP, gemovi) je u SECURITY DEFINER
--  funkcijama, klijent ne može direktno mijenjati balans ni inventar.
--  Coini su isključivo virtualni (nema uplata ni isplata).
-- =====================================================================

-- ---------- TABLICE ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 20),
  balance numeric(14,2) not null default 1000 check (balance >= 0),
  gems numeric(14,2) not null default 0 check (gems >= 0),
  xp numeric(14,2) not null default 0,
  level int not null default 1,
  daily_streak int not null default 0,
  last_daily_at timestamptz,
  last_weekly_at timestamptz,
  last_monthly_at timestamptz,
  last_rain_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id serial primary key,
  brand text not null,
  model text not null,
  year int not null,
  category text not null,
  body text not null,
  rarity text not null check (rarity in ('common','uncommon','rare','epic','legendary','mythic')),
  value numeric(14,2) not null check (value > 0)
);

-- v4: prave fotografije (CarImages API) — admin može isključiti pogrešnu sliku po autu
alter table public.items add column if not exists photo boolean not null default true;

create table if not exists public.cases (
  id serial primary key,
  slug text unique not null,
  name text not null,
  description text,
  case_type text not null default 'normal' check (case_type in ('normal','daily','gem','level')),
  price numeric(14,2) not null default 0,
  gem_price numeric(14,2),
  min_level int not null default 0,
  streak_min int,
  color text not null default '#f59e0b',
  sort int not null default 0
);

create table if not exists public.case_items (
  case_id int references public.cases(id) on delete cascade,
  item_id int references public.items(id) on delete cascade,
  weight numeric not null check (weight > 0),
  primary key (case_id, item_id)
);

create table if not exists public.inventory (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id int not null references public.items(id),
  status text not null default 'owned' check (status in ('owned','sold','upgraded')),
  source text not null,
  created_at timestamptz not null default now()
);
create index if not exists inventory_user_idx on public.inventory(user_id, status);
create index if not exists inventory_created_idx on public.inventory(created_at desc);

create table if not exists public.game_log (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null,
  wager numeric(14,2) not null default 0,
  payout numeric(14,2) not null default 0,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists game_log_user_idx on public.game_log(user_id, created_at desc);

create table if not exists public.level_case_claims (
  user_id uuid references public.profiles(id) on delete cascade,
  case_id int references public.cases(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (user_id, case_id)
);

create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null,
  seats int not null,
  team_size int not null,
  case_ids int[] not null,
  cost numeric(14,2) not null,
  crazy boolean not null default false,
  status text not null default 'waiting' check (status in ('waiting','finished','cancelled')),
  winner_team int,
  total_value numeric(14,2),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.battles add column if not exists sponsored boolean not null default false;
-- v8: privatni battle — ne prikazuje se na popisu, ulazi se preko linka
alter table public.battles add column if not exists private boolean not null default false;
alter table public.battles add column if not exists fast boolean not null default false;
alter table public.battles add column if not exists currency text not null default 'coins';
alter table public.battles drop constraint if exists battles_currency_check;
alter table public.battles add constraint battles_currency_check check (currency in ('coins','gems'));

-- v2: Jackpot mod (pobjednik se izvlači proporcionalno vrijednosti)
alter table public.battles add column if not exists jackpot boolean not null default false;
alter table public.battles add column if not exists jackpot_ticket numeric;
create index if not exists battles_status_idx on public.battles(status, created_at desc);

create table if not exists public.battle_players (
  battle_id uuid references public.battles(id) on delete cascade,
  seat int not null,
  team int not null,
  user_id uuid references public.profiles(id) on delete set null,
  is_bot boolean not null default false,
  name text not null,
  total numeric(14,2) not null default 0,
  primary key (battle_id, seat)
);

-- v5: posudba — igrač može platiti samo dio ulaza (stake 0.1–1) i tada dobiva isti dio nagrade
alter table public.battle_players add column if not exists stake numeric(5,4) not null default 1;
-- v7: sponzorirani battle — kreator plaća sva mjesta, ostali ulaze besplatno
alter table public.battle_players add column if not exists paid numeric(14,2);

create table if not exists public.battle_drops (
  battle_id uuid references public.battles(id) on delete cascade,
  round int not null,
  seat int not null,
  item_id int not null references public.items(id),
  primary key (battle_id, round, seat)
);

-- ---------- ADMIN, SREĆA, AFFILIATE ----------
-- Osjetljiva polja su u zasebnoj tablici bez RLS politika (klijent ih ne može čitati).
create table if not exists public.user_controls (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  luck numeric(4,2) not null default 1 check (luck between 0.25 and 5),
  banned boolean not null default false,
  note text,
  updated_at timestamptz not null default now()
);

-- izgled u chatu (postavlja admin): boja imena, efekt, oznaka
alter table public.user_controls add column if not exists chat_color text;
alter table public.user_controls add column if not exists chat_effect text not null default 'none';
alter table public.user_controls add column if not exists chat_badge text;
alter table public.user_controls drop constraint if exists user_controls_chat_color_check;
alter table public.user_controls add constraint user_controls_chat_color_check check (chat_color is null or chat_color ~ '^#[0-9a-fA-F]{6}$');
alter table public.user_controls drop constraint if exists user_controls_chat_effect_check;
alter table public.user_controls add constraint user_controls_chat_effect_check check (chat_effect in ('none','glow','shine','rainbow','pulse'));
alter table public.user_controls drop constraint if exists user_controls_chat_badge_check;
alter table public.user_controls add constraint user_controls_chat_badge_check check (chat_badge is null or char_length(chat_badge) <= 14);

alter table public.profiles add column if not exists referred_by uuid references public.profiles(id) on delete set null;

create table if not exists public.affiliates (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text unique not null check (code ~ '^[a-z0-9_]{3,20}$'),
  rate numeric(5,4) not null default 0.05 check (rate between 0 and 0.5),
  earned_total numeric(14,2) not null default 0,
  claimable numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_log (
  id bigserial primary key,
  admin_id uuid references public.profiles(id) on delete set null,
  target_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- postavke stranice (admin ih uključuje/isključuje)
create table if not exists public.site_settings (
  key text primary key,
  enabled boolean not null default true
);
insert into public.site_settings (key, enabled) values
  ('instant_drops', false), ('weekly_drop', false), ('monthly_drop', false)
on conflict (key) do nothing;

-- ---------- LIMITI (admin ih mijenja) ----------
create table if not exists public.site_limits (
  key text primary key,
  value numeric not null,
  min_value numeric not null,
  max_value numeric not null,
  label text not null,
  sort int not null default 0
);
insert into public.site_limits (key, value, min_value, max_value, label, sort) values
  ('battle_max_cases', 50, 1, 100, 'Najviše kutija u battleu', 1),
  ('case_max_open', 5, 1, 10, 'Najviše kutija odjednom (otvaranje)', 2),
  ('jackpot_round_sec', 60, 15, 600, 'Trajanje jackpot runde (sekunde)', 3),
  ('jackpot_min_bet', 1, 0.1, 1000, 'Jackpot najmanji ulog', 4),
  ('jackpot_max_bet', 10000, 1, 1000000, 'Jackpot najveći ulog', 5),
  ('jackpot_fee_pct', 5, 0, 20, 'Jackpot provizija kuće (%)', 6),
  ('trinity_min_bet', 0.1, 0.1, 1000, 'Trinity najmanji ulog', 7),
  ('trinity_max_bet', 10000, 1, 1000000, 'Trinity najveći ulog', 8),
  ('slide_min_bet', 0.1, 0.1, 1000, 'Slide najmanji ulog', 9),
  ('slide_max_bet', 10000, 1, 1000000, 'Slide najveći ulog', 10)
on conflict (key) do update set min_value = excluded.min_value, max_value = excluded.max_value, label = excluded.label, sort = excluded.sort;

create or replace function public._limit(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.site_limits where key = p_key), p_default);
$$;

-- ---------- RLS ----------
alter table public.site_settings enable row level security;
alter table public.site_limits enable row level security;
drop policy if exists "limits read" on public.site_limits;
create policy "limits read" on public.site_limits for select using (true);
grant select on public.site_limits to anon, authenticated;
drop policy if exists "settings read" on public.site_settings;
create policy "settings read" on public.site_settings for select using (true);
alter table public.user_controls enable row level security;
alter table public.affiliates enable row level security;
alter table public.admin_log enable row level security;
drop policy if exists "affiliates own" on public.affiliates;
create policy "affiliates own" on public.affiliates for select using (auth.uid() = user_id);
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.cases enable row level security;
alter table public.case_items enable row level security;
alter table public.inventory enable row level security;
alter table public.game_log enable row level security;
alter table public.level_case_claims enable row level security;
alter table public.battles enable row level security;
alter table public.battle_players enable row level security;
alter table public.battle_drops enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
drop policy if exists "items read" on public.items;
create policy "items read" on public.items for select using (true);
drop policy if exists "cases read" on public.cases;
create policy "cases read" on public.cases for select using (true);
drop policy if exists "case_items read" on public.case_items;
create policy "case_items read" on public.case_items for select using (true);
drop policy if exists "inventory own" on public.inventory;
create policy "inventory own" on public.inventory for select using (auth.uid() = user_id);
drop policy if exists "game_log own" on public.game_log;
create policy "game_log own" on public.game_log for select using (auth.uid() = user_id);
drop policy if exists "level claims own" on public.level_case_claims;
create policy "level claims own" on public.level_case_claims for select using (auth.uid() = user_id);
drop policy if exists "battles read" on public.battles;
create policy "battles read" on public.battles for select using (true);
drop policy if exists "battle_players read" on public.battle_players;
create policy "battle_players read" on public.battle_players for select using (true);
drop policy if exists "battle_drops read" on public.battle_drops;
create policy "battle_drops read" on public.battle_drops for select using (true);

-- ---------- REGISTRACIJA: automatski profil ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text;
  uname text;
  n int := 0;
  ref_code text;
  ref_uid uuid;
begin
  base := coalesce(nullif(regexp_replace(new.raw_user_meta_data->>'username', '[^A-Za-z0-9_]', '', 'g'), ''),
                   regexp_replace(split_part(coalesce(new.email, 'vozac'), '@', 1), '[^A-Za-z0-9_]', '', 'g'));
  base := left(base, 16);
  if char_length(base) < 3 then base := base || 'vozac'; end if;
  uname := base;
  while exists (select 1 from public.profiles where lower(username) = lower(uname)) loop
    n := n + 1;
    uname := left(base, 16) || n::text;
  end loop;
  ref_code := lower(nullif(btrim(new.raw_user_meta_data->>'ref'), ''));
  if ref_code is not null then
    select user_id into ref_uid from public.affiliates where code = ref_code;
  end if;
  insert into public.profiles (id, username, referred_by, balance)
  values (new.id, uname, ref_uid, case when ref_uid is null then 1000 else 1050 end);
  -- vlastiti affiliate kod = korisničko ime (ako je slobodno)
  insert into public.affiliates (user_id, code)
  values (new.id, left(lower(regexp_replace(uname, '[^A-Za-z0-9_]', '', 'g')) || case when char_length(uname) < 3 then 'xx' else '' end, 20))
  on conflict do nothing;
  if not found then
    insert into public.affiliates (user_id, code) values (new.id, left(lower(uname), 14) || substr(md5(new.id::text), 1, 6)) on conflict do nothing;
  end if;
  insert into public.user_controls (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.username_available(p_username text)
returns boolean language sql security definer set search_path = public stable as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(p_username));
$$;

-- ---------- POMOĆNE FUNKCIJE ----------
create or replace function public._uid()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Moraš biti prijavljen.'; end if;
  if exists (select 1 from public.user_controls where user_id = u and banned) then
    raise exception 'Tvoj račun je blokiran. Javi se administratoru.';
  end if;
  return u;
end $$;

create or replace function public._setting(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.site_settings where key = p_key), true);
$$;

create or replace function public._luck(p_uid uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select luck from public.user_controls where user_id = p_uid), 1);
$$;

create or replace function public._is_admin(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_controls where user_id = p_uid and role = 'admin');
$$;

create or replace function public.am_i_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public._is_admin(auth.uid());
$$;

-- level iz XP-a: XP potreban za level L = 25*(L-1)^2
create or replace function public.level_for_xp(p_xp numeric)
returns int language sql immutable as $$
  select least(100, floor(sqrt(greatest(p_xp, 0) / 25))::int + 1);
$$;

-- ulog → XP, gemovi (10% uloga), level-up bonus (L*10 coina po levelu)
create or replace function public._apply_wager(p_uid uuid, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  new_level int;
  bonus numeric := 0;
  l int;
begin
  if p_amount <= 0 then return jsonb_build_object('level_up', null); end if;
  update public.profiles
     set xp = xp + p_amount, gems = gems + round(p_amount * 0.10, 2)
   where id = p_uid returning * into p;
  if p.referred_by is not null then
    update public.affiliates
       set earned_total = earned_total + round(p_amount * rate, 2),
           claimable = claimable + round(p_amount * rate, 2)
     where user_id = p.referred_by;
  end if;
  new_level := public.level_for_xp(p.xp);
  if new_level > p.level then
    for l in (p.level + 1)..new_level loop bonus := bonus + l * 10; end loop;
    update public.profiles set level = new_level, balance = balance + bonus where id = p_uid;
    return jsonb_build_object('level_up', new_level, 'bonus', bonus);
  end if;
  return jsonb_build_object('level_up', null);
end $$;

create or replace function public._charge(p_uid uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
declare bal numeric;
begin
  select balance into bal from public.profiles where id = p_uid for update;
  if bal is null then raise exception 'Profil ne postoji.'; end if;
  if p_amount < 0 then raise exception 'Neispravan iznos.'; end if;
  if bal < p_amount then raise exception 'Nemaš dovoljno coina.'; end if;
  update public.profiles set balance = balance - p_amount where id = p_uid;
end $$;

-- naplata / povrat u coinima ili gemovima (gem battle)
create or replace function public._charge_cur(p_uid uuid, p_amount numeric, p_cur text)
returns void language plpgsql security definer set search_path = public as $$
declare g numeric;
begin
  if p_cur = 'gems' then
    select gems into g from public.profiles where id = p_uid for update;
    if g is null then raise exception 'Profil ne postoji.'; end if;
    if p_amount < 0 then raise exception 'Neispravan iznos.'; end if;
    if g < p_amount then raise exception 'Nemaš dovoljno gemova.'; end if;
    update public.profiles set gems = gems - p_amount where id = p_uid;
  else
    perform public._charge(p_uid, p_amount);
  end if;
end $$;
create or replace function public._credit_cur(p_uid uuid, p_amount numeric, p_cur text)
returns void language sql security definer set search_path = public as $$
  update public.profiles
     set gems = gems + case when p_cur = 'gems' then p_amount else 0 end,
         balance = balance + case when p_cur = 'gems' then 0 else p_amount end
   where id = p_uid;
$$;
revoke all on function public._charge_cur(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public._credit_cur(uuid, numeric, text) from public, anon, authenticated;

-- sreća (luck): 1 = normalno; >1 naginje težine prema skupljim autima, <1 prema jeftinijima
drop function if exists public._roll_case(int);
-- Izvlačenje s "ticketom": auti su poredani od najjeftinijeg do najskupljeg, ticket (0–1) pada u raspon jednog auta.
-- Vraća auto, ticket, šansu tog auta i koliko je falilo do sljedećeg (skupljeg) auta.
create or replace function public._roll_case_detail(p_case_id int, p_luck numeric default 1)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  total numeric;
  r numeric;
  acc numeric := 0;
  rec record;
  t numeric := (least(greatest(coalesce(p_luck, 1), 0.25), 5) - 1) * 0.35;
begin
  select sum(ci.weight * power(i.value, t)) into total
    from public.case_items ci join public.items i on i.id = ci.item_id where ci.case_id = p_case_id;
  if total is null then raise exception 'Kutija je prazna.'; end if;
  r := random()::numeric * total;
  for rec in select ci.item_id, ci.weight * power(i.value, t) as w
               from public.case_items ci join public.items i on i.id = ci.item_id
              where ci.case_id = p_case_id order by i.value, ci.item_id loop
    acc := acc + rec.w;
    if r < acc then
      return jsonb_build_object('item_id', rec.item_id, 'ticket', round(r / total, 6),
                                'chance', round(rec.w / total, 8), 'gap', round((acc - r) / total, 6),
                                'top', acc >= total);
    end if;
  end loop;
  return jsonb_build_object('item_id', rec.item_id, 'ticket', round(r / total, 6), 'chance', round(rec.w / total, 8), 'gap', 0, 'top', true);
end $$;
revoke all on function public._roll_case_detail(int, numeric) from public, anon, authenticated;

create or replace function public._roll_case(p_case_id int, p_luck numeric default 1)
returns int language sql volatile security definer set search_path = public as $$
  select (public._roll_case_detail(p_case_id, p_luck)->>'item_id')::int;
$$;

create or replace function public._item_json(p_item_id int)
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(i) from public.items i where i.id = p_item_id;
$$;

-- ---------- OTVARANJE KUTIJA ----------
create or replace function public.open_case(p_slug text, p_count int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  c public.cases;
  prof public.profiles;
  results jsonb := '[]'::jsonb;
  item_id int;
  inv_id bigint;
  i int;
  cost numeric := 0;
  lvl jsonb := '{}'::jsonb;
  instant numeric := null;
  total_value numeric := 0;
  roll jsonb;
begin
  if p_count < 1 or p_count > public._limit('case_max_open', 5) then
    raise exception 'Možeš otvoriti 1–% kutija odjednom.', public._limit('case_max_open', 5);
  end if;
  select * into c from public.cases where slug = p_slug;
  if not found then raise exception 'Kutija ne postoji.'; end if;
  select * into prof from public.profiles where id = uid for update;

  if c.case_type = 'daily' then
    raise exception 'Dnevne kutije otvaraš na stranici Nagrade.';
  elsif c.case_type = 'normal' then
    cost := c.price * p_count;
    perform public._charge(uid, cost);
  elsif c.case_type = 'gem' then
    if prof.gems < c.gem_price * p_count then raise exception 'Nemaš dovoljno gemova.'; end if;
    update public.profiles set gems = gems - c.gem_price * p_count where id = uid;
  elsif c.case_type = 'level' then
    if p_count <> 1 then raise exception 'Level kutiju otvaraš jednom.'; end if;
    if prof.level < c.min_level then raise exception 'Potreban je level %.', c.min_level; end if;
    if exists (select 1 from public.level_case_claims where user_id = uid and case_id = c.id
               and claimed_at > now() - interval '24 hours') then
      raise exception 'Ovu level kutiju možeš ponovno otvoriti za 24h od zadnjeg otvaranja.';
    end if;
    insert into public.level_case_claims (user_id, case_id, claimed_at) values (uid, c.id, now())
      on conflict (user_id, case_id) do update set claimed_at = now();
  end if;

  for i in 1..p_count loop
    roll := public._roll_case_detail(c.id, public._luck(uid));
    item_id := (roll->>'item_id')::int;
    -- bez garaže: vrijednost auta ide odmah na račun (zapis ostaje radi feeda dropova)
    insert into public.inventory (user_id, item_id, source, status) values (uid, item_id, 'case:' || c.slug, 'sold')
      returning id into inv_id;
    total_value := total_value + (select value from public.items where id = item_id);
    results := results || jsonb_build_array(public._item_json(item_id) || jsonb_build_object('inventory_id', inv_id,
                 'roll', jsonb_build_object('ticket', roll->'ticket', 'chance', roll->'chance', 'gap', roll->'gap', 'top', roll->'top')));
  end loop;

  update public.profiles set balance = balance + total_value where id = uid;

  if cost > 0 then
    lvl := public._apply_wager(uid, cost);
    -- Instant drop: 4% šanse za bonus 10–40% cijene
    if public._setting('instant_drops') and random()::numeric < 0.04 then
      instant := round(cost * (0.10 + random()::numeric * 0.30), 2);
      update public.profiles set balance = balance + instant where id = uid;
    end if;
  end if;

  insert into public.game_log (user_id, game, wager, payout, details)
  values (uid, 'case', cost, total_value, jsonb_build_object('case', c.slug, 'count', p_count, 'instant_drop', instant));

  return jsonb_build_object('items', results, 'instant_drop', instant) || lvl;
end $$;

-- ---------- GARAŽA UKINUTA: auti koji su još u garažama prodaju se po vrijednosti (jednokratno) ----------
with owned as (
  update public.inventory inv set status = 'sold'
    from public.items i
   where i.id = inv.item_id and inv.status = 'owned'
  returning inv.user_id, i.value
)
update public.profiles p set balance = p.balance + t.v
  from (select user_id, sum(value) v from owned group by user_id) t
 where p.id = t.user_id;

-- ---------- GARAŽA (sažetak za navigaciju) ----------
create or replace function public.garage_summary()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('count', count(*), 'value', coalesce(sum(i.value), 0))
    from public.inventory inv join public.items i on i.id = inv.item_id
   where inv.user_id = auth.uid() and inv.status = 'owned';
$$;
grant execute on function public.garage_summary() to authenticated;

-- ---------- PRODAJA ----------
create or replace function public.sell_items(p_ids bigint[])
returns numeric language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  total numeric;
  cnt int;
begin
  perform 1 from public.profiles where id = uid for update;
  select coalesce(sum(i.value), 0), count(*) into total, cnt
    from public.inventory inv join public.items i on i.id = inv.item_id
   where inv.id = any(p_ids) and inv.user_id = uid and inv.status = 'owned';
  if cnt <> coalesce(array_length(p_ids, 1), 0) then raise exception 'Neki predmeti nisu tvoji ili su već prodani.'; end if;
  update public.inventory set status = 'sold' where id = any(p_ids);
  update public.profiles set balance = balance + total where id = uid;
  return total;
end $$;

-- ---------- UPGRADER ----------
create or replace function public.upgrade_items(p_ids bigint[], p_target_item int, p_coins numeric default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  input_value numeric := 0;
  cnt int := 0;
  target numeric;
  chance numeric;
  roll numeric;
  won boolean;
  inv_id bigint;
  lvl jsonb;
  luck numeric;
begin
  if p_coins < 0 then raise exception 'Neispravan iznos.'; end if;
  perform 1 from public.profiles where id = uid for update;
  if coalesce(array_length(p_ids, 1), 0) > 0 then
    select coalesce(sum(i.value), 0), count(*) into input_value, cnt
      from public.inventory inv join public.items i on i.id = inv.item_id
     where inv.id = any(p_ids) and inv.user_id = uid and inv.status = 'owned';
    if cnt <> array_length(p_ids, 1) then raise exception 'Neki predmeti nisu dostupni.'; end if;
  end if;
  if p_coins > 0 then perform public._charge(uid, p_coins); end if;
  input_value := input_value + p_coins;
  if input_value <= 0 then raise exception 'Odaberi predmete ili ulog.'; end if;
  select value into target from public.items where id = p_target_item;
  if target is null then raise exception 'Ciljani auto ne postoji.'; end if;
  if target <= input_value then raise exception 'Cilj mora vrijediti više od uloga.'; end if;

  luck := public._luck(uid);
  chance := least(input_value / target * 0.95 * luck, case when luck > 1 then 0.95 else 0.80 end);
  roll := random()::numeric;
  won := roll < chance;

  update public.inventory set status = 'upgraded' where id = any(p_ids);
  if won then
    insert into public.inventory (user_id, item_id, source, status) values (uid, p_target_item, 'upgrader', 'sold') returning id into inv_id;
    update public.profiles set balance = balance + target where id = uid;
  end if;
  lvl := public._apply_wager(uid, input_value);
  insert into public.game_log (user_id, game, wager, payout, details)
  values (uid, 'upgrader', input_value, case when won then target else 0 end,
          jsonb_build_object('target', p_target_item, 'chance', chance, 'roll', roll));
  return jsonb_build_object('won', won, 'chance', chance, 'roll', roll, 'inventory_id', inv_id,
                            'item', public._item_json(p_target_item)) || lvl;
end $$;

-- ---------- SLIDE (multiplikator, 4% house edge) ----------
create or replace function public.play_slide(p_bet numeric, p_target numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  r numeric;
  m numeric;
  won boolean;
  payout numeric := 0;
  lvl jsonb;
begin
  if p_bet < public._limit('slide_min_bet', 0.1) or p_bet > public._limit('slide_max_bet', 10000) then
    raise exception 'Ulog mora biti % – %.', public._limit('slide_min_bet', 0.1), public._limit('slide_max_bet', 10000);
  end if;
  if p_target < 1.01 or p_target > 1000 then raise exception 'Cilj mora biti 1.01x–1000x.'; end if;
  perform public._charge(uid, p_bet);
  r := random()::numeric;
  m := greatest(1, least(1000, floor(96 / (1 - r)) / 100));
  won := m >= p_target;
  if won then
    payout := round(p_bet * p_target, 2);
    update public.profiles set balance = balance + payout where id = uid;
  end if;
  lvl := public._apply_wager(uid, p_bet);
  insert into public.game_log (user_id, game, wager, payout, details)
  values (uid, 'slide', p_bet, payout, jsonb_build_object('target', p_target, 'result', m));
  return jsonb_build_object('result', m, 'won', won, 'payout', payout) || lvl;
end $$;

-- ---------- TRINITY (30 polja: 14 crvena x2, 14 crna x2, 2 zlatna x14) ----------
-- polje 0 i 15 = zlatna, ostala neparna = crvena, parna = crna
create or replace function public.play_trinity(p_bet numeric, p_color text)
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
  if p_bet < public._limit('trinity_min_bet', 0.1) or p_bet > public._limit('trinity_max_bet', 10000) then
    raise exception 'Ulog mora biti % – %.', public._limit('trinity_min_bet', 0.1), public._limit('trinity_max_bet', 10000);
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
  values (uid, 'trinity', p_bet, payout, jsonb_build_object('pick', p_color, 'slot', slot, 'color', color));
  return jsonb_build_object('slot', slot, 'color', color, 'won', color = p_color, 'payout', payout) || lvl;
end $$;

-- ---------- JACKPOT (protiv botova, 5% provizija) ----------
create or replace function public.play_jackpot(p_bet numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  uname text;
  names text[] := array['TurboTomo','DriftKing','Fićo_Fan','V8_Vlado','Stojadin77','BoostBoris','GT_Goran',
                        'NitroNina','RallyRoko','JDM_Jura','Oldtajmer','Burnout_Ana','Supra_Sven','Kvačilo'];
  players jsonb;
  nbots int;
  i int;
  b numeric;
  pot numeric;
  r numeric;
  acc numeric := 0;
  winner int := 0;
  elem jsonb;
  idx int := 0;
  payout numeric := 0;
  lvl jsonb;
begin
  if p_bet < 1 or p_bet > 10000 then raise exception 'Ulog mora biti 1–10000.'; end if;
  perform public._charge(uid, p_bet);
  select username into uname from public.profiles where id = uid;
  players := jsonb_build_array(jsonb_build_object('name', uname, 'bet', p_bet, 'is_you', true));
  pot := p_bet;
  nbots := 2 + floor(random()::numeric * 5)::int;
  for i in 1..nbots loop
    b := round(p_bet * (0.25 + random()::numeric * 2.0), 2);
    pot := pot + b;
    players := players || jsonb_build_array(jsonb_build_object(
      'name', names[1 + floor(random()::numeric * array_length(names, 1))::int], 'bet', b, 'is_you', false));
  end loop;
  r := random()::numeric * pot;
  for elem in select * from jsonb_array_elements(players) loop
    acc := acc + (elem->>'bet')::numeric;
    if r < acc then winner := idx; exit; end if;
    idx := idx + 1;
  end loop;
  if winner = 0 then
    payout := round(pot * 0.95, 2);
    update public.profiles set balance = balance + payout where id = uid;
  end if;
  lvl := public._apply_wager(uid, p_bet);
  insert into public.game_log (user_id, game, wager, payout, details)
  values (uid, 'jackpot', p_bet, payout, jsonb_build_object('pot', pot, 'players', jsonb_array_length(players)));
  return jsonb_build_object('players', players, 'pot', pot, 'winner', winner, 'ticket', r,
                            'won', winner = 0, 'payout', payout) || lvl;
end $$;

-- ---------- NAGRADE: dnevna kutija (streak), tjedna/mjesečna, kiša coina ----------
create or replace function public.claim_daily()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  p public.profiles;
  today date := (now() at time zone 'Europe/Zagreb')::date;
  last date;
  streak int;
  c public.cases;
  item_id int;
  inv_id bigint;
begin
  select * into p from public.profiles where id = uid for update;
  last := (p.last_daily_at at time zone 'Europe/Zagreb')::date;
  if last = today then raise exception 'Dnevnu kutiju si već otvorio danas. Vrati se sutra!'; end if;
  streak := case when last = today - 1 then p.daily_streak + 1 else 1 end;
  select * into c from public.cases where case_type = 'daily' and streak_min <= streak
   order by streak_min desc limit 1;
  item_id := public._roll_case(c.id, public._luck(uid));
  insert into public.inventory (user_id, item_id, source, status) values (uid, item_id, 'daily:' || c.slug, 'sold') returning id into inv_id;
  update public.profiles set daily_streak = streak, last_daily_at = now(),
         balance = balance + (select value from public.items where id = item_id) where id = uid;
  insert into public.game_log (user_id, game, wager, payout, details)
  values (uid, 'daily', 0, (select value from public.items where id = item_id), jsonb_build_object('streak', streak, 'case', c.slug));
  return jsonb_build_object('streak', streak, 'case', c.slug,
                            'item', public._item_json(item_id) || jsonb_build_object('inventory_id', inv_id));
end $$;

create or replace function public.claim_reward(p_kind text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  p public.profiles;
  amount numeric;
  win_start timestamptz := to_timestamp(floor(extract(epoch from now()) / 1800) * 1800);
begin
  select * into p from public.profiles where id = uid for update;
  if p_kind = 'weekly' then
    if not public._setting('weekly_drop') then raise exception 'Tjedni drop je trenutno isključen.'; end if;
    if p.xp < 100 then raise exception 'Tjedni drop zahtijeva barem 100 odigranih coina.'; end if;
    if p.last_weekly_at > now() - interval '7 days' then raise exception 'Tjedni drop je već preuzet.'; end if;
    amount := 25 + p.level * 10;
    update public.profiles set balance = balance + amount, last_weekly_at = now() where id = uid;
  elsif p_kind = 'monthly' then
    if not public._setting('monthly_drop') then raise exception 'Mjesečni drop je trenutno isključen.'; end if;
    if p.xp < 500 then raise exception 'Mjesečni drop zahtijeva barem 500 odigranih coina.'; end if;
    if p.last_monthly_at > now() - interval '30 days' then raise exception 'Mjesečni drop je već preuzet.'; end if;
    amount := 100 + p.level * 40;
    update public.profiles set balance = balance + amount, last_monthly_at = now() where id = uid;
  elsif p_kind = 'rain' then
    raise exception 'Kiša coina je sada u chatu: pridruži se kad počne.';
    if p.level < 2 then raise exception 'Kiša coina je dostupna od levela 2.'; end if;
    if p.last_rain_at >= win_start then raise exception 'Već si pokupio ovu kišu. Sljedeća za par minuta!'; end if;
    amount := round((1 + random()::numeric * (4 + p.level))::numeric, 2);
    update public.profiles set balance = balance + amount, last_rain_at = now() where id = uid;
  else
    raise exception 'Nepoznata nagrada.';
  end if;
  insert into public.game_log (user_id, game, wager, payout, details)
  values (uid, 'reward', 0, amount, jsonb_build_object('kind', p_kind));
  return jsonb_build_object('amount', amount, 'kind', p_kind);
end $$;

-- ---------- CASE BATTLES ----------
create or replace function public._battle_team(p_seat int, p_team_size int)
returns int language sql immutable as $$ select p_seat / p_team_size; $$;

drop function if exists public.create_battle(text, int[], boolean);
drop function if exists public.create_battle(text, int[], boolean, boolean);
drop function if exists public.create_battle(text, int[], boolean, boolean, numeric);
drop function if exists public.create_battle(text, int[], boolean, boolean, numeric, boolean);
drop function if exists public.create_battle(text, int[], boolean, boolean, numeric, boolean, boolean);
create or replace function public.create_battle(p_mode text, p_case_ids int[], p_crazy boolean default false, p_jackpot boolean default false, p_stake numeric default 1, p_sponsored boolean default false, p_private boolean default false, p_fast boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  seats int;
  tsize int;
  cost numeric;
  bid uuid;
  uname text;
  stake numeric;
  cur text;
  n int := coalesce(array_length(p_case_ids, 1), 0);
begin
  case p_mode
    when '1v1' then seats := 2; tsize := 1;
    when '1v1v1' then seats := 3; tsize := 1;
    when '1v1v1v1' then seats := 4; tsize := 1;
    when '6-way' then seats := 6; tsize := 1;
    when '2v2' then seats := 4; tsize := 2;
    when '3v3' then seats := 6; tsize := 3;
    else raise exception 'Nepoznat mod.';
  end case;
  if n < 1 or n > public._limit('battle_max_cases', 50) then
    raise exception 'Battle može imati 1–% kutija.', public._limit('battle_max_cases', 50);
  end if;
  -- sve kutije moraju biti iste vrste: coin kutije (ulaz u coinima) ili gem kutije (ulaz u gemovima)
  if (select count(*) from unnest(p_case_ids) x(cid) join public.cases c on c.id = x.cid and c.case_type = 'normal') = n then
    cur := 'coins';
    select sum(c.price) into cost from unnest(p_case_ids) as x(cid) join public.cases c on c.id = x.cid;
  elsif (select count(*) from unnest(p_case_ids) x(cid) join public.cases c on c.id = x.cid and c.case_type = 'gem') = n then
    cur := 'gems';
    select sum(c.gem_price) into cost from unnest(p_case_ids) as x(cid) join public.cases c on c.id = x.cid;
  else
    raise exception 'Battle može imati samo coin kutije ili samo gem kutije.';
  end if;
  stake := round(coalesce(p_stake, 1), 4);
  if stake < 0.1 or stake > 1 then raise exception 'Posudba: plaćaš između 10%% i 100%% ulaza.'; end if;
  -- sponzor plaća i mjesta za ostale igrače
  perform public._charge_cur(uid, round(cost * stake, 2) + case when coalesce(p_sponsored, false) then cost * (seats - 1) else 0 end, cur);
  select username into uname from public.profiles where id = uid;
  insert into public.battles (creator_id, mode, seats, team_size, case_ids, cost, crazy, jackpot, sponsored, private, fast, currency)
  values (uid, p_mode, seats, tsize, p_case_ids, cost, coalesce(p_crazy, false), coalesce(p_jackpot, false), coalesce(p_sponsored, false), coalesce(p_private, false), coalesce(p_fast, false), cur) returning id into bid;
  insert into public.battle_players (battle_id, seat, team, user_id, name, stake, paid)
  values (bid, 0, 0, uid, uname, stake, round(cost * stake, 2) + case when coalesce(p_sponsored, false) then cost * (seats - 1) else 0 end);
  return bid;
end $$;

create or replace function public._resolve_battle(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  b public.battles;
  r int;
  s int;
  item int;
  win_team int;
  winners uuid[];
  nw int;
  k int := 0;
  drp record;
  pl record;
  tr record;
  stakes numeric[];
  wi int;
  share numeric;
  budget numeric := 0;
  given numeric := 0;
  paid numeric;
  payout numeric;
  pot_total numeric;
  ticket numeric;
  acc numeric;
begin
  select * into b from public.battles where id = p_id for update;
  if b.status <> 'waiting' then return; end if;
  for r in 1..array_length(b.case_ids, 1) loop
    for s in 0..(b.seats - 1) loop
      item := public._roll_case(b.case_ids[r],
                coalesce((select public._luck(bp.user_id) from public.battle_players bp where bp.battle_id = p_id and bp.seat = s and bp.user_id is not null), 1));
      insert into public.battle_drops (battle_id, round, seat, item_id) values (p_id, r, s, item);
    end loop;
  end loop;
  update public.battle_players bp
     set total = coalesce((select sum(i.value) from public.battle_drops d join public.items i on i.id = d.item_id
                            where d.battle_id = p_id and d.seat = bp.seat), 0)
   where bp.battle_id = p_id;

  if b.jackpot then
    -- Jackpot: šansa tima = njegova vrijednost / ukupna vrijednost
    -- Crazy Jackpot: šansa je obrnuto proporcionalna vrijednosti (1 / vrijednost)
    select coalesce(sum(case when b.crazy then 1 / greatest(t.tt, 0.01) else t.tt end), 0) into pot_total
      from (select sum(bp2.total) as tt from public.battle_players bp2 where bp2.battle_id = p_id group by bp2.team) t;
    ticket := random()::numeric;
    acc := 0;
    for tr in select bp2.team, sum(bp2.total) as tt from public.battle_players bp2 where bp2.battle_id = p_id group by bp2.team order by bp2.team loop
      acc := acc + (case when b.crazy then 1 / greatest(tr.tt, 0.01) else tr.tt end) / greatest(pot_total, 0.000001);
      win_team := tr.team;
      exit when ticket < acc;
    end loop;
    update public.battles set jackpot_ticket = ticket where id = p_id;
  else
    -- pobjednički tim (crazy = najmanje), izjednačenje → nasumično
    select t.team into win_team from (
      select bp2.team, sum(bp2.total) as tt from public.battle_players bp2 where bp2.battle_id = p_id group by bp2.team
    ) t order by case when b.crazy then t.tt else -t.tt end, random()::numeric limit 1;
  end if;

  select coalesce(sum(i.value), 0) into pot_total from public.battle_drops d join public.items i on i.id = d.item_id where d.battle_id = p_id;

  -- PRAVEDNA RASPODJELA: ukupna vrijednost svih dropova dijeli se jednako na sva mjesta pobjedničkog tima.
  -- Svaki pobjednik dobiva (ukupno / broj mjesta u timu) × svoj udio ulaza (posudba), sve u coinima.
  -- Dio bota u pobjedničkom timu ostaje kući (inače bi popunjavanje botovima bilo isplativo).
  select array_agg(coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid) order by seat),
         array_agg(stake order by seat)
    into winners, stakes
    from public.battle_players where battle_id = p_id and team = win_team;
  nw := array_length(winners, 1);

  update public.battles set status = 'finished', winner_team = win_team, total_value = pot_total, finished_at = now() where id = p_id;

  for pl in select * from public.battle_players where battle_id = p_id and not is_bot and user_id is not null order by seat loop
    -- XP/ulog: vlastiti ulaz (sponzorirana mjesta drugih ne broje se u ulog; besplatni igrači 0)
    paid := case when b.sponsored and pl.user_id <> b.creator_id then 0 else round(b.cost * pl.stake, 2) end;
    if b.currency = 'gems' then paid := 0; end if; -- gem ulaz se ne broji u coin ulog/XP
    perform public._apply_wager(pl.user_id, paid);
    payout := 0;
    if pl.team = win_team then
      budget := round(pot_total / nw * pl.stake, 2);
      given := 0;
      update public.profiles set balance = balance + budget where id = pl.user_id;
      payout := budget;
    end if;
    insert into public.game_log (user_id, game, wager, payout, details)
    values (pl.user_id, 'battle', paid, payout,
            jsonb_build_object('battle', p_id, 'mode', b.mode, 'won', pl.team = win_team, 'stake', pl.stake, 'coins', case when pl.team = win_team then budget else 0 end));
  end loop;
end $$;

drop function if exists public.join_battle(uuid, int);
create or replace function public.join_battle(p_id uuid, p_seat int, p_stake numeric default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  stake numeric := round(coalesce(p_stake, 1), 4);
  b public.battles;
  uname text;
  filled int;
begin
  select * into b from public.battles where id = p_id for update;
  if not found then raise exception 'Battle ne postoji.'; end if;
  if b.status <> 'waiting' then raise exception 'Battle je već počeo.'; end if;
  if p_seat < 0 or p_seat >= b.seats then raise exception 'Neispravno mjesto.'; end if;
  if exists (select 1 from public.battle_players where battle_id = p_id and user_id = uid) then
    raise exception 'Već si u ovom battleu.';
  end if;
  if exists (select 1 from public.battle_players where battle_id = p_id and seat = p_seat) then
    raise exception 'Mjesto je zauzeto.';
  end if;
  if b.sponsored then
    stake := 1; -- sponzorirano: ulaz je besplatan i igra se za punu nagradu
  else
    if stake < 0.1 or stake > 1 then raise exception 'Posudba: plaćaš između 10%% i 100%% ulaza.'; end if;
    perform public._charge_cur(uid, round(b.cost * stake, 2), b.currency);
  end if;
  select username into uname from public.profiles where id = uid;
  insert into public.battle_players (battle_id, seat, team, user_id, name, stake, paid)
  values (p_id, p_seat, public._battle_team(p_seat, b.team_size), uid, uname, stake, case when b.sponsored then 0 else round(b.cost * stake, 2) end);
  select count(*) into filled from public.battle_players where battle_id = p_id;
  if filled = b.seats then perform public._resolve_battle(p_id); end if;
  return jsonb_build_object('ok', true, 'started', filled = b.seats);
end $$;

create or replace function public.fill_battle_bots(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  b public.battles;
  s int;
  bots text[] := array['Bot Fićo','Bot Stojadin','Bot Supra','Bot Miura','Bot Cobra','Bot Skyline'];
begin
  select * into b from public.battles where id = p_id for update;
  if not found then raise exception 'Battle ne postoji.'; end if;
  if b.creator_id <> uid then raise exception 'Samo kreator može dodati botove.'; end if;
  if b.status <> 'waiting' then raise exception 'Battle je već počeo.'; end if;
  for s in 0..(b.seats - 1) loop
    if not exists (select 1 from public.battle_players where battle_id = p_id and seat = s) then
      insert into public.battle_players (battle_id, seat, team, is_bot, name)
      values (p_id, s, public._battle_team(s, b.team_size), true, bots[s + 1]);
      -- sponzorirano mjesto koje je uzeo bot vraća se sponzoru
      if b.sponsored then
        perform public._credit_cur(b.creator_id, b.cost, b.currency);
      end if;
    end if;
  end loop;
  perform public._resolve_battle(p_id);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.cancel_battle(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  b public.battles;
begin
  select * into b from public.battles where id = p_id for update;
  if not found or b.creator_id <> uid then raise exception 'Ne možeš otkazati ovaj battle.'; end if;
  if b.status <> 'waiting' then raise exception 'Battle je već počeo.'; end if;
  if exists (select 1 from public.battle_players where battle_id = p_id and user_id <> uid) then
    raise exception 'Netko se već pridružio — ne možeš otkazati.';
  end if;
  update public.battles set status = 'cancelled' where id = p_id;
  perform public._credit_cur(uid, coalesce((select paid from public.battle_players where battle_id = p_id and user_id = uid),
                                      round(b.cost * coalesce((select stake from public.battle_players where battle_id = p_id and user_id = uid), 1), 2)), b.currency);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- JAVNI FEED / LEADERBOARD ----------
create or replace function public.recent_drops(p_limit int default 20)
returns table (id bigint, username text, source text, created_at timestamptz, item jsonb)
language sql stable security definer set search_path = public as $$
  select inv.id, p.username, inv.source, inv.created_at, to_jsonb(i)
    from public.inventory inv
    join public.profiles p on p.id = inv.user_id
    join public.items i on i.id = inv.item_id
   order by inv.created_at desc
   limit least(p_limit, 50);
$$;

-- ---------- LJESTVICA (dnevna / tjedna / mjesečna), keširana 5 minuta ----------
create index if not exists game_log_created_idx on public.game_log(created_at);
create table if not exists public.leaderboard_cache (
  period text primary key,
  data jsonb not null,
  updated_at timestamptz not null
);
alter table public.leaderboard_cache enable row level security;

create or replace function public.leaderboard_period(p_period text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.leaderboard_cache;
  since timestamptz;
  d jsonb;
begin
  if p_period not in ('day','week','month') then raise exception 'Nepoznato razdoblje.'; end if;
  select * into c from public.leaderboard_cache where period = p_period;
  if found and c.updated_at > now() - interval '5 minutes' then
    return jsonb_build_object('rows', c.data, 'updated_at', c.updated_at);
  end if;
  since := (date_trunc(p_period, now() at time zone 'Europe/Zagreb')) at time zone 'Europe/Zagreb';
  select coalesce(jsonb_agg(x order by x.wagered desc), '[]'::jsonb) into d from (
    select p.username, p.level, sum(g.wager) as wagered, sum(g.payout) as won, max(g.payout) as best, count(*) as games
      from public.game_log g join public.profiles p on p.id = g.user_id
     where g.created_at >= since and g.wager > 0 and g.game not in ('admin','reward','affiliate')
     group by p.id, p.username, p.level
     order by sum(g.wager) desc
     limit 25) x;
  insert into public.leaderboard_cache (period, data, updated_at) values (p_period, d, now())
  on conflict (period) do update set data = excluded.data, updated_at = excluded.updated_at;
  return jsonb_build_object('rows', d, 'updated_at', now());
end $$;
grant execute on function public.leaderboard_period(text) to anon, authenticated;

create or replace function public.leaderboard()
returns table (username text, level int, xp numeric)
language sql stable security definer set search_path = public as $$
  select username, level, xp from public.profiles order by xp desc limit 20;
$$;

-- ---------- OVLASTI ----------
revoke all on function public._uid() from public, anon, authenticated;
revoke all on function public._apply_wager(uuid, numeric) from public, anon, authenticated;
revoke all on function public._charge(uuid, numeric) from public, anon, authenticated;
revoke all on function public._roll_case(int, numeric) from public, anon, authenticated;
revoke all on function public._luck(uuid) from public, anon, authenticated;
revoke all on function public._is_admin(uuid) from public, anon, authenticated;
grant execute on function public.am_i_admin() to authenticated;
revoke all on function public._resolve_battle(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public._uid() to authenticated;

grant execute on function public.open_case(text, int) to authenticated;
grant execute on function public.sell_items(bigint[]) to authenticated;
grant execute on function public.upgrade_items(bigint[], int, numeric) to authenticated;
grant execute on function public.play_slide(numeric, numeric) to authenticated;
grant execute on function public.play_trinity(numeric, text) to authenticated;
grant execute on function public.play_jackpot(numeric) to authenticated;
grant execute on function public.claim_daily() to authenticated;
grant execute on function public.claim_reward(text) to authenticated;
grant execute on function public.create_battle(text, int[], boolean, boolean, numeric, boolean, boolean, boolean) to authenticated;
grant execute on function public.join_battle(uuid, int, numeric) to authenticated;
grant execute on function public.fill_battle_bots(uuid) to authenticated;
grant execute on function public.cancel_battle(uuid) to authenticated;
grant execute on function public.recent_drops(int) to anon, authenticated;
grant execute on function public.leaderboard() to anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;


-- ---------- CHAT (poruke se čuvaju 6 sati) ----------
create table if not exists public.chat_messages (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  level int not null,
  body text not null check (char_length(body) between 1 and 300),
  battle_id uuid references public.battles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists chat_created_idx on public.chat_messages(created_at desc);
-- v6: sistemske poruke (kiša coina, bakšiš)
alter table public.chat_messages alter column user_id drop not null;
alter table public.chat_messages add column if not exists kind text not null default 'msg';
alter table public.chat_messages add column if not exists rain_id bigint;
alter table public.chat_messages drop constraint if exists chat_messages_body_check;
alter table public.chat_messages add constraint chat_messages_body_check check (char_length(body) between 1 and 300);
alter table public.chat_messages add column if not exists style jsonb;
alter table public.chat_messages enable row level security;
drop policy if exists "chat read recent" on public.chat_messages;
create policy "chat read recent" on public.chat_messages for select using (created_at > now() - interval '6 hours');

-- stil imena u chatu; admin bez postavljene oznake dobiva "Admin" (prazna oznaka = bez oznake)
create or replace function public._chat_style(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when c.user_id is null then null else jsonb_strip_nulls(jsonb_build_object(
    'color', c.chat_color,
    'effect', nullif(c.chat_effect, 'none'),
    'badge', nullif(coalesce(c.chat_badge, case when c.role = 'admin' then 'Admin' end), '')
  )) end
  from (select 1) d left join public.user_controls c on c.user_id = p_user;
$$;
revoke execute on function public._chat_style(uuid) from public, anon, authenticated;

create or replace function public.send_chat(p_body text, p_battle_id uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  p public.profiles;
  body text := btrim(coalesce(p_body, ''));
  mid bigint;
begin
  select * into p from public.profiles where id = uid;
  if char_length(body) = 0 and p_battle_id is null then raise exception 'Poruka je prazna.'; end if;
  if char_length(body) > 300 then raise exception 'Poruka može imati najviše 300 znakova.'; end if;
  if exists (select 1 from public.chat_messages where user_id = uid and created_at > now() - interval '1 second') then
    raise exception 'Polako, jedna poruka u sekundi.';
  end if;
  if p_battle_id is not null then
    if not exists (select 1 from public.battles where id = p_battle_id) then raise exception 'Battle ne postoji.'; end if;
    if char_length(body) = 0 then body := 'Pridruži mi se u battleu!'; end if;
  end if;
  insert into public.chat_messages (user_id, username, level, body, battle_id, style)
  values (uid, p.username, p.level, body, p_battle_id, public._chat_style(uid)) returning id into mid;
  -- čišćenje starih poruka
  delete from public.chat_messages where created_at < now() - interval '6 hours';
  return mid;
end $$;
grant execute on function public.send_chat(text, uuid) to authenticated;


-- ---------- AFFILIATE (preporuke) ----------
-- postojeći korisnici dobivaju affiliate kod i kontrolni red
insert into public.affiliates (user_id, code)
  select id, left(lower(regexp_replace(username, '[^A-Za-z0-9_]', '', 'g')), 20) from public.profiles
  where char_length(regexp_replace(username, '[^A-Za-z0-9_]', '', 'g')) >= 3
on conflict do nothing;
insert into public.affiliates (user_id, code)
  select id, 'v' || substr(md5(id::text), 1, 10) from public.profiles p
  where not exists (select 1 from public.affiliates a where a.user_id = p.id)
on conflict do nothing;
insert into public.user_controls (user_id) select id from public.profiles on conflict do nothing;

create or replace function public.affiliate_info()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  a public.affiliates;
begin
  select * into a from public.affiliates where user_id = uid;
  return jsonb_build_object(
    'code', a.code, 'rate', a.rate, 'earned_total', a.earned_total, 'claimable', a.claimable,
    'referrals', (select count(*) from public.profiles where referred_by = uid),
    'referral_wagered', (select coalesce(sum(xp), 0) from public.profiles where referred_by = uid),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('username', username, 'level', level, 'created_at', created_at) order by created_at desc), '[]'::jsonb)
                 from (select username, level, created_at from public.profiles where referred_by = uid order by created_at desc limit 10) x)
  );
end $$;

create or replace function public.claim_affiliate()
returns numeric language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  amt numeric;
begin
  select claimable into amt from public.affiliates where user_id = uid for update;
  if coalesce(amt, 0) < 1 then raise exception 'Za isplatu treba barem 1 coin zarade.'; end if;
  update public.affiliates set claimable = 0 where user_id = uid;
  update public.profiles set balance = balance + amt where id = uid;
  insert into public.game_log (user_id, game, wager, payout, details) values (uid, 'affiliate', 0, amt, null);
  return amt;
end $$;

create or replace function public.set_affiliate_code(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  c text := lower(btrim(p_code));
begin
  if c !~ '^[a-z0-9_]{3,20}$' then raise exception 'Kod: 3–20 znakova (mala slova, brojevi, _).'; end if;
  if exists (select 1 from public.affiliates where code = c and user_id <> uid) then raise exception 'Taj kod je zauzet.'; end if;
  update public.affiliates set code = c where user_id = uid;
  return c;
end $$;

-- ---------- ADMIN ----------
-- Prvog admina postavi ručno u SQL Editoru:
--   update public.user_controls set role = 'admin'
--   where user_id = (select id from public.profiles where username = 'TvojeIme');

create or replace function public._admin()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare u uuid := public._uid();
begin
  if not public._is_admin(u) then raise exception 'Samo za administratore.'; end if;
  return u;
end $$;

create or replace function public._admin_log(p_admin uuid, p_target uuid, p_action text, p_details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.admin_log (admin_id, target_id, action, details) values (p_admin, p_target, p_action, p_details);
$$;

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a uuid := public._admin();
begin
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'new_24h', (select count(*) from public.profiles where created_at > now() - interval '24 hours'),
    'active_24h', (select count(distinct user_id) from public.game_log where created_at > now() - interval '24 hours'),
    'wagered_24h', (select coalesce(sum(wager), 0) from public.game_log where created_at > now() - interval '24 hours'),
    'payout_24h', (select coalesce(sum(payout), 0) from public.game_log where created_at > now() - interval '24 hours' and game not in ('reward','daily','affiliate')),
    'rewards_24h', (select coalesce(sum(payout), 0) from public.game_log where created_at > now() - interval '24 hours' and game in ('reward','daily','affiliate')),
    'total_balance', (select coalesce(sum(balance), 0) from public.profiles),
    'open_battles', (select count(*) from public.battles where status = 'waiting'),
    'banned', (select count(*) from public.user_controls where banned),
    'by_game', (select coalesce(jsonb_agg(x order by x.wager desc), '[]'::jsonb) from (
       select game, count(*) as rounds, coalesce(sum(wager), 0) as wager, coalesce(sum(payout), 0) as payout
         from public.game_log where created_at > now() - interval '24 hours' group by game) x)
  );
end $$;

create or replace function public.admin_users(p_search text default '', p_limit int default 50)
returns table (id uuid, username text, email text, balance numeric, gems numeric, level int, xp numeric,
               role text, luck numeric, banned boolean, note text, aff_code text, aff_rate numeric, aff_earned numeric,
               referrals bigint, referred_by text, created_at timestamptz, last_game timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare a uuid := public._admin();
begin
  return query
  select p.id, p.username, u.email::text, p.balance, p.gems, p.level, p.xp,
         coalesce(c.role, 'user'), coalesce(c.luck, 1), coalesce(c.banned, false), c.note,
         af.code, af.rate, af.earned_total,
         (select count(*) from public.profiles r where r.referred_by = p.id),
         (select rp.username from public.profiles rp where rp.id = p.referred_by),
         p.created_at,
         (select max(g.created_at) from public.game_log g where g.user_id = p.id)
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join public.user_controls c on c.user_id = p.id
    left join public.affiliates af on af.user_id = p.id
   where coalesce(p_search, '') = '' or p.username ilike '%' || p_search || '%' or u.email ilike '%' || p_search || '%'
   order by p.created_at desc
   limit least(greatest(p_limit, 1), 500);
end $$;

create or replace function public.admin_user_detail(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a uuid := public._admin();
begin
  return jsonb_build_object(
    'chat', (select jsonb_build_object('color', chat_color, 'effect', chat_effect, 'badge', chat_badge, 'role', role) from public.user_controls where user_id = p_user),
    'inventory_count', (select count(*) from public.inventory where user_id = p_user and status = 'owned'),
    'inventory_value', (select coalesce(sum(i.value), 0) from public.inventory inv join public.items i on i.id = inv.item_id where inv.user_id = p_user and inv.status = 'owned'),
    'wagered', (select coalesce(sum(wager), 0) from public.game_log where user_id = p_user),
    'payout', (select coalesce(sum(payout), 0) from public.game_log where user_id = p_user),
    'logs', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select game, wager, payout, created_at from public.game_log where user_id = p_user order by created_at desc limit 25) x),
    'admin_log', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select l.action, l.details, l.created_at, ap.username as admin
          from public.admin_log l left join public.profiles ap on ap.id = l.admin_id
         where l.target_id = p_user order by l.created_at desc limit 25) x)
  );
end $$;

create or replace function public.admin_adjust(p_user uuid, p_balance numeric default 0, p_gems numeric default 0, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin(); p public.profiles;
begin
  update public.profiles
     set balance = greatest(0, balance + coalesce(p_balance, 0)),
         gems = greatest(0, gems + coalesce(p_gems, 0))
   where id = p_user returning * into p;
  if not found then raise exception 'Korisnik ne postoji.'; end if;
  perform public._admin_log(a, p_user, 'adjust', jsonb_build_object('balance', p_balance, 'gems', p_gems, 'reason', p_reason));
  if coalesce(p_balance, 0) <> 0 then
    insert into public.game_log (user_id, game, wager, payout, details)
    values (p_user, 'admin', 0, greatest(p_balance, 0), jsonb_build_object('reason', p_reason, 'delta', p_balance));
  end if;
  return jsonb_build_object('balance', p.balance, 'gems', p.gems);
end $$;

-- postavi točan iznos stanja / gemova (null = ne mijenjaj)
create or replace function public.admin_set_balance(p_user uuid, p_balance numeric default null, p_gems numeric default null, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin(); old public.profiles; p public.profiles; delta numeric;
begin
  if p_balance is not null and (p_balance < 0 or p_balance > 1000000000) then raise exception 'Stanje mora biti 0 – 1.000.000.000.'; end if;
  if p_gems is not null and (p_gems < 0 or p_gems > 1000000000) then raise exception 'Gemovi moraju biti 0 – 1.000.000.000.'; end if;
  select * into old from public.profiles where id = p_user for update;
  if not found then raise exception 'Korisnik ne postoji.'; end if;
  update public.profiles
     set balance = coalesce(round(p_balance, 2), balance),
         gems = coalesce(round(p_gems, 2), gems)
   where id = p_user returning * into p;
  delta := p.balance - old.balance;
  perform public._admin_log(a, p_user, 'set_balance', jsonb_build_object(
    'balance_old', old.balance, 'balance', p.balance, 'gems_old', old.gems, 'gems', p.gems, 'reason', p_reason));
  if delta <> 0 then
    insert into public.game_log (user_id, game, wager, payout, details)
    values (p_user, 'admin', 0, greatest(delta, 0), jsonb_build_object('reason', p_reason, 'delta', delta, 'set', true));
  end if;
  return jsonb_build_object('balance', p.balance, 'gems', p.gems);
end $$;
grant execute on function public.admin_set_balance(uuid, numeric, numeric, text) to authenticated;

create or replace function public.admin_set_controls(p_user uuid, p_luck numeric, p_banned boolean, p_role text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin();
begin
  if p_user = a and p_role <> 'admin' then raise exception 'Ne možeš sebi maknuti admin ulogu.'; end if;
  if p_user = a and p_banned then raise exception 'Ne možeš blokirati sebe.'; end if;
  insert into public.user_controls (user_id, luck, banned, role, note, updated_at)
  values (p_user, p_luck, p_banned, p_role, p_note, now())
  on conflict (user_id) do update set luck = excluded.luck, banned = excluded.banned, role = excluded.role, note = excluded.note, updated_at = now();
  perform public._admin_log(a, p_user, 'controls', jsonb_build_object('luck', p_luck, 'banned', p_banned, 'role', p_role, 'note', p_note));
end $$;

create or replace function public.admin_set_chat_style(p_user uuid, p_color text, p_effect text, p_badge text)
returns void language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin();
begin
  insert into public.user_controls (user_id) values (p_user) on conflict do nothing;
  update public.user_controls
     set chat_color = nullif(btrim(coalesce(p_color, '')), ''),
         chat_effect = coalesce(nullif(p_effect, ''), 'none'),
         chat_badge = case when p_badge is null then null else btrim(p_badge) end,
         updated_at = now()
   where user_id = p_user;
  -- odmah primijeni i na nedavne poruke
  update public.chat_messages set style = public._chat_style(p_user) where user_id = p_user and kind = 'msg';
  perform public._admin_log(a, p_user, 'chat_style', jsonb_build_object('color', p_color, 'effect', p_effect, 'badge', p_badge));
end $$;
grant execute on function public.admin_set_chat_style(uuid, text, text, text) to authenticated;

-- garaža korisnika (admin pregled)
create or replace function public.admin_user_garage(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a uuid := public._admin();
begin
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select inv.id as inventory_id, inv.source, inv.created_at, i.*
      from public.inventory inv join public.items i on i.id = inv.item_id
     where inv.user_id = p_user order by inv.created_at desc limit 60) x), '[]'::jsonb);
end $$;
grant execute on function public.admin_user_garage(uuid) to authenticated;

-- moderacija chata
create or replace function public.admin_delete_chat(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin(); m public.chat_messages;
begin
  delete from public.chat_messages where id = p_id returning * into m;
  if found then perform public._admin_log(a, m.user_id, 'chat_delete', jsonb_build_object('body', m.body, 'username', m.username)); end if;
end $$;
grant execute on function public.admin_delete_chat(bigint) to authenticated;

create or replace function public.admin_clear_chat()
returns int language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin(); n int;
begin
  delete from public.chat_messages where true;
  get diagnostics n = row_count;
  perform public._admin_log(a, null, 'chat_clear', jsonb_build_object('deleted', n));
  return n;
end $$;
grant execute on function public.admin_clear_chat() to authenticated;

create or replace function public.admin_set_limit(p_key text, p_value numeric)
returns void language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin(); l public.site_limits;
begin
  select * into l from public.site_limits where key = p_key;
  if not found then raise exception 'Nepoznat limit.'; end if;
  if p_value < l.min_value or p_value > l.max_value then
    raise exception '% mora biti između % i %.', l.label, l.min_value, l.max_value;
  end if;
  update public.site_limits set value = p_value where key = p_key;
  perform public._admin_log(a, null, 'limit', jsonb_build_object('key', p_key, 'value', p_value, 'old', l.value));
end $$;
grant execute on function public.admin_set_limit(text, numeric) to authenticated;

create or replace function public.admin_set_level(p_user uuid, p_level int)
returns void language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin();
begin
  if p_level < 1 or p_level > 100 then raise exception 'Level mora biti 1–100.'; end if;
  update public.profiles set level = p_level, xp = 25 * (p_level - 1) ^ 2 where id = p_user;
  perform public._admin_log(a, p_user, 'level', jsonb_build_object('level', p_level));
end $$;

create or replace function public.admin_set_affiliate(p_user uuid, p_code text, p_rate numeric)
returns void language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin(); c text := lower(btrim(p_code));
begin
  if c !~ '^[a-z0-9_]{3,20}$' then raise exception 'Kod: 3–20 znakova (mala slova, brojevi, _).'; end if;
  if p_rate < 0 or p_rate > 0.5 then raise exception 'Provizija mora biti 0–50%%.'; end if;
  if exists (select 1 from public.affiliates where code = c and user_id <> p_user) then raise exception 'Taj kod je zauzet.'; end if;
  insert into public.affiliates (user_id, code, rate) values (p_user, c, p_rate)
  on conflict (user_id) do update set code = excluded.code, rate = excluded.rate;
  perform public._admin_log(a, p_user, 'affiliate', jsonb_build_object('code', c, 'rate', p_rate));
end $$;

create or replace function public.admin_give_item(p_user uuid, p_item int)
returns void language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin();
begin
  if not exists (select 1 from public.items where id = p_item) then raise exception 'Auto ne postoji.'; end if;
  insert into public.inventory (user_id, item_id, source, status) values (p_user, p_item, 'admin', 'sold');
  update public.profiles set balance = balance + (select value from public.items where id = p_item) where id = p_user;
  perform public._admin_log(a, p_user, 'give_item', jsonb_build_object('item', p_item));
end $$;

create or replace function public.admin_reset_cooldowns(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin();
begin
  update public.profiles set last_daily_at = null, last_weekly_at = null, last_monthly_at = null, last_rain_at = null where id = p_user;
  delete from public.level_case_claims where user_id = p_user;
  perform public._admin_log(a, p_user, 'reset_cooldowns', null);
end $$;

create or replace function public.admin_recent_log(p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a uuid := public._admin();
begin
  return (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select l.action, l.details, l.created_at, ap.username as admin, tp.username as target
      from public.admin_log l
      left join public.profiles ap on ap.id = l.admin_id
      left join public.profiles tp on tp.id = l.target_id
     order by l.created_at desc limit least(p_limit, 200)) x);
end $$;

revoke all on function public._admin() from public, anon, authenticated;
revoke all on function public._admin_log(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.affiliate_info() to authenticated;
grant execute on function public.claim_affiliate() to authenticated;
grant execute on function public.set_affiliate_code(text) to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_users(text, int) to authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;
grant execute on function public.admin_adjust(uuid, numeric, numeric, text) to authenticated;
grant execute on function public.admin_set_controls(uuid, numeric, boolean, text, text) to authenticated;
grant execute on function public.admin_set_level(uuid, int) to authenticated;
grant execute on function public.admin_set_affiliate(uuid, text, numeric) to authenticated;
grant execute on function public.admin_give_item(uuid, int) to authenticated;
grant execute on function public.admin_reset_cooldowns(uuid) to authenticated;
grant execute on function public.admin_recent_log(int) to authenticated;


create or replace function public.admin_set_item_photo(p_item int, p_photo boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin();
begin
  update public.items set photo = p_photo where id = p_item;
  perform public._admin_log(a, null, 'item_photo', jsonb_build_object('item', p_item, 'photo', p_photo));
end $$;
grant execute on function public.admin_set_item_photo(int, boolean) to authenticated;


-- ---------- KIŠA COINA (u chatu) ----------
-- Svaki sat: zadnje 3 minute je otvoreno pridruživanje (ograničen broj mjesta). Na kraju se pot dijeli
-- jednako svima koji su se pridružili (level 2+). Bakšiš povećava pot. Admin može pokrenuti kišu ručno.
-- Ako se nitko ne pridruži, pot ide u sljedeću kišu.
create table if not exists public.rain_rounds (
  id bigserial primary key,
  ends_at timestamptz unique not null,
  pot numeric(14,2) not null default 0,
  status text not null default 'open' check (status in ('open','paid')),
  announced boolean not null default false,
  participants int not null default 0,
  paid_each numeric(14,2)
);
alter table public.rain_rounds add column if not exists slots int not null default 20;
alter table public.rain_rounds add column if not exists window_min int not null default 3;
alter table public.rain_rounds add column if not exists manual boolean not null default false;
create table if not exists public.rain_entries (
  rain_id bigint references public.rain_rounds(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (rain_id, user_id)
);
alter table public.rain_rounds enable row level security;
alter table public.rain_entries enable row level security;
drop policy if exists "rain read" on public.rain_rounds;
create policy "rain read" on public.rain_rounds for select using (true);
insert into public.site_settings (key, enabled) values ('coin_rain', true) on conflict (key) do nothing;

create or replace function public._rain_base() returns numeric language sql immutable as $$ select 25::numeric $$;

create or replace function public._rain_settle()
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.rain_rounds;
  n int;
  each_amt numeric;
  carry numeric := 0;
begin
  for r in select * from public.rain_rounds where status = 'open' and ends_at <= now() order by ends_at for update loop
    select count(*) into n from public.rain_entries where rain_id = r.id;
    if n > 0 then
      each_amt := floor(r.pot / n * 100) / 100;
      update public.profiles p set balance = balance + each_amt from public.rain_entries e where e.rain_id = r.id and e.user_id = p.id;
      insert into public.game_log (user_id, game, wager, payout, details)
        select e.user_id, 'rain', 0, each_amt, jsonb_build_object('rain', r.id) from public.rain_entries e where e.rain_id = r.id;
      update public.rain_rounds set status = 'paid', participants = n, paid_each = each_amt where id = r.id;
      insert into public.chat_messages (user_id, username, level, body, kind, rain_id)
      values (null, 'Kiša coina', 0, format('Kiša je pala! Po %s coina za %s %s.', replace(to_char(each_amt, 'FM999990D00'), '.', ','), n, case when n = 1 then 'igrača' else 'igrača' end), 'rain_paid', r.id);
    else
      carry := carry + r.pot;
      update public.rain_rounds set status = 'paid', participants = 0, paid_each = 0 where id = r.id;
      insert into public.chat_messages (user_id, username, level, body, kind, rain_id)
      values (null, 'Kiša coina', 0, 'Nitko se nije pridružio kiši. Pot ide u sljedeću kišu.', 'rain_paid', r.id);
    end if;
  end loop;
  if carry > 0 then
    perform public._rain_current();
    update public.rain_rounds set pot = pot + carry where id = (select id from public.rain_rounds where status = 'open' order by ends_at limit 1);
  end if;
end $$;

-- trenutna (sljedeća) kiša; kreira se po potrebi
create or replace function public._rain_current()
returns public.rain_rounds language plpgsql security definer set search_path = public as $$
declare
  -- sljedeća kiša: u nasumičnoj minuti sljedećeg sata (igrači ne znaju kada)
  e timestamptz := date_trunc('hour', now()) + interval '1 hour' + make_interval(mins => 5 + floor(random() * 50)::int);
  r public.rain_rounds;
begin
  select * into r from public.rain_rounds where status = 'open' and ends_at > now() order by ends_at limit 1;
  if found then return r; end if;
  insert into public.rain_rounds (ends_at, pot) values (e, public._rain_base()) on conflict (ends_at) do nothing;
  select * into r from public.rain_rounds where ends_at = e;
  return r;
end $$;

create or replace function public.rain_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.rain_rounds;
  uid uuid := auth.uid();
  opens timestamptz;
begin
  if not public._setting('coin_rain') then return jsonb_build_object('enabled', false); end if;
  perform public._rain_settle();
  r := public._rain_current();
  opens := r.ends_at - make_interval(mins => r.window_min);
  if now() >= opens and not r.announced then
    update public.rain_rounds set announced = true where id = r.id and not announced;
    if found then
      insert into public.chat_messages (user_id, username, level, body, kind, rain_id)
      values (null, 'Kiša coina', 0, format('Počela je kiša coina! Pot: %s coina, %s mjesta. Pridruži se u sljedeće %s min.',
              replace(to_char(r.pot, 'FM999990D00'), '.', ','), r.slots, r.window_min), 'rain', r.id);
    end if;
  end if;
  return jsonb_build_object(
    'enabled', true, 'id', r.id, 'pot', r.pot, 'ends_at', r.ends_at, 'opens_at', opens, 'now', now(),
    'open', now() >= opens,
    'slots', r.slots,
    'participants', (select count(*) from public.rain_entries where rain_id = r.id),
    'joined', uid is not null and exists (select 1 from public.rain_entries where rain_id = r.id and user_id = uid),
    -- zadnja isplaćena kiša u kojoj je igrač sudjelovao (za obavijest i osvježavanje stanja)
    'my_last', (select jsonb_build_object('id', rr.id, 'paid_each', rr.paid_each)
                  from public.rain_rounds rr join public.rain_entries re on re.rain_id = rr.id
                 where uid is not null and re.user_id = uid and rr.status = 'paid'
                 order by rr.ends_at desc limit 1)
  );
end $$;

create or replace function public.rain_join()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  r public.rain_rounds;
  lvl int;
begin
  if not public._setting('coin_rain') then raise exception 'Kiša coina je isključena.'; end if;
  perform public._rain_settle();
  r := public._rain_current();
  if now() < r.ends_at - make_interval(mins => r.window_min) then raise exception 'Kiša još nije počela.'; end if;
  select level into lvl from public.profiles where id = uid;
  if lvl < 2 then raise exception 'Kiši se možeš pridružiti od levela 2.'; end if;
  perform 1 from public.rain_rounds where id = r.id for update;
  if (select count(*) from public.rain_entries where rain_id = r.id) >= r.slots then
    raise exception 'Kiša je puna — sva mjesta su zauzeta.';
  end if;
  insert into public.rain_entries (rain_id, user_id) values (r.id, uid) on conflict do nothing;
  if not found then raise exception 'Već si se pridružio ovoj kiši.'; end if;
  return public.rain_state();
end $$;

create or replace function public.rain_tip(p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  r public.rain_rounds;
  p public.profiles;
  amt numeric := round(coalesce(p_amount, 0), 2);
begin
  if not public._setting('coin_rain') then raise exception 'Kiša coina je isključena.'; end if;
  if amt < 1 then raise exception 'Najmanji bakšiš je 1 coin.'; end if;
  perform public._rain_settle();
  r := public._rain_current();
  perform public._charge(uid, amt);
  update public.rain_rounds set pot = pot + amt where id = r.id;
  select * into p from public.profiles where id = uid;
  insert into public.game_log (user_id, game, wager, payout, details) values (uid, 'rain_tip', amt, 0, jsonb_build_object('rain', r.id));
  insert into public.chat_messages (user_id, username, level, body, kind, rain_id)
  values (uid, p.username, p.level, format('je dodao %s coina u kišu', replace(to_char(amt, 'FM999990D00'), '.', ',')), 'tip', r.id);
  return public.rain_state();
end $$;

create or replace function public.admin_trigger_rain(p_pot numeric, p_slots int default 20, p_minutes int default 3)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin(); rid bigint;
begin
  if p_pot < 1 or p_pot > 1000000 then raise exception 'Pot mora biti 1–1.000.000.'; end if;
  if p_slots < 1 or p_slots > 500 then raise exception 'Broj mjesta mora biti 1–500.'; end if;
  if p_minutes < 1 or p_minutes > 30 then raise exception 'Trajanje mora biti 1–30 minuta.'; end if;
  perform public._rain_settle();
  insert into public.rain_rounds (ends_at, pot, slots, window_min, manual)
  values (date_trunc('second', now()) + make_interval(mins => p_minutes), p_pot, p_slots, p_minutes, true) returning id into rid;
  perform public._admin_log(a, null, 'trigger_rain', jsonb_build_object('pot', p_pot, 'slots', p_slots, 'minutes', p_minutes));
  return public.rain_state();
end $$;
grant execute on function public.admin_trigger_rain(numeric, int, int) to authenticated;

create or replace function public.get_settings()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, enabled), '{}'::jsonb) from public.site_settings;
$$;

create or replace function public.admin_set_setting(p_key text, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin();
begin
  insert into public.site_settings (key, enabled) values (p_key, p_enabled)
  on conflict (key) do update set enabled = excluded.enabled;
  perform public._admin_log(a, null, 'setting', jsonb_build_object('key', p_key, 'enabled', p_enabled));
end $$;

revoke all on function public._rain_settle() from public, anon, authenticated;
revoke all on function public._rain_current() from public, anon, authenticated;
revoke all on function public._setting(text) from public, anon, authenticated;
grant execute on function public.rain_state() to anon, authenticated;
grant execute on function public.rain_join() to authenticated;
grant execute on function public.rain_tip(numeric) to authenticated;
grant execute on function public.get_settings() to anon, authenticated;
grant execute on function public.admin_set_setting(text, boolean) to authenticated;


-- ---------- JACKPOT (prava runda svake minute, samo pravi igrači) ----------
-- Igrači ulažu tijekom runde (može više puta). Na kraju minute izvlači se pobjednik
-- proporcionalno ulogu; pobjednik dobiva pot − 5%. Ako je ušao samo jedan igrač, ulog mu se vraća.
create table if not exists public.jackpot_rounds (
  id bigserial primary key,
  ends_at timestamptz unique not null,
  status text not null default 'open' check (status in ('open','paid','refunded')),
  pot numeric(14,2) not null default 0,
  winner_id uuid references public.profiles(id) on delete set null,
  ticket numeric,
  payout numeric(14,2),
  players jsonb
);
create table if not exists public.jackpot_bets (
  id bigserial primary key,
  round_id bigint not null references public.jackpot_rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists jackpot_bets_round_idx on public.jackpot_bets(round_id);
alter table public.jackpot_rounds enable row level security;
alter table public.jackpot_bets enable row level security;
drop policy if exists "jackpot read" on public.jackpot_rounds;
create policy "jackpot read" on public.jackpot_rounds for select using (true);

create or replace function public._jackpot_players(p_round bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.first_bet), '[]'::jsonb) from (
    select b.user_id, p.username, p.level, sum(b.amount) as bet, min(b.created_at) as first_bet
      from public.jackpot_bets b join public.profiles p on p.id = b.user_id
     where b.round_id = p_round group by b.user_id, p.username, p.level
  ) x;
$$;

create or replace function public._jackpot_settle()
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.jackpot_rounds;
  pl jsonb;
  n int;
  t numeric;
  acc numeric;
  e jsonb;
  win uuid;
  pay numeric;
  wname text;
begin
  for r in select * from public.jackpot_rounds where status = 'open' and ends_at <= now() order by ends_at for update loop
    pl := public._jackpot_players(r.id);
    n := jsonb_array_length(pl);
    if n = 0 then
      update public.jackpot_rounds set status = 'refunded', players = pl where id = r.id;
    elsif n = 1 then
      -- samo jedan igrač: vrati ulog
      update public.profiles set balance = balance + r.pot where id = (pl->0->>'user_id')::uuid;
      update public.jackpot_rounds set status = 'refunded', players = pl where id = r.id;
    else
      t := random()::numeric * r.pot;
      acc := 0;
      for e in select * from jsonb_array_elements(pl) loop
        acc := acc + (e->>'bet')::numeric;
        win := (e->>'user_id')::uuid;
        wname := e->>'username';
        exit when t < acc;
      end loop;
      pay := round(r.pot * (1 - public._limit('jackpot_fee_pct', 5) / 100), 2);
      for e in select * from jsonb_array_elements(pl) loop
        perform public._apply_wager((e->>'user_id')::uuid, (e->>'bet')::numeric);
      end loop;
      update public.profiles set balance = balance + pay where id = win;
      update public.jackpot_rounds set status = 'paid', players = pl, winner_id = win, ticket = t / r.pot, payout = pay where id = r.id;
      insert into public.game_log (user_id, game, wager, payout, details)
        select (x->>'user_id')::uuid, 'jackpot', (x->>'bet')::numeric, case when (x->>'user_id')::uuid = win then pay else 0 end,
               jsonb_build_object('round', r.id, 'pot', r.pot, 'players', n)
          from jsonb_array_elements(pl) x;
      insert into public.chat_messages (user_id, username, level, body, kind)
      values (null, 'Jackpot', 0, format('%s je osvojio jackpot od %s coina!', wname, replace(to_char(pay, 'FM999990D00'), '.', ',')), 'rain_paid');
    end if;
  end loop;
end $$;

create or replace function public._jackpot_current()
returns public.jackpot_rounds language plpgsql security definer set search_path = public as $$
declare
  sec numeric := greatest(15, public._limit('jackpot_round_sec', 60));
  e timestamptz := to_timestamp(ceil(extract(epoch from now()) / sec) * sec);
  r public.jackpot_rounds;
begin
  select * into r from public.jackpot_rounds where status = 'open' and ends_at > now() order by ends_at limit 1;
  if found then return r; end if;
  -- runda traje barem pola zadanog trajanja (da se ima vremena uložiti)
  if e - now() < make_interval(secs => sec / 2) then e := e + make_interval(secs => sec); end if;
  insert into public.jackpot_rounds (ends_at) values (e) on conflict (ends_at) do nothing;
  select * into r from public.jackpot_rounds where ends_at = e;
  return r;
end $$;

create or replace function public.jackpot_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.jackpot_rounds;
begin
  perform public._jackpot_settle();
  r := public._jackpot_current();
  return jsonb_build_object(
    'id', r.id, 'ends_at', r.ends_at, 'now', now(), 'pot', r.pot,
    'min_bet', public._limit('jackpot_min_bet', 1), 'max_bet', public._limit('jackpot_max_bet', 10000), 'fee_pct', public._limit('jackpot_fee_pct', 5), 'round_sec', public._limit('jackpot_round_sec', 60),
    'players', public._jackpot_players(r.id),
    'last', (select to_jsonb(x) from (
        select jr.id, jr.status, jr.pot, jr.payout, jr.ticket, jr.players, jr.ends_at, jr.winner_id, p.username as winner
          from public.jackpot_rounds jr left join public.profiles p on p.id = jr.winner_id
         where jr.status in ('paid','refunded') and jr.players is not null and jsonb_array_length(jr.players) > 0
         order by jr.ends_at desc limit 1) x),
    'history', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jr.id, jr.pot, jr.payout, p.username as winner, jsonb_array_length(jr.players) as n
          from public.jackpot_rounds jr left join public.profiles p on p.id = jr.winner_id
         where jr.status = 'paid' order by jr.ends_at desc limit 8) x)
  );
end $$;

create or replace function public.jackpot_bet(p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  r public.jackpot_rounds;
  amt numeric := round(coalesce(p_amount, 0), 2);
begin
  if amt < public._limit('jackpot_min_bet', 1) or amt > public._limit('jackpot_max_bet', 10000) then
    raise exception 'Ulog mora biti % – %.', public._limit('jackpot_min_bet', 1), public._limit('jackpot_max_bet', 10000);
  end if;
  perform public._jackpot_settle();
  r := public._jackpot_current();
  if r.ends_at - now() < interval '2 seconds' then raise exception 'Runda se upravo zatvara, pričekaj sljedeću.'; end if;
  perform public._charge(uid, amt);
  insert into public.jackpot_bets (round_id, user_id, amount) values (r.id, uid, amt);
  update public.jackpot_rounds set pot = pot + amt where id = r.id;
  -- ulog (XP) se broji tek kod izvlačenja, jer se ulog može povući
  return public.jackpot_state();
end $$;

-- povuci svoj ulog iz trenutne runde (dok runda još traje)
create or replace function public.jackpot_withdraw()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  r public.jackpot_rounds;
  mine numeric;
begin
  perform public._jackpot_settle();
  select * into r from public.jackpot_rounds where status = 'open' and ends_at > now() order by ends_at limit 1 for update;
  if not found then raise exception 'Nema otvorene runde.'; end if;
  if r.ends_at - now() < interval '3 seconds' then raise exception 'Prekasno, runda se upravo izvlači.'; end if;
  select coalesce(sum(amount), 0) into mine from public.jackpot_bets where round_id = r.id and user_id = uid;
  if mine <= 0 then raise exception 'Nemaš uloga u ovoj rundi.'; end if;
  delete from public.jackpot_bets where round_id = r.id and user_id = uid;
  update public.jackpot_rounds set pot = greatest(0, pot - mine) where id = r.id;
  update public.profiles set balance = balance + mine where id = uid;
  return public.jackpot_state();
end $$;
grant execute on function public.jackpot_withdraw() to authenticated;

-- admin: završi trenutnu rundu odmah (izvlačenje sada)
create or replace function public.admin_jackpot_draw_now()
returns jsonb language plpgsql security definer set search_path = public as $$
declare a uuid := public._admin(); r public.jackpot_rounds;
begin
  select * into r from public.jackpot_rounds where status = 'open' and ends_at > now() order by ends_at limit 1 for update;
  if not found then raise exception 'Nema otvorene runde.'; end if;
  update public.jackpot_rounds set ends_at = now() where id = r.id;
  perform public._jackpot_settle();
  perform public._admin_log(a, null, 'jackpot_draw_now', jsonb_build_object('round', r.id, 'pot', r.pot));
  return public.jackpot_state();
end $$;
grant execute on function public.admin_jackpot_draw_now() to authenticated;

revoke all on function public._jackpot_settle() from public, anon, authenticated;
revoke all on function public._jackpot_current() from public, anon, authenticated;
revoke all on function public._jackpot_players(bigint) from public, anon, authenticated;
grant execute on function public.jackpot_state() to anon, authenticated;
grant execute on function public.jackpot_bet(numeric) to authenticated;

-- ---------- REALTIME (battle lobby uživo) ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.battles;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.battle_players;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.chat_messages;
    exception when duplicate_object then null;
    end;
  end if;
end $$;


-- ===== SEED: automobili =====
insert into public.items (id, brand, model, year, category, body, rarity, value) values
(1, 'Zastava', '750 "Fićo"', 1965, 'Yu klasik', 'classic', 'common', 0.6),
(2, 'Yugo', '45', 1985, 'Yu klasik', 'hatch', 'common', 0.9),
(3, 'Zastava', '101 "Stojadin"', 1978, 'Yu klasik', 'hatch', 'common', 1.2),
(4, 'Zastava', 'Koral In', 1991, 'Yu klasik', 'hatch', 'common', 1.3),
(5, 'Trabant', '601', 1964, 'Istočni blok', 'classic', 'common', 0.8),
(6, 'Fiat', '126p "Peglica"', 1980, 'Istočni blok', 'classic', 'common', 0.7),
(7, 'Wartburg', '353', 1975, 'Istočni blok', 'sedan', 'common', 1.1),
(8, 'Dacia', '1300', 1979, 'Istočni blok', 'sedan', 'common', 1.0),
(9, 'Moskvič', '412', 1972, 'Istočni blok', 'sedan', 'common', 1.4),
(10, 'Lada', '2107', 1988, 'Istočni blok', 'sedan', 'common', 1.8),
(11, 'Lada', 'Niva 4x4', 1977, 'Istočni blok', 'suv', 'common', 2.5),
(12, 'Renault', '4 "Katrca"', 1970, 'Europski klasik', 'hatch', 'common', 1.6),
(13, 'Citroën', '2CV', 1968, 'Europski klasik', 'classic', 'common', 3.5),
(14, 'Volkswagen', 'Golf II', 1987, 'Europski klasik', 'hatch', 'common', 4.0),
(15, 'Mercedes-Benz', 'W123 240D', 1982, 'Europski klasik', 'sedan', 'uncommon', 8.0),
(16, 'Fiat', 'Panda', 2005, 'Gradski', 'hatch', 'common', 0.5),
(17, 'Volkswagen', 'Polo', 2010, 'Gradski', 'hatch', 'common', 0.9),
(18, 'Opel', 'Corsa C', 2003, 'Gradski', 'hatch', 'common', 0.8),
(19, 'Renault', 'Clio II', 2002, 'Gradski', 'hatch', 'common', 1.0),
(20, 'Peugeot', '206', 2001, 'Gradski', 'hatch', 'common', 0.7),
(21, 'Škoda', 'Octavia RS', 2008, 'Gradski', 'sedan', 'common', 2.2),
(22, 'Toyota', 'Corolla', 2004, 'Gradski', 'sedan', 'common', 2.0),
(23, 'Fiat', '500', 1957, 'Europski klasik', 'classic', 'common', 3.0),
(24, 'Volkswagen', 'Buba 1200', 1963, 'Europski klasik', 'classic', 'common', 4.2),
(25, 'Honda', 'Civic Type R EK9', 1997, 'JDM', 'hatch', 'uncommon', 6.0),
(26, 'Mazda', 'MX-5 NA', 1990, 'JDM', 'coupe', 'uncommon', 8.0),
(27, 'Nissan', 'Silvia S15', 1999, 'JDM', 'coupe', 'rare', 30.0),
(28, 'Toyota', 'AE86 Sprinter Trueno', 1985, 'JDM', 'coupe', 'rare', 35.0),
(29, 'Mitsubishi', 'Lancer Evo VI TME', 2000, 'JDM', 'sedan', 'rare', 45.0),
(30, 'Datsun', '240Z', 1970, 'JDM', 'coupe', 'rare', 55.0),
(31, 'Mazda', 'RX-7 FD', 1993, 'JDM', 'coupe', 'rare', 70.0),
(32, 'Toyota', 'Supra MK4', 1998, 'JDM', 'coupe', 'epic', 120.0),
(33, 'Honda', 'NSX NA1', 1991, 'JDM', 'super', 'epic', 160.0),
(34, 'Nissan', 'Skyline GT-R R34', 1999, 'JDM', 'coupe', 'epic', 180.0),
(35, 'Nissan', 'GT-R R35 Nismo', 2022, 'JDM', 'coupe', 'epic', 220.0),
(36, 'Subaru', 'Impreza 22B STi', 1998, 'JDM', 'sedan', 'epic', 260.0),
(37, 'Lexus', 'LFA', 2011, 'JDM', 'super', 'legendary', 900.0),
(38, 'Chevrolet', 'Chevelle SS 454', 1970, 'Muscle', 'muscle', 'rare', 70.0),
(39, 'Chevrolet', 'Camaro Z/28', 1969, 'Muscle', 'muscle', 'rare', 90.0),
(40, 'Dodge', 'Challenger SRT Demon 170', 2023, 'Muscle', 'muscle', 'epic', 110.0),
(41, 'Pontiac', 'GTO "The Judge"', 1969, 'Muscle', 'muscle', 'epic', 120.0),
(42, 'Dodge', 'Charger R/T', 1970, 'Muscle', 'muscle', 'epic', 150.0),
(43, 'Chevrolet', 'Corvette C2 Sting Ray', 1963, 'Muscle', 'coupe', 'epic', 200.0),
(44, 'Ford', 'Mustang Boss 429', 1969, 'Muscle', 'muscle', 'epic', 300.0),
(45, 'Plymouth', 'Hemi ''Cuda', 1971, 'Muscle', 'muscle', 'legendary', 1500.0),
(46, 'Shelby', 'Cobra 427', 1965, 'Muscle', 'classic', 'mythic', 3000.0),
(47, 'Ford', 'GT40 MkII', 1966, 'Muscle', 'super', 'mythic', 8000.0),
(48, 'Ford', 'Model T', 1915, 'Američki', 'classic', 'common', 3.0),
(49, 'Ford', 'Crown Victoria', 2005, 'Američki', 'sedan', 'common', 2.5),
(50, 'Jeep', 'Wrangler YJ', 1990, 'Američki', 'suv', 'uncommon', 12.0),
(51, 'Ford', 'F-150 Raptor', 2017, 'Američki', 'suv', 'rare', 40.0),
(52, 'Chevrolet', 'Bel Air', 1957, 'Američki', 'classic', 'rare', 45.0),
(53, 'Chevrolet', 'Impala SS', 1964, 'Američki', 'classic', 'rare', 50.0),
(54, 'Cadillac', 'Eldorado Biarritz', 1959, 'Američki', 'classic', 'rare', 65.0),
(55, 'Volkswagen', 'Golf GTI Mk1', 1976, 'Njemački', 'hatch', 'uncommon', 15.0),
(56, 'Audi', 'RS2 Avant', 1994, 'Njemački', 'sedan', 'rare', 50.0),
(57, 'BMW', 'M3 E46 CSL', 2003, 'Njemački', 'coupe', 'rare', 85.0),
(58, 'BMW', 'M3 E30 Sport Evolution', 1990, 'Njemački', 'coupe', 'epic', 140.0),
(59, 'Mercedes-Benz', '190E 2.5-16 Evo II', 1990, 'Njemački', 'sedan', 'epic', 160.0),
(60, 'Porsche', '911 GT3 RS (992)', 2023, 'Njemački', 'super', 'epic', 280.0),
(61, 'Audi', 'Sport Quattro S1 E2', 1985, 'Rally', 'hatch', 'legendary', 600.0),
(62, 'BMW', 'M1', 1978, 'Njemački', 'super', 'legendary', 700.0),
(63, 'Mercedes-Benz', 'G63 AMG 6x6', 2014, 'Njemački', 'suv', 'legendary', 750.0),
(64, 'Porsche', '959', 1987, 'Njemački', 'super', 'legendary', 1100.0),
(65, 'Porsche', '911 Carrera RS 2.7', 1973, 'Njemački', 'classic', 'legendary', 1200.0),
(66, 'Porsche', 'Carrera GT', 2004, 'Njemački', 'super', 'legendary', 2000.0),
(67, 'Mercedes-AMG', 'One', 2023, 'Hypercar', 'super', 'mythic', 3500.0),
(68, 'Mercedes-Benz', '300 SL Gullwing', 1955, 'Njemački', 'classic', 'mythic', 4500.0),
(69, 'Fiat', '124 Spider', 1972, 'Talijanski', 'coupe', 'uncommon', 12.0),
(70, 'Alfa Romeo', 'Giulia Quadrifoglio', 2020, 'Talijanski', 'sedan', 'rare', 60.0),
(71, 'Lancia', 'Delta HF Integrale Evo', 1992, 'Rally', 'hatch', 'rare', 65.0),
(72, 'Lamborghini', 'Huracán STO', 2021, 'Talijanski', 'super', 'epic', 330.0),
(73, 'Ferrari', 'Testarossa', 1986, 'Talijanski', 'super', 'epic', 450.0),
(74, 'Lancia', 'Stratos HF', 1974, 'Rally', 'coupe', 'legendary', 800.0),
(75, 'Lamborghini', 'Countach LP400', 1974, 'Talijanski', 'super', 'legendary', 1900.0),
(76, 'Ferrari', 'F40', 1989, 'Talijanski', 'super', 'legendary', 2200.0),
(77, 'Lamborghini', 'Miura P400 SV', 1971, 'Talijanski', 'classic', 'mythic', 2800.0),
(78, 'Maserati', 'MC12', 2004, 'Talijanski', 'super', 'mythic', 3200.0),
(79, 'Ferrari', 'LaFerrari', 2013, 'Hypercar', 'super', 'mythic', 4000.0),
(80, 'Pagani', 'Zonda R', 2009, 'Hypercar', 'super', 'mythic', 6000.0),
(81, 'Alfa Romeo', '33 Stradale', 1967, 'Talijanski', 'classic', 'mythic', 9000.0),
(82, 'Ferrari', '250 GTO', 1962, 'Talijanski', 'classic', 'mythic', 50000.0),
(83, 'Mini', 'Cooper S', 1965, 'Britanski', 'classic', 'uncommon', 18.0),
(84, 'Range Rover', 'Classic', 1972, 'Britanski', 'suv', 'uncommon', 20.0),
(85, 'Land Rover', 'Defender 90', 1995, 'Britanski', 'suv', 'rare', 25.0),
(86, 'Rolls-Royce', 'Phantom', 2018, 'Britanski', 'sedan', 'epic', 400.0),
(87, 'Jaguar', 'E-Type Series 1', 1961, 'Britanski', 'classic', 'legendary', 600.0),
(88, 'Aston Martin', 'DB5', 1964, 'Britanski', 'classic', 'legendary', 1400.0),
(89, 'McLaren', 'P1', 2013, 'Hypercar', 'super', 'mythic', 3000.0),
(90, 'Aston Martin', 'Valkyrie', 2021, 'Hypercar', 'super', 'mythic', 5500.0),
(91, 'McLaren', 'F1', 1992, 'Hypercar', 'super', 'mythic', 20000.0),
(92, 'Subaru', 'Impreza WRX STI', 2004, 'Rally', 'sedan', 'rare', 28.0),
(93, 'Ford', 'Escort RS1600', 1972, 'Rally', 'classic', 'rare', 40.0),
(94, 'Toyota', 'Celica GT-Four ST185', 1992, 'Rally', 'coupe', 'rare', 55.0),
(95, 'Citroën', 'DS3 WRC', 2011, 'Rally', 'hatch', 'rare', 75.0),
(96, 'Peugeot', '205 T16', 1985, 'Rally', 'hatch', 'legendary', 900.0),
(97, 'Bugatti', 'Veyron 16.4', 2005, 'Hypercar', 'super', 'mythic', 3800.0),
(98, 'Rimac', 'Nevera', 2021, 'Hypercar', 'super', 'mythic', 4200.0),
(99, 'Bugatti', 'Chiron Super Sport 300+', 2021, 'Hypercar', 'super', 'mythic', 7000.0),
(100, 'Koenigsegg', 'Jesko Absolut', 2022, 'Hypercar', 'super', 'mythic', 7500.0),
(101, 'Mercedes-Benz', '300 SLR Uhlenhaut Coupé', 1955, 'Hypercar', 'classic', 'mythic', 100000.0),
(102, 'BMW', 'M3 E30 Sport Evolution "Rekord"', 1990, 'Njemački', 'coupe', 'mythic', 200000.0)
on conflict (id) do update set brand=excluded.brand, model=excluded.model, year=excluded.year, category=excluded.category, body=excluded.body, rarity=excluded.rarity, value=excluded.value;
select setval('public.items_id_seq', 102);

-- ===== SEED: kutije =====
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('gradska-guzva', 'Gradska gužva', 'Svakodnevni gradski ljubimci — jeftino i veselo.', 'normal', 1.5, null, 0, null, '#38bdf8', 0) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='gradska-guzva');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (16, 235316), (20, 164180), (18, 142324), (17, 125474), (19, 112099), (22, 53401), (21, 48224), (23, 34607), (14, 25439), (24, 24145), (25, 16486), (26, 12119), (55, 6186)) as v(item_id, w) where c.slug='gradska-guzva';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('yugo-nostalgija', 'Yu nostalgija', 'Fićo, Stojadin, Yugo i ostali junaci naših cesta.', 'normal', 2.5, null, 0, null, '#ef4444', 1) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='yugo-nostalgija');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (1, 90037), (6, 84502), (5, 79984), (2, 76199), (8, 72966), (7, 70159), (3, 67691), (4, 65498), (9, 63530), (12, 60133), (10, 57288), (11, 50044), (13, 43572), (14, 41242), (15, 31007), (55, 23939), (83, 22208)) as v(item_id, w) where c.slug='yugo-nostalgija';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('rally-grupa-b', 'Rally Grupa B', 'Šljunak, skokovi i legende Grupe B.', 'normal', 30.0, null, 0, null, '#f59e0b', 2) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='rally-grupa-b');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (11, 256888), (14, 256888), (92, 256888), (93, 57387), (29, 50711), (94, 41076), (71, 34468), (95, 29659), (36, 8040), (61, 3341), (74, 2470), (96, 2183)) as v(item_id, w) where c.slug='rally-grupa-b';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('jdm-legende', 'JDM legende', 'Turbo, rotacijski motori i noćne vožnje po Tokiju.', 'normal', 40.0, null, 0, null, '#e11d48', 3) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='jdm-legende');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (25, 261391), (26, 232978), (27, 137310), (28, 129100), (29, 63037), (30, 51576), (31, 40524), (32, 23639), (33, 17729), (34, 15759), (35, 12894), (36, 10910), (37, 3152)) as v(item_id, w) where c.slug='jdm-legende';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('britanski-gentleman', 'Britanski gentleman', 'Čaj u pet, DB5 u garaži.', 'normal', 25.0, null, 0, null, '#22c55e', 4) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='britanski-gentleman');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (83, 383899), (84, 375894), (85, 235427), (86, 2788), (87, 1457), (88, 376), (89, 111), (90, 42), (91, 5)) as v(item_id, w) where c.slug='britanski-gentleman';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('muscle-amerika', 'Muscle Amerika', 'V8, dim iz guma i četvrt milje.', 'normal', 60.0, null, 0, null, '#3b82f6', 5) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='muscle-amerika');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (49, 174049), (48, 166294), (50, 117587), (51, 87024), (52, 84499), (53, 82303), (54, 59659), (38, 55398), (39, 43087), (40, 35253), (41, 32315), (42, 25852), (43, 19389), (44, 12926), (45, 2585), (46, 1293), (47, 485)) as v(item_id, w) where c.slug='muscle-amerika';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('njemacka-preciznost', 'Njemačka preciznost', 'Autobahn bez ograničenja.', 'normal', 80.0, null, 0, null, '#a3a3a3', 6) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='njemacka-preciznost');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (55, 499462), (56, 273566), (57, 91713), (58, 47941), (59, 40301), (60, 19470), (61, 7229), (62, 5916), (63, 5409), (64, 3288), (65, 2936), (66, 1511), (67, 730), (68, 527)) as v(item_id, w) where c.slug='njemacka-preciznost';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('talijanska-strast', 'Talijanska strast', 'Rosso corsa i zvuk V12 motora.', 'normal', 120.0, null, 0, null, '#dc2626', 7) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='talijanska-strast');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (69, 507981), (70, 140175), (71, 131481), (72, 147083), (73, 59832), (74, 11280), (75, 918), (76, 600), (77, 298), (78, 202), (79, 106), (80, 33), (81, 10), (82, 1)) as v(item_id, w) where c.slug='talijanska-strast';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('zlatno-doba', 'Zlatno doba oldtajmera', 'Muzejski primjerci za prave kolekcionare.', 'normal', 250.0, null, 0, null, '#d4a017', 8) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='zlatno-doba');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (83, 129913), (30, 129913), (39, 129913), (41, 129913), (42, 129913), (43, 129913), (44, 83966), (73, 47597), (87, 31817), (62, 25641), (65, 12056), (88, 9716), (77, 3682), (46, 3343), (68, 1895), (81, 718), (82, 65), (101, 25)) as v(item_id, w) where c.slug='zlatno-doba';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('sve-ili-nista', 'Sve ili ništa', 'Najvjerojatnije Panda. Možda 250 GTO.', 'normal', 100.0, null, 0, null, '#7c3aed', 9) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='sve-ili-nista');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (16, 218020), (1, 200494), (6, 186780), (20, 186780), (5, 175660), (32, 17557), (45, 5499), (76, 4611), (79, 3503), (82, 1097)) as v(item_id, w) where c.slug='sve-ili-nista';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('hypercar-klub', 'Hypercar klub', 'Samo za one koji ne gledaju cijenu goriva.', 'normal', 800.0, null, 0, null, '#f97316', 10) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='hypercar-klub');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (33, 259123), (60, 259123), (73, 259123), (37, 84645), (75, 26583), (66, 24552), (76, 21180), (89, 13096), (67, 10313), (97, 9078), (79, 8385), (98, 7774), (90, 5118), (80, 4472), (99, 3522), (100, 3165), (91, 692), (101, 57)) as v(item_id, w) where c.slug='hypercar-klub';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('dnevna-bronca', 'Dnevna — bronca', 'Besplatno svaki dan (streak 1–2 dana).', 'daily', 0, null, 0, 1, '#b45309', 11) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='dnevna-bronca');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (16, 191431), (1, 146615), (20, 117016), (6, 117016), (18, 96252), (5, 96252), (17, 81018), (19, 69445), (8, 69445), (14, 9139), (25, 5050), (55, 1322)) as v(item_id, w) where c.slug='dnevna-bronca';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('dnevna-srebro', 'Dnevna — srebro', 'Besplatno svaki dan (streak 3–5 dana).', 'daily', 0, null, 0, 3, '#94a3b8', 12) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='dnevna-srebro');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (16, 293938), (1, 244707), (2, 162781), (3, 121896), (11, 58278), (13, 41552), (14, 36332), (15, 18098), (55, 9619), (83, 8008), (27, 4792)) as v(item_id, w) where c.slug='dnevna-srebro';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('dnevna-zlato', 'Dnevna — zlato', 'Besplatno svaki dan (streak 6+ dana).', 'daily', 0, null, 0, 6, '#eab308', 13) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='dnevna-zlato');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (1, 443485), (3, 231751), (11, 116563), (14, 75066), (15, 39227), (26, 39227), (55, 21776), (85, 13497), (28, 9850), (30, 6451), (32, 3107)) as v(item_id, w) where c.slug='dnevna-zlato';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('gem-garaza', 'Gem garaža', 'Otključaj gemovima.', 'gem', 0, 50, 0, null, '#10b981', 14) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='gem-garaza');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (16, 593678), (14, 104460), (25, 74441), (15, 58535), (26, 58535), (55, 34618), (83, 29726), (27, 19398), (28, 17054), (31, 9556)) as v(item_id, w) where c.slug='gem-garaza';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('gem-salon', 'Gem salon', 'Otključaj gemovima.', 'gem', 0, 250, 0, null, '#06b6d4', 15) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='gem-salon');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (26, 367656), (55, 185776), (85, 106680), (27, 87518), (93, 64036), (29, 56348), (30, 45315), (31, 34875), (32, 19423), (42, 15243), (34, 12505), (73, 4624)) as v(item_id, w) where c.slug='gem-salon';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('gem-trezor', 'Gem trezor', 'Otključaj gemovima.', 'gem', 0, 1000, 0, null, '#8b5cf6', 16) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='gem-trezor');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (29, 390859), (31, 232665), (32, 123565), (34, 76763), (36, 49848), (60, 45694), (86, 30060), (87, 18674), (62, 15583), (64, 9166), (76, 4062), (77, 3060)) as v(item_id, w) where c.slug='gem-trezor';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('level-5', 'Level 5 kutija', 'Besplatno svaka 24h od levela 5.', 'level', 0, null, 5, null, '#64748b', 17) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='level-5');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (16, 347250), (1, 297969), (2, 212006), (14, 60608), (15, 33871), (55, 19982), (83, 17147), (27, 11167)) as v(item_id, w) where c.slug='level-5';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('level-10', 'Level 10 kutija', 'Besplatno svaka 24h od levela 10.', 'level', 0, null, 10, null, '#0ea5e9', 18) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='level-10');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (14, 799766), (15, 91187), (26, 91187), (55, 12727), (85, 2569), (27, 1451), (28, 895), (30, 217)) as v(item_id, w) where c.slug='level-10';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('level-20', 'Level 20 kutija', 'Besplatno svaka 24h od levela 20.', 'level', 0, null, 20, null, '#a855f7', 19) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='level-20');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (26, 623159), (55, 205700), (85, 83573), (93, 36488), (29, 29646), (31, 13603), (32, 5259), (34, 2573)) as v(item_id, w) where c.slug='level-20';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('level-35', 'Level 35 kutija', 'Besplatno svaka 24h od levela 35.', 'level', 0, null, 35, null, '#ec4899', 20) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='level-35');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (85, 504680), (27, 360956), (31, 76031), (32, 28227), (34, 13395), (36, 6814), (60, 5946), (73, 2486), (87, 1465)) as v(item_id, w) where c.slug='level-35';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('level-50', 'Level 50 kutija', 'Besplatno svaka 24h od levela 50.', 'level', 0, null, 50, null, '#f43f5e', 21) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='level-50');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (29, 700855), (32, 143499), (34, 74493), (60, 36462), (86, 20482), (87, 10632), (62, 8287), (64, 3990), (76, 1301)) as v(item_id, w) where c.slug='level-50';

-- ===== DODATNE KUTIJE (RTP 94 %) =====
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('istocni-blok', 'Istočni blok', 'Trabant, Lada, Wartburg i ponekad nešto zapadno.', 'normal', 2.0, null, 0, null, '#94a3b8', 31) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='istocni-blok');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (1, 116516), (6, 103795), (5, 93904), (2, 85964), (8, 79433), (7, 73953), (9, 61717), (10, 51115), (22, 88982), (21, 80893), (11, 71186), (14, 44491), (15, 22246), (26, 22246), (56, 3559)) as v(item_id, w) where c.slug='istocni-blok';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('studentski-budzet', 'Studentski budžet', 'Jeftino, a možda i Supra.', 'normal', 5.0, null, 0, null, '#22c55e', 32) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='studentski-budzet');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (16, 76308), (20, 76308), (18, 76308), (17, 76308), (19, 76308), (12, 76308), (22, 76308), (21, 76308), (13, 76308), (14, 76308), (25, 80655), (26, 60491), (50, 40327), (55, 32262), (27, 16131), (32, 4033), (33, 3025)) as v(item_id, w) where c.slug='studentski-budzet';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('nedjeljna-voznja', 'Nedjeljna vožnja', 'Kabrioleti, klasici i miris benzina.', 'normal', 10.0, null, 0, null, '#38bdf8', 33) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='nedjeljna-voznja');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (23, 128766), (13, 128766), (14, 128766), (24, 128766), (15, 128766), (26, 128766), (69, 59891), (55, 46336), (83, 37572), (84, 33284), (92, 22604), (52, 13099), (30, 10399), (58, 3551), (87, 666)) as v(item_id, w) where c.slug='nedjeljna-voznja';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('drift-kralj', 'Drift kralj', 'Bočno kroz zavoj: Silvia, AE86, RX-7.', 'normal', 20.0, null, 0, null, '#e11d48', 34) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='drift-kralj');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (25, 387193), (26, 387193), (27, 62574), (28, 51211), (29, 36938), (30, 28456), (31, 20798), (32, 10321), (34, 6093), (35, 4694), (36, 3777), (37, 752)) as v(item_id, w) where c.slug='drift-kralj';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('americki-san', 'Američki san', 'Od Crown Victorije do GT40.', 'normal', 35.0, null, 0, null, '#2563eb', 35) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='americki-san');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (49, 236393), (48, 236393), (50, 236393), (51, 51363), (52, 45656), (53, 41090), (54, 31608), (38, 29350), (39, 22828), (40, 18677), (41, 17121), (42, 13697), (43, 10273), (44, 6848), (45, 1370), (46, 685), (47, 257)) as v(item_id, w) where c.slug='americki-san';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('pola-pola', 'Pola-pola', 'Blizu cijene, rijetki skokovi.', 'normal', 50.0, null, 0, null, '#14b8a6', 36) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='pola-pola');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (26, 242861), (55, 117871), (27, 53116), (28, 44487), (51, 38154), (93, 38154), (29, 33321), (52, 33321), (56, 39822), (30, 36899), (94, 36899), (70, 34418), (71, 32283), (31, 30425), (38, 30425), (95, 28791), (57, 26048), (39, 24883), (40, 21193), (32, 19768), (33, 15704), (59, 15704), (87, 5455)) as v(item_id, w) where c.slug='pola-pola';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('muscle-vs-jdm', 'Muscle protiv JDM-a', 'Vječna rasprava, sada u kutiji.', 'normal', 100.0, null, 0, null, '#f59e0b', 37) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='muscle-vs-jdm');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (49, 57870), (48, 57870), (25, 57870), (26, 57870), (27, 57870), (28, 57870), (51, 57870), (29, 57870), (30, 57870), (31, 57870), (38, 57870), (39, 57870), (40, 43960), (32, 40297), (41, 40297), (42, 32237), (33, 30222), (34, 26864), (43, 24178), (35, 21980), (36, 18598), (44, 16119), (37, 5373), (45, 3224), (46, 1612), (47, 604)) as v(item_id, w) where c.slug='muscle-vs-jdm';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('supercar-ulica', 'Supercar ulica', 'Huracán, Testarossa, Countach, F40.', 'normal', 400.0, null, 0, null, '#dc2626', 38) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='supercar-ulica');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (57, 155659), (58, 155659), (59, 155659), (60, 155659), (72, 155659), (73, 66030), (62, 33290), (63, 29914), (74, 27066), (64, 16522), (65, 14437), (75, 7082), (66, 6541), (76, 5642), (77, 3883), (89, 3489), (78, 3157), (97, 2419), (79, 2234)) as v(item_id, w) where c.slug='supercar-ulica';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('kolekcionar', 'Kolekcionar', 'Za one koji skupljaju legende.', 'normal', 1500.0, null, 0, null, '#facc15', 39) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='kolekcionar');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (60, 109868), (72, 97130), (73, 76971), (61, 62033), (87, 62033), (62, 55261), (63, 52474), (74, 49994), (37, 45768), (96, 45768), (64, 39373), (65, 36885), (88, 32858), (45, 27398), (75, 21630), (66, 20548), (76, 18680), (77, 14677), (46, 13699), (89, 13699), (78, 12843), (67, 11742), (97, 10815), (79, 10274), (98, 9785), (68, 9133), (90, 7472), (80, 6849), (99, 5871), (100, 5480), (47, 5137), (81, 4566), (91, 2055), (82, 822), (101, 411)) as v(item_id, w) where c.slug='kolekcionar';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('gem-start', 'Gem start', 'Mala gem kutija za početak.', 'gem', 0, 20, 0, null, '#10b981', 40) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='gem-start');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (16, 70967), (1, 70967), (6, 70967), (20, 70967), (5, 70967), (18, 70967), (12, 70967), (22, 70967), (21, 70967), (11, 70967), (23, 56297), (48, 56297), (13, 48254), (14, 42222), (25, 28148), (15, 21111), (26, 21111), (55, 11259), (27, 5630)) as v(item_id, w) where c.slug='gem-start';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('gem-turbo', 'Gem turbo', 'Gemovi za ozbiljne.', 'gem', 0, 500, 0, null, '#06b6d4', 41) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='gem-turbo');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (26, 82304), (50, 65852), (55, 58246), (83, 52689), (84, 49722), (85, 43980), (92, 41322), (27, 39783), (28, 36550), (51, 33961), (93, 33961), (29, 31831), (52, 31831), (56, 30039), (30, 28505), (94, 28505), (70, 27173), (71, 26191), (31, 24320), (38, 24320), (95, 22699), (57, 20029), (39, 18916), (40, 15477), (32, 14187), (41, 14187), (58, 12160), (42, 11350), (33, 10640), (59, 10640), (34, 9458), (43, 8512), (35, 7738), (36, 6548), (60, 6080), (44, 5675), (72, 5159), (73, 3783), (61, 2837), (87, 2837)) as v(item_id, w) where c.slug='gem-turbo';
insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values ('nino', 'Nino', 'Rizično: najčešće sitniš, ali unutra je rekordni BMW M3 E30 Sport Evolution od 200.000.', 'normal', 500.0, null, 0, null, '#0ea5e9', 42) on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;
delete from public.case_items where case_id = (select id from public.cases where slug='nino');
insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values (102, 1461), (68, 8000), (65, 20000), (64, 30000), (62, 50000), (60, 70000), (59, 80000), (58, 100000), (55, 200000), (16, 146846), (1, 146846), (6, 146846)) as v(item_id, w) where c.slug='nino';


-- Osvježi PostgREST cache da nove/promijenjene funkcije budu odmah vidljive API-ju
notify pgrst, 'reload schema';
