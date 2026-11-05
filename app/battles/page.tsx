"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { getCases } from "@/lib/data";
import { normBattle, type Battle, type BattlePlayer } from "@/lib/battles";
import type { CaseWithItems } from "@/lib/types";
import { CaseArt } from "@/components/CaseCard";
import { Price } from "@/components/Price";
import { useNow } from "@/lib/useNow";

export default function BattlesPage() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [players, setPlayers] = useState<BattlePlayer[]>([]);
  const [cases, setCases] = useState<CaseWithItems[]>([]);
  const [tab, setTab] = useState<"waiting" | "finished">("waiting");

  const load = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb.from("battles").select("*").eq("private", false).in("status", ["waiting", "finished"]).order("created_at", { ascending: false }).limit(40);
    const list = (data ?? []).map(normBattle);
    setBattles(list);
    if (list.length) {
      const { data: p } = await sb.from("battle_players").select("*").in("battle_id", list.map((b) => b.id));
      setPlayers((p ?? []) as BattlePlayer[]);
    }
  }, []);

  useEffect(() => {
    getCases().then(setCases).catch(() => {});
    load();
    const sb = createClient();
    const ch = sb
      .channel("battles-lobby")
      .on("postgres_changes", { event: "*", schema: "public", table: "battles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_players" }, () => load())
      .subscribe();
    const t = setInterval(load, 15000);
    return () => {
      sb.removeChannel(ch);
      clearInterval(t);
    };
  }, [load]);

  const byId = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  const now = useNow(2000) ?? 0;
  // battle "traje" dok se kod gledatelja još vrti animacija (procjena trajanja reprodukcije)
  const live = (b: Battle) => {
    if (b.status !== "finished" || !b.finished_at || !now) return false;
    const est = 1500 + b.case_ids.length * (b.fast ? 1400 : 6500) + (b.jackpot ? 8000 : 0);
    return now - new Date(b.finished_at).getTime() < est;
  };
  const open = battles
    .filter((b) => b.status === "waiting" || live(b))
    .sort((x, y) => (x.status === y.status ? +new Date(y.created_at) - +new Date(x.created_at) : x.status === "waiting" ? -1 : 1));
  const done = battles.filter((b) => b.status === "finished" && !live(b));
  const shown = tab === "waiting" ? open : done;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Case Battles</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Svi otvaraju iste kutije. Klasično pobjeđuje tim s najvećom vrijednošću, u Crazy modu s najmanjom. Pobjednici dijele ukupnu vrijednost na jednake dijelove, sve u coinima. Jackpot pretvara vrijednost u šansu na završnom ruletu i može se uključiti uz Crazy.</p>
        </div>
        <Link href="/battles/create" className="btn-primary px-6 py-3 text-lg">Novi battle</Link>
      </div>
      <div className="flex gap-1">
        <button className={tab === "waiting" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("waiting")}>Otvoreni ({open.length})</button>
        <button className={tab === "finished" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("finished")}>Završeni</button>
      </div>
      <div className="space-y-2">
        {shown.length === 0 && <div className="card p-8 text-center text-sm text-muted">{tab === "waiting" ? "Nema otvorenih battleova. Kreiraj prvi!" : "Nema završenih battleova."}</div>}
        {shown.map((b) => {
          const ps = players.filter((p) => p.battle_id === b.id);
          const running = live(b);
          const MAX = 8;
          return (
            <Link
              key={b.id}
              href={`/battles/${b.id}`}
              className={`card grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 p-3 transition hover:border-white/25 lg:grid-cols-[9.5rem_minmax(0,1fr)_auto_7.5rem_6.5rem] ${running ? "border-emerald-400/40" : ""}`}
            >
              <div className="min-w-0">
                <span className="font-display text-3xl font-black leading-none">{b.mode}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {running && <span className="rounded bg-emerald-400 px-1.5 text-xs font-bold text-ink">U tijeku</span>}
                  {b.crazy && <span className="rounded bg-fuchsia-500/20 px-1.5 text-xs font-bold text-fuchsia-300">Crazy</span>}
                  {b.jackpot && <span className="rounded bg-emerald-400/20 px-1.5 text-xs font-bold text-emerald-300">Jackpot</span>}
                  {b.sponsored && <span className="rounded bg-amber-400/20 px-1.5 text-xs font-bold text-amber-300">Besplatan ulaz</span>}
                  {b.fast && <span className="rounded bg-emerald-400/15 px-1.5 text-xs font-bold text-emerald-300">Brzo</span>}
                  {b.currency === "gems" && <span className="rounded bg-emerald-400/15 px-1.5 text-xs font-bold text-emerald-300">Gem</span>}
                </div>
              </div>
              <div className="order-3 col-span-2 flex min-w-0 items-center gap-2 lg:order-none lg:col-span-1">
                <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden [mask-image:linear-gradient(90deg,#000_85%,transparent)]">
                  {b.case_ids.slice(0, MAX).map((cid, i) => {
                    const c = byId.get(cid);
                    return c ? <CaseArt key={i} c={c} className="h-12 w-20 shrink-0" /> : <div key={i} className="h-12 w-20 shrink-0 rounded bg-white/5" />;
                  })}
                </div>
                {b.case_ids.length > 1 && <span className="shrink-0 rounded-md bg-panel2 px-2 py-1 font-display text-sm font-bold text-muted">{b.case_ids.length}×</span>}
              </div>
              <div className="order-4 flex flex-wrap gap-1 lg:order-none">
                {Array.from({ length: b.seats }).map((_, s) => {
                  const p = ps.find((x) => x.seat === s);
                  const win = b.status === "finished" && !running && p && p.team === b.winner_team;
                  return (
                    <div key={s} title={p?.name ?? "Slobodno"} className={`grid h-8 w-8 place-items-center rounded-md border text-[10px] font-bold ${p ? (win ? "border-accent bg-accent/20 text-accent" : "border-line bg-panel2") : "border-dashed border-line text-muted"}`}>
                      {p ? p.name.replace("Bot ", "").slice(0, 2).toUpperCase() : "+"}
                    </div>
                  );
                })}
              </div>
              <div className="order-2 text-right lg:order-none">
                <div className="font-display text-2xl font-bold text-accent">{b.sponsored ? <span className="text-amber-300">Besplatno</span> : <Price amount={b.cost} gems={b.currency === "gems"} />}</div>
                <div className="text-xs text-muted">{b.case_ids.length} {b.case_ids.length === 1 ? "runda" : "rundi"}</div>
              </div>
              <span className={`order-5 text-center lg:order-none ${b.status === "waiting" ? "btn-primary" : running ? "btn-ghost border-emerald-400/50 text-emerald-300" : "btn-ghost"}`}>{b.status === "waiting" ? "Uđi" : running ? "Gledaj" : "Pogledaj"}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
