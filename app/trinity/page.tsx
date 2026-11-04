"use client";

import { useEffect, useRef, useState } from "react";
import { coins } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { BetInput } from "@/components/BetInput";
import { useLimits } from "@/lib/useLimits";
import { RequireAuth } from "@/components/RequireAuth";
import { useCelebrate } from "@/components/WinOverlay";
import { sfx } from "@/lib/sound";

type Color = "red" | "black" | "gold";
type Res = { slot: number; color: Color; won: boolean; payout: number };

// mora odgovarati play_trinity u SQL-u
const colorOf = (slot: number): Color => (slot === 0 || slot === 15 ? "gold" : slot % 2 === 1 ? "red" : "black");
const SLOTS = 30;
const TILE = 72;
const REPS = 8;
const STYLE: Record<Color, { bg: string; label: string; mult: number; btn: string }> = {
  red: { bg: "bg-red-600", label: "Crvena", mult: 2, btn: "bg-red-600 hover:bg-red-500" },
  black: { bg: "bg-zinc-800", label: "Crna", mult: 2, btn: "bg-zinc-700 hover:bg-zinc-600" },
  gold: { bg: "bg-yellow-400", label: "Zlatna", mult: 14, btn: "bg-yellow-400 text-black hover:bg-yellow-300" },
};

export default function TrinityPage() {
  return (
    <RequireAuth what="igrati Trinity">
      <Trinity />
    </RequireAuth>
  );
}

function Trinity() {
  const rpc = useRpc();
  const toast = useToast();
  const { refresh } = useAuth();
  const limits = useLimits();
  const celebrate = useCelebrate();
  const [bet, setBet] = useState(1);
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const [anim, setAnim] = useState(false);
  const [history, setHistory] = useState<Color[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const strip = Array.from({ length: SLOTS * REPS }, (_, i) => i % SLOTS);

  useEffect(() => {
    const w = box.current?.clientWidth ?? 800;
    setOffset(SLOTS * TILE - w / 2);
  }, []);

  const play = async (pick: Color) => {
    if (busy) return;
    setBusy(true);
    const res = await rpc<Res>("play_trinity", { p_bet: bet, p_color: pick }, { silentRefresh: true });
    if (!res) return setBusy(false);
    const w = box.current?.clientWidth ?? 800;
    const idx = SLOTS * (REPS - 2) + res.slot;
    setAnim(false);
    setOffset(SLOTS * TILE - w / 2);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnim(true);
        setOffset(idx * TILE - w / 2 + TILE / 2 + (Math.random() - 0.5) * TILE * 0.7);
        sfx.spin();
      })
    );
    setTimeout(async () => {
      setHistory((h) => [res.color, ...h].slice(0, 20));
      if (res.won && res.color === "gold") celebrate({ title: "Zlatna 14×!", subtitle: "Trinity", amount: Number(res.payout), tier: 3 });
      else if (res.won) {
        sfx.win(1);
        toast(`${STYLE[res.color].label}! Dobitak ${coins(res.payout)}`, "success");
      } else {
        sfx.lose();
        toast(`Pala je ${STYLE[res.color].label.toLowerCase()}.`, "error");
      }
      await refresh();
      setBusy(false);
    }, 5100);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Trinity</h1>
        <p className="text-sm text-muted">Tri boje: crvena i crna plaćaju 2×, zlatna 14×. Kotač ima 30 polja (14 crvenih, 14 crnih, 2 zlatna).</p>
      </div>
      <div className="flex gap-1">
        {history.map((c, i) => <span key={i} className={`h-6 w-6 rounded ${STYLE[c].bg}`} />)}
      </div>
      <div ref={box} className="card relative h-28 overflow-hidden">
        <div className="flex h-full items-center" style={{ transform: `translateX(${-offset}px)`, transition: anim ? "transform 5s cubic-bezier(0.1,0.65,0.1,1)" : "none" }}>
          {strip.map((s, i) => {
            const c = colorOf(s);
            return (
              <div key={i} className="shrink-0 px-0.5" style={{ width: TILE }}>
                <div className={`grid h-20 place-items-center rounded-md font-display font-bold ${STYLE[c].bg} ${c === "gold" ? "text-black" : "text-white/80"}`}>
                  {c === "gold" ? "★" : s}
                </div>
              </div>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-white shadow-[0_0_12px_white]" />
      </div>
      <div className="card grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-end">
        <BetInput value={bet} onChange={setBet} disabled={busy} min={limits.trinity_min_bet ?? 0.1} max={limits.trinity_max_bet ?? 10000} />
        <div className="grid grid-cols-3 gap-2">
          {(["red", "gold", "black"] as Color[]).map((c) => (
            <button key={c} disabled={busy || bet <= 0} onClick={() => play(c)} className={`rounded-md px-5 py-2 text-sm font-bold transition disabled:opacity-40 ${STYLE[c].btn}`}>
              {STYLE[c].label} {STYLE[c].mult}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
