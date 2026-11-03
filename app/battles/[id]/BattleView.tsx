"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { getCases, getItems, randomFromCase } from "@/lib/data";
import { loadBattle, type Battle, type BattleDrop, type BattlePlayer } from "@/lib/battles";
import type { CaseWithItems, Item } from "@/lib/types";
import { coins } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { CaseArt } from "@/components/CaseCard";
import { ItemCard } from "@/components/ItemCard";
import { Reel } from "@/components/Reel";

const WIN = 32;

export function BattleView() {
  const { id } = useParams<{ id: string }>();
  const { user, refresh } = useAuth();
  const rpc = useRpc();
  const toast = useToast();
  const [battle, setBattle] = useState<Battle | null>(null);
  const [players, setPlayers] = useState<BattlePlayer[]>([]);
  const [drops, setDrops] = useState<BattleDrop[]>([]);
  const [cases, setCases] = useState<Map<number, CaseWithItems>>(new Map());
  const [items, setItems] = useState<Map<number, Item>>(new Map());
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  // animacija
  const [revealed, setRevealed] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [strips, setStrips] = useState<Item[][]>([]);
  const [spinKey, setSpinKey] = useState(0);
  const decided = useRef(false);

  const reload = useCallback(async () => {
    const r = await loadBattle(id);
    if (!r.battle) return setNotFound(true);
    setBattle(r.battle);
    setPlayers(r.players);
    setDrops(r.drops);
  }, [id]);

  useEffect(() => {
    getCases().then((c) => setCases(new Map(c.map((x) => [x.id, x]))));
    getItems().then((i) => setItems(new Map(i.map((x) => [x.id, x]))));
    reload();
    const sb = createClient();
    const ch = sb
      .channel(`battle-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "battles", filter: `id=eq.${id}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_players", filter: `battle_id=eq.${id}` }, () => reload())
      .subscribe();
    const t = setInterval(() => {
      if (!decided.current) reload();
    }, 4000);
    return () => {
      sb.removeChannel(ch);
      clearInterval(t);
    };
  }, [id, reload]);

  const rounds = battle?.case_ids.length ?? 0;

  const spinRound = useCallback(
    (r: number) => {
      if (!battle) return;
      const c = cases.get(battle.case_ids[r]);
      if (!c) return;
      const s = Array.from({ length: battle.seats }, (_, seat) => {
        const strip = Array.from({ length: 40 }, () => randomFromCase(c));
        const d = drops.find((x) => x.round === r + 1 && x.seat === seat);
        if (d && items.get(d.item_id)) strip[WIN] = items.get(d.item_id)!;
        return strip;
      });
      setStrips(s);
      setSpinning(true);
      setSpinKey((k) => k + 1);
    },
    [battle, cases, drops, items]
  );

  // kad battle završi: animiraj ako je svjež, inače odmah pokaži rezultat
  useEffect(() => {
    if (decided.current || !battle || battle.status !== "finished" || !drops.length || !cases.size || !items.size) return;
    decided.current = true;
    const age = Date.now() - new Date(battle.finished_at ?? battle.created_at).getTime();
    if (age < 90_000) {
      setRevealed(0);
      setTimeout(() => spinRound(0), 400);
    } else {
      setRevealed(rounds);
    }
  }, [battle, drops, cases, items, rounds, spinRound]);

  const onRoundDone = useCallback(() => {
    setSpinning(false);
    setRevealed((r) => {
      const next = r + 1;
      if (next < rounds) setTimeout(() => spinRound(next), 700);
      else refresh();
      return next;
    });
  }, [rounds, spinRound, refresh]);

  const totals = useMemo(() => {
    const t = new Map<number, number>();
    drops.filter((d) => d.round <= revealed).forEach((d) => t.set(d.seat, (t.get(d.seat) ?? 0) + (items.get(d.item_id)?.value ?? 0)));
    return t;
  }, [drops, revealed, items]);

  if (notFound) return <div className="card p-8 text-center">Battle ne postoji. <Link href="/battles" className="text-accent">Natrag</Link></div>;
  if (!battle) return <div className="card h-96 animate-pulse" />;

  const done = battle.status === "finished" && revealed >= rounds;
  const meIn = players.some((p) => p.user_id === user?.id);
  const isCreator = user?.id === battle.creator_id;
  const teams = Array.from({ length: battle.seats / battle.team_size }, (_, t) => Array.from({ length: battle.team_size }, (_, i) => t * battle.team_size + i));

  const act = async (fn: string, args: Record<string, unknown>, msg?: string) => {
    setBusy(true);
    const r = await rpc(fn, args);
    setBusy(false);
    if (r && msg) toast(msg, "success");
    await reload();
  };

  const replay = () => {
    setRevealed(0);
    spinRound(0);
  };

  const myWin = done && players.find((p) => p.user_id === user?.id)?.team === battle.winner_team;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href="/battles" className="hover:text-fg">Battles</Link> <span>/</span>
        <span className="font-display text-fg">{battle.mode}</span>
        {battle.crazy && <span className="rounded bg-fuchsia-500/20 px-1.5 text-[10px] font-bold uppercase text-fuchsia-300">Crazy</span>}
        <span className="ml-auto">Ulaz: <span className="text-accent"><span className="coin" /> {coins(battle.cost)}</span></span>
        {battle.status === "finished" && <span>· Ukupno: <span className="text-accent">{coins(battle.total_value)}</span></span>}
      </div>

      <div className="card flex gap-1.5 overflow-x-auto p-2">
        {battle.case_ids.map((cid, i) => {
          const c = cases.get(cid);
          const active = battle.status === "finished" && (spinning ? i === revealed : i < revealed);
          return c ? (
            <div key={i} className={`shrink-0 rounded-lg p-0.5 ${spinning && i === revealed ? "ring-2 ring-accent" : active ? "opacity-60" : ""}`}>
              <CaseArt c={c} className="h-14 w-24 [&_svg]:h-9 [&_svg]:w-20" />
            </div>
          ) : null;
        })}
        <div className="ml-auto self-center whitespace-nowrap px-3 font-display text-sm text-muted">
          Runda {Math.min(revealed + (spinning ? 1 : 0), rounds)}/{rounds}
        </div>
      </div>

      {battle.status === "waiting" && (
        <div className="card flex flex-wrap items-center gap-3 p-3">
          <span className="text-sm text-muted">Čeka se igrače ({players.length}/{battle.seats})…</span>
          {isCreator && (
            <div className="ml-auto flex gap-2">
              <button className="btn-primary" disabled={busy} onClick={() => act("fill_battle_bots", { p_id: battle.id })}>🤖 Popuni botovima i kreni</button>
              {players.length === 1 && <button className="btn-ghost" disabled={busy} onClick={() => act("cancel_battle", { p_id: battle.id }, "Battle otkazan, coini vraćeni.")}>Otkaži</button>}
            </div>
          )}
        </div>
      )}
      {battle.status === "cancelled" && <div className="card p-3 text-sm text-muted">Ovaj battle je otkazan.</div>}

      {done && (
        <div className={`pop card flex flex-wrap items-center gap-3 p-4 ${myWin ? "border-accent" : ""}`}>
          <span className="checker h-8 w-8 rounded" />
          <div className="font-display text-lg font-bold">
            {myWin ? "Pobijedio si! Svi automobili su u tvojoj garaži." : `Pobjednik: ${teams[battle.winner_team ?? 0].map((s) => players.find((p) => p.seat === s)?.name).join(" & ")}`}
          </div>
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost" onClick={replay}>↻ Replay</button>
            {myWin && <Link className="btn-primary" href="/profile">Garaža</Link>}
          </div>
        </div>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-2 md:min-w-0">
          {teams.map((seats, ti) => (
            <Fragment key={ti}>
              {ti > 0 && <div className="grid w-8 shrink-0 place-items-center font-display text-lg font-bold text-accent">VS</div>}
              <div className={`flex flex-1 gap-2 rounded-xl ${done && battle.winner_team === ti ? "bg-accent/10 ring-1 ring-accent/50" : ""} p-1`}>
                {seats.map((seat) => {
                  const p = players.find((x) => x.seat === seat);
                  const mine = drops.filter((d) => d.seat === seat && d.round <= revealed).sort((a, b) => b.round - a.round);
                  return (
                    <div key={seat} className="w-44 flex-1 space-y-2 md:w-auto md:min-w-36">
                      <div className="card flex items-center gap-2 p-2">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-xs font-bold ${p ? (p.is_bot ? "bg-sky-500/20 text-sky-300" : "bg-accent text-black") : "border border-dashed border-line text-muted"}`}>
                          {p ? (p.is_bot ? "🤖" : p.name.slice(0, 2).toUpperCase()) : "?"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{p?.name ?? "Slobodno mjesto"}</div>
                          <div className="font-display text-xs text-accent">{coins(totals.get(seat) ?? 0)}</div>
                        </div>
                      </div>
                      {battle.status === "waiting" ? (
                        <div className="card grid h-[312px] place-items-center p-3 text-center">
                          {p ? (
                            <span className="text-sm text-emerald-400">Spreman ✓</span>
                          ) : user && !meIn ? (
                            <button className="btn-primary" disabled={busy} onClick={() => act("join_battle", { p_id: battle.id, p_seat: seat }, "Pridružio si se battleu!")}>
                              Pridruži se<br />{coins(battle.cost)}
                            </button>
                          ) : !user ? (
                            <Link href="/login" className="btn-ghost">Prijavi se</Link>
                          ) : (
                            <span className="text-sm text-muted">Čeka igrača…</span>
                          )}
                        </div>
                      ) : spinning && strips[seat] ? (
                        <Reel vertical items={strips[seat]} winnerIndex={WIN} spinKey={spinKey} duration={3200} onDone={seat === 0 ? onRoundDone : undefined} />
                      ) : null}
                      <div className="space-y-1.5">
                        {mine.map((d) => {
                          const it = items.get(d.item_id);
                          return it ? <div key={d.round} className={d.round === revealed ? "pop" : ""}><ItemCard item={it} size="sm" /></div> : null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
