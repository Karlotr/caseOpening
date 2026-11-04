"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { coins } from "@/lib/format";
import { useAuth } from "@/components/AuthProvider";

type Row = { username: string; level: number; wagered: number; won: number; best: number; games: number };
type Period = "day" | "week" | "month";
const TABS: [Period, string][] = [["day", "Danas"], ["week", "Ovaj tjedan"], ["month", "Ovaj mjesec"]];
const MEDAL = ["#ffc53d", "#c9d3e3", "#d8894a"];

export default function LeaderboardPage() {
  const { profile } = useAuth();
  const [period, setPeriod] = useState<Period>("day");
  const [data, setData] = useState<Record<Period, { rows: Row[]; updated_at: string } | undefined>>({ day: undefined, week: undefined, month: undefined });

  useEffect(() => {
    const load = () =>
      createClient()
        .rpc("leaderboard_period", { p_period: period })
        .then(({ data: d }) => d && setData((x) => ({ ...x, [period]: d as { rows: Row[]; updated_at: string } })));
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [period]);

  const cur = data[period];
  const rows = (cur?.rows ?? []).map((r) => ({ ...r, wagered: Number(r.wagered), won: Number(r.won), best: Number(r.best) }));
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Ljestvica</h1>
          <p className="mt-2 text-muted">Poredak po ukupno odigranim coinima. Osvježava se svakih 5 minuta.</p>
        </div>
        <div className="flex gap-1" role="tablist">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={period === k} onClick={() => setPeriod(k)} className={`rounded-md border px-4 py-2 font-display text-lg font-bold ${period === k ? "border-accent bg-accent text-ink" : "border-line hover:border-white/30"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {!cur ? (
        <div className="card h-64 animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-muted">Još nitko nije igrao u ovom razdoblju. Budi prvi na ljestvici!</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {top.map((r, i) => (
              <div key={r.username} className={`card relative overflow-hidden p-4 ${i === 0 ? "sm:order-2 sm:-translate-y-2" : i === 1 ? "sm:order-1" : "sm:order-3"}`} style={{ borderColor: MEDAL[i] + "88", boxShadow: `0 0 40px -18px ${MEDAL[i]}` }}>
                <div className="absolute -right-3 -top-6 font-display text-[110px] font-black leading-none opacity-10" style={{ color: MEDAL[i] }}>{i + 1}</div>
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full font-display text-xl font-black text-ink" style={{ background: MEDAL[i] }}>{i + 1}</span>
                  <div className="min-w-0">
                    <div className={`truncate font-display text-2xl font-black ${r.username === profile?.username ? "text-accent2" : ""}`}>{r.username}</div>
                    <div className="text-xs text-muted">Level {r.level} · {r.games} igara</div>
                  </div>
                </div>
                <div className="mt-3 font-display text-3xl font-black text-accent"><span className="coin" /> {coins(r.wagered)}</div>
                <div className="text-xs text-muted">Najveći dobitak {coins(r.best)}</div>
              </div>
            ))}
          </div>
          {rest.length > 0 && (
            <div className="card divide-y divide-line">
              {rest.map((r, i) => (
                <div key={r.username} className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[2.5rem_minmax(0,1fr)_7rem_9rem] ${r.username === profile?.username ? "bg-accent2/10" : ""}`}>
                  <span className="font-display text-lg font-bold text-muted">{i + 4}</span>
                  <span className="truncate font-semibold">{r.username} <span className="text-xs font-normal text-muted">lvl {r.level}</span></span>
                  <span className="hidden text-right text-sm text-muted sm:block">max {coins(r.best)}</span>
                  <span className="text-right font-display text-lg font-bold text-accent">{coins(r.wagered)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted">Zadnje osvježeno {new Date(cur.updated_at).toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" })}.</p>
        </>
      )}
    </div>
  );
}
