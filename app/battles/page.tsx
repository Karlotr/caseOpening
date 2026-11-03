"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { getCases } from "@/lib/data";
import { normBattle, type Battle, type BattlePlayer } from "@/lib/battles";
import type { CaseWithItems } from "@/lib/types";
import { coins } from "@/lib/format";
import { CaseArt } from "@/components/CaseCard";

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
  const shown = battles.filter((b) => b.status === tab);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Case Battles</h1>
          <p className="mt-2 max-w-2xl text-muted">Svi otvaraju iste kutije. Klasično pobjeđuje tim s najvećom vrijednošću, u Crazy modu s najmanjom. Pobjednici dijele ukupnu vrijednost na jednake dijelove, sve u coinima. Jackpot pretvara vrijednost u šansu na završnom ruletu i može se uključiti uz Crazy.</p>
        </div>
        <Link href="/battles/create" className="btn-primary px-6 py-3 text-lg">Novi battle</Link>
      </div>
      <div className="flex gap-1">
        <button className={tab === "waiting" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("waiting")}>Otvoreni ({battles.filter((b) => b.status === "waiting").length})</button>
        <button className={tab === "finished" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("finished")}>Završeni</button>
      </div>
      <div className="space-y-2">
        {shown.length === 0 && <div className="card p-8 text-center text-sm text-muted">Nema battleova. Kreiraj prvi!</div>}
        {shown.map((b) => {
          const ps = players.filter((p) => p.battle_id === b.id);
          return (
            <Link key={b.id} href={`/battles/${b.id}`} className="card flex flex-col gap-3 p-3 transition hover:border-white/25 md:flex-row md:items-center">
              <div className="flex w-28 shrink-0 flex-col">
                <span className="font-display text-3xl font-black leading-none">{b.mode}</span>
                <span className="flex gap-1">
                  {b.crazy && <span className="w-fit rounded bg-fuchsia-500/20 px-1.5 text-xs font-bold text-fuchsia-300">Crazy</span>}
                  {b.jackpot && <span className="w-fit rounded bg-emerald-400/20 px-1.5 text-xs font-bold text-emerald-300">Jackpot</span>}
                  {b.sponsored && <span className="w-fit rounded bg-amber-400/20 px-1.5 text-xs font-bold text-amber-300">Besplatan ulaz</span>}
                  {b.fast && <span className="w-fit rounded bg-emerald-400/15 px-1.5 text-xs font-bold text-emerald-300">Brzo</span>}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
                {b.case_ids.map((cid, i) => {
                  const c = byId.get(cid);
                  return c ? <CaseArt key={i} c={c} className="h-12 w-20 shrink-0 " /> : <div key={i} className="h-12 w-20 shrink-0 rounded bg-white/5" />;
                })}
              </div>
              <div className="flex shrink-0 gap-1">
                {Array.from({ length: b.seats }).map((_, s) => {
                  const p = ps.find((x) => x.seat === s);
                  const win = b.status === "finished" && p && p.team === b.winner_team;
                  return (
                    <div key={s} title={p?.name ?? "Slobodno"} className={`grid h-8 w-8 place-items-center rounded-md border text-[10px] font-bold ${p ? (win ? "border-accent bg-accent/20 text-accent" : "border-line bg-panel2") : "border-dashed border-line text-muted"}`}>
                      {p ? p.name.replace("Bot ", "").slice(0, 2).toUpperCase() : "+"}
                    </div>
                  );
                })}
              </div>
              <div className="w-32 shrink-0 text-right">
                <div className="font-display text-2xl font-bold text-accent">{b.sponsored ? <span className="text-amber-300">Besplatno</span> : <><span className="coin" /> {coins(b.cost)}</>}</div>
                <div className="text-xs text-muted">{b.case_ids.length} rundi</div>
              </div>
              <span className={b.status === "waiting" ? "btn-primary" : "btn-ghost"}>{b.status === "waiting" ? "Uđi" : "Pogledaj"}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
