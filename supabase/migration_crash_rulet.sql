-- Jednokratna migracija: Trinity → Rulet, Slide → Crash.
-- Pokreni u Supabase SQL editoru u isto vrijeme kad deployaš novi frontend
-- (stari frontend zove play_slide / play_trinity, koji nakon ovoga više ne postoje).
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

-- ---------- CRASH (multiplikator, 4% house edge) ----------
create or replace function public.play_crash(p_bet numeric, p_target numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._uid();
  r numeric;
  m numeric;
  won boolean;
  payout numeric := 0;
  lvl jsonb;
begin
  if p_bet < public._limit('crash_min_bet', 0.1) or p_bet > public._limit('crash_max_bet', 10000) then
    raise exception 'Ulog mora biti % – %.', public._limit('crash_min_bet', 0.1), public._limit('crash_max_bet', 10000);
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
  values (uid, 'crash', p_bet, payout, jsonb_build_object('target', p_target, 'result', m));
  return jsonb_build_object('result', m, 'won', won, 'payout', payout) || lvl;
end $$;

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


grant execute on function public.play_crash(numeric, numeric) to authenticated;
grant execute on function public.play_rulet(numeric, text) to authenticated;

commit;
