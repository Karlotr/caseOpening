-- Migracija 5.11. (2): tester uloga. Pokreni u Supabase SQL editoru (sigurno za ponovno pokretanje).
begin;

-- ---------- TESTER uloga: ograničeni admin panel (smije samo sebi dodati coine/gemove) ----------
alter table public.user_controls drop constraint if exists user_controls_role_check;
alter table public.user_controls add constraint user_controls_role_check check (role in ('user','admin','tester'));

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.user_controls where user_id = auth.uid()), 'user');
$$;

create or replace function public.tester_add_self(p_balance numeric default 0, p_gems numeric default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  r text := public.my_role();
  b numeric := round(coalesce(p_balance, 0), 2);
  g numeric := round(coalesce(p_gems, 0), 2);
  p public.profiles;
begin
  if r not in ('tester', 'admin') then raise exception 'Samo za testere.'; end if;
  if b < 0 or g < 0 then raise exception 'Tester može samo dodavati.'; end if;
  if b = 0 and g = 0 then raise exception 'Upiši iznos.'; end if;
  if b > 1000000 or g > 1000000 then raise exception 'Najviše 1.000.000 odjednom.'; end if;
  update public.profiles set balance = balance + b, gems = gems + g where id = uid returning * into p;
  perform public._admin_log(uid, uid, 'tester_add', jsonb_build_object('balance', b, 'gems', g));
  return jsonb_build_object('balance', p.balance, 'gems', p.gems);
end $$;

grant execute on function public.my_role() to authenticated;
grant execute on function public.tester_add_self(numeric, numeric) to authenticated;

commit;
