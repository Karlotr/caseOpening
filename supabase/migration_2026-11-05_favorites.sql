-- Omiljene kutije po korisničkom računu (sinkronizirano na svim uređajima).
-- Idempotentno: smije se pokrenuti više puta.
begin;

create table if not exists public.case_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id int not null references public.cases(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, case_id)
);

-- pristup samo preko funkcija ispod
alter table public.case_favorites enable row level security;
revoke all on public.case_favorites from anon, authenticated;

create or replace function public.my_favorite_cases()
returns int[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(case_id order by created_at), '{}')
  from public.case_favorites where user_id = auth.uid();
$$;

-- vraća novo stanje (true = sad je omiljena)
create or replace function public.toggle_favorite_case(p_case int)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Prijavi se.'; end if;
  if exists (select 1 from public.case_favorites where user_id = uid and case_id = p_case) then
    delete from public.case_favorites where user_id = uid and case_id = p_case;
    return false;
  end if;
  if not exists (select 1 from public.cases where id = p_case) then raise exception 'Kutija ne postoji.'; end if;
  if (select count(*) from public.case_favorites where user_id = uid) >= 200 then raise exception 'Najviše 200 omiljenih kutija.'; end if;
  insert into public.case_favorites(user_id, case_id) values (uid, p_case);
  return true;
end $$;

-- jednokratni prijenos starih favorita iz preglednika
create or replace function public.add_favorite_cases(p_cases int[])
returns int[] language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Prijavi se.'; end if;
  insert into public.case_favorites(user_id, case_id)
  select uid, c.id from public.cases c
  where c.id = any(coalesce(p_cases, '{}'))
  limit 200
  on conflict do nothing;
  return public.my_favorite_cases();
end $$;

revoke all on function public.my_favorite_cases() from public, anon;
revoke all on function public.toggle_favorite_case(int) from public, anon;
revoke all on function public.add_favorite_cases(int[]) from public, anon;
grant execute on function public.my_favorite_cases() to authenticated;
grant execute on function public.toggle_favorite_case(int) to authenticated;
grant execute on function public.add_favorite_cases(int[]) to authenticated;

commit;
