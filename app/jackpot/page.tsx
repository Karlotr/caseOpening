"use client";

import { useRef, useState } from "react";
import { coins } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { BetInput } from "@/components/BetInput";
import { RequireAuth } from "@/components/RequireAuth";
import { useCelebrate } from "@/components/WinOverlay";
import { sfx } from "@/lib/sound";

type P = { name: string; bet: number; is_you: boolean };
type Res = { players: P[]; pot: number; winner: number; won: boolean; payout: number };
const COLORS = ["#facc15", "#ef4444", "#3b82f6", "#10b981", "#a855f7", "#f97316", "#06b6d4", "#ec4899"];
const TILE = 110;
const WIN = 48;

export default function JackpotPage() {
  return (
    <RequireAuth what="igrati Jackpot">
      <Jackpot />
    </RequireAuth>
  );
}

function Jackpot() {
  const rpc = useRpc();
  const toast = useToast();
  const { refresh } = useAuth();
  const celebrate = useCelebrate();
  const [bet, setBet] = useState(5);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Res | null>(null);
  const [strip, setStrip] = useState<number[]>([]);
  const [offset, setOffset] = useState(0);
  const [anim, setAnim] = useState(false);
  const [done, setDone] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const play = async () => {
    if (busy) return;
    setBusy(true);
    setDone(false);
    const r = await rpc<Res>("play_jackpot", { p_bet: bet }, { silentRefresh: true });
    if (!r) return setBusy(false);
    r.players = r.players.map((p) => ({ ...p, bet: Number(p.bet) }));
    r.pot = Number(r.pot);
    // traka avatara proporcionalna ulozima
    const pick = () => {
      let x = Math.random() * r.pot;
      for (let i = 0; i < r.players.length; i++) {
        x -= r.players[i].bet;
        if (x <= 0) return i;
      }
      return 0;
    };
    const s = Array.from({ length: 60 }, pick);
    s[WIN] = r.winner;
    setRes(r);
    setStrip(s);
    setAnim(false);
    setOffset(0);
    setTimeout(() => {
      const w = box.current?.clientWidth ?? 800;
      requestAnimationFrame(() => {
        setAnim(true);
        setOffset(WIN * TILE - w / 2 + TILE / 2 + (Math.random() - 0.5) * TILE * 0.6);
        sfx.spin();
      });
    }, 900);
    setTimeout(async () => {
      setDone(true);
      if (r.won) celebrate({ title: "Jackpot!", subtitle: `Šansa je bila ${((bet / r.pot) * 100).toFixed(1)}%`, amount: Number(r.payout), tier: bet / r.pot < 0.25 ? 3 : 2 });
      else {
        sfx.lose();
        toast(`Jackpot je otišao igraču ${r.players[r.winner].name}.`, "error");
      }
      await refresh();
      setBusy(false);
    }, 6100);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Jackpot</h1>
        <p className="text-sm text-muted">Uđi u pot s ostalim vozačima. Što veći ulog, veća šansa. Pobjednik uzima cijeli pot (−5% provizije).</p>
      </div>
      <div className="card grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-end">
        <BetInput value={bet} onChange={setBet} disabled={busy} min={1} />
        <button className="btn-primary h-10 min-w-44" disabled={busy || bet < 1} onClick={play}>{busy ? "Runda u tijeku..." : "Uđi u jackpot"}</button>
      </div>

      {res && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">Pot</span>
              <span className="font-display text-xl text-accent"><span className="coin" /> {coins(res.pot)}</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full">
              {res.players.map((p, i) => <div key={i} style={{ width: `${(p.bet / res.pot) * 100}%`, background: COLORS[i % COLORS.length] }} />)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {res.players.map((p, i) => (
                <div key={i} className={`flex items-center gap-2 rounded-md border p-2 text-sm ${done && i === res.winner ? "border-accent bg-accent/10" : "border-line"}`}>
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="min-w-0 flex-1 truncate">{p.name}{p.is_you && " (ti)"}</span>
                  <span className="text-xs text-muted">{((p.bet / res.pot) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div ref={box} className="card relative h-28 overflow-hidden">
            <div className="flex h-full items-center" style={{ transform: `translateX(${-offset}px)`, transition: anim ? "transform 5s cubic-bezier(0.1,0.65,0.1,1)" : "none" }}>
              {strip.map((pi, i) => {
                const p = res.players[pi];
                return (
                  <div key={i} className="shrink-0 px-1" style={{ width: TILE }}>
                    <div className="grid h-20 place-items-center rounded-lg border-2 bg-panel2 text-center" style={{ borderColor: COLORS[pi % COLORS.length] }}>
                      <div className="px-1">
                        <div className="font-display text-lg font-bold" style={{ color: COLORS[pi % COLORS.length] }}>{p.name.slice(0, 2).toUpperCase()}</div>
                        <div className="truncate text-[10px] text-muted">{p.name}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-accent shadow-[0_0_12px_#facc15]" />
          </div>
        </div>
      )}
    </div>
  );
}
