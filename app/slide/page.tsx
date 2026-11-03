"use client";

import { useEffect, useRef, useState } from "react";
import { coins } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { BetInput } from "@/components/BetInput";
import { RequireAuth } from "@/components/RequireAuth";

type Res = { result: number; won: boolean; payout: number };
const TILE = 96;
const WIN = 54;
const randMult = () => Math.max(1, Math.min(1000, Math.floor(96 / (1 - Math.random())) / 100));

export default function SlidePage() {
  return (
    <RequireAuth what="igrati Slide">
      <Slide />
    </RequireAuth>
  );
}

function Slide() {
  const rpc = useRpc();
  const toast = useToast();
  const { refresh } = useAuth();
  const [bet, setBet] = useState(1);
  const [target, setTarget] = useState(2);
  const [strip, setStrip] = useState<number[]>([]);
  const [offset, setOffset] = useState(0);
  const [anim, setAnim] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<number[]>([]);
  const [shownTarget, setShownTarget] = useState(2);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setStrip(Array.from({ length: 70 }, randMult)), []);

  const play = async () => {
    if (busy) return;
    setBusy(true);
    const res = await rpc<Res>("play_slide", { p_bet: bet, p_target: target }, { silentRefresh: true });
    if (!res) return setBusy(false);
    const m = Number(res.result);
    const s = Array.from({ length: 70 }, randMult);
    s[WIN] = m;
    setShownTarget(target);
    setStrip(s);
    setAnim(false);
    setOffset(0);
    const w = box.current?.clientWidth ?? 800;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnim(true);
        setOffset(WIN * TILE - w / 2 + TILE / 2 + (Math.random() - 0.5) * TILE * 0.6);
      })
    );
    setTimeout(async () => {
      setLast((l) => [m, ...l].slice(0, 14));
      toast(res.won ? `Slide ${m.toFixed(2)}x — dobitak ${coins(res.payout)}!` : `Slide ${m.toFixed(2)}x — ispod cilja.`, res.won ? "success" : "error");
      await refresh();
      setBusy(false);
    }, 4300);
  };


  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Slide</h1>
        <p className="text-sm text-muted">Odaberi ciljani multiplikator. Ako se traka zaustavi na broju ≥ cilja, osvajaš ulog × cilj. Šansa = 96% / cilj.</p>
      </div>
      <div className="flex gap-1.5 overflow-x-auto">
        {last.map((m, i) => (
          <span key={i} className={`rounded px-2 py-1 font-display text-xs ${m >= 2 ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-muted"}`}>{m.toFixed(2)}x</span>
        ))}
      </div>
      <div ref={box} className="card relative h-36 overflow-hidden">
        <div className="flex h-full items-center" style={{ transform: `translateX(${-offset}px)`, transition: anim ? "transform 4s cubic-bezier(0.08,0.6,0.12,1)" : "none" }}>
          {strip.map((m, i) => (
            <div key={i} className="grid h-24 shrink-0 place-items-center px-1" style={{ width: TILE }}>
              <div className={`grid h-full w-full place-items-center rounded-lg border font-display text-lg font-bold ${m >= shownTarget ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-line bg-panel2 text-muted"}`}>
                {m.toFixed(2)}x
              </div>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-accent shadow-[0_0_12px_#facc15]" />
      </div>
      <div className="card grid gap-4 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <BetInput value={bet} onChange={setBet} disabled={busy} />
        <div>
          <label className="label" htmlFor="t">Ciljani multiplikator</label>
          <div className="flex gap-1">
            <input id="t" type="number" step="0.1" min={1.01} className="input" value={target} disabled={busy} onChange={(e) => setTarget(Number(e.target.value))} />
            {[1.5, 2, 5, 10].map((x) => <button key={x} className="btn-ghost px-2.5" disabled={busy} onClick={() => setTarget(x)}>{x}x</button>)}
          </div>
        </div>
        <button className="btn-primary h-10 min-w-40" disabled={busy || bet <= 0 || target < 1.01} onClick={play}>
          {busy ? "Klizi..." : `Igraj · šansa ${(Math.min(96 / target, 100)).toFixed(1)}%`}
        </button>
      </div>
      <p className="text-xs text-muted">Mogući dobitak: <span className="text-accent">{coins(bet * target)}</span></p>
    </div>
  );
}
