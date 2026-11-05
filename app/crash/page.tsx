"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { coins } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { BetInput } from "@/components/BetInput";
import { useLimits } from "@/lib/useLimits";
import { RequireAuth } from "@/components/RequireAuth";
import { useCelebrate } from "@/components/WinOverlay";
import { sfx } from "@/lib/sound";

// Crash (play_crash u SQL-u): server izvuče crash točku,
// a ako je ≥ tvog auto cash-outa, osvajaš ulog × cilj. Ovdje se to samo prikazuje kao krivulja koja raste.
type Res = { result: number; won: boolean; payout: number };
type Phase = "idle" | "flying" | "crashed";

const K = 0.32; // brzina rasta: m(t) = e^(K·t)  → 2× ≈ 2,2 s, 10× ≈ 7,2 s
const AFTER_CASHOUT = 2.5; // nakon isplate ubrzaj do crasha
const W = 800;
const H = 380;
const PAD = { l: 52, r: 24, t: 24, b: 34 };

export default function CrashPage() {
  return (
    <RequireAuth what="igrati Crash">
      <Crash />
    </RequireAuth>
  );
}

function Crash() {
  const rpc = useRpc();
  const toast = useToast();
  const { refresh } = useAuth();
  const limits = useLimits();
  const celebrate = useCelebrate();
  const [bet, setBet] = useState(1);
  const [target, setTarget] = useState(2);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [t, setT] = useState(0); // sekunde leta
  const [cashed, setCashed] = useState<number | null>(null);
  const [shownTarget, setShownTarget] = useState(2);
  const [last, setLast] = useState<number[]>([]);
  const raf = useRef(0);
  const skip = useRef(false);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const mult = Math.exp(K * t);

  const finish = useCallback(
    async (res: Res, m: number, tgt: number) => {
      setLast((l) => [m, ...l].slice(0, 16));
      if (res.won) {
        if (tgt >= 3) celebrate({ title: `${tgt}×`, subtitle: `Isplaćeno prije crasha na ${m.toFixed(2)}×`, amount: Number(res.payout), tier: tgt >= 10 ? 3 : 2 });
        else toast(`Isplaćeno na ${tgt}×, crash na ${m.toFixed(2)}×. Dobitak ${coins(res.payout)}!`, "success");
      } else {
        sfx.lose();
        toast(`Crash na ${m.toFixed(2)}×, prije tvog cilja ${tgt}×.`, "error");
      }
      await refresh();
      setBusy(false);
    },
    [celebrate, toast, refresh]
  );

  const play = async () => {
    if (busy) return;
    setBusy(true);
    const res = await rpc<Res>("play_crash", { p_bet: bet, p_target: target }, { silentRefresh: true });
    if (!res) return setBusy(false);
    const m = Number(res.result);
    const tgt = target;
    const tCrash = Math.log(m) / K;
    const tCash = Math.log(tgt) / K;
    setShownTarget(tgt);
    setCashed(null);
    setT(0);
    setPhase("flying");
    skip.current = false;
    sfx.spin();

    let sim = 0;
    let prev = -1;
    let lastWhole = 1;
    let paid = false;
    const step = (now: number) => {
      const dt = prev < 0 ? 0 : Math.min(0.05, (now - prev) / 1000);
      prev = now;
      sim += dt * (paid ? AFTER_CASHOUT : 1) * (skip.current ? 8 : 1);
      if (res.won && !paid && sim >= tCash) {
        paid = true;
        setCashed(tgt);
        sfx.win(tgt >= 10 ? 3 : tgt >= 3 ? 2 : 1);
      }
      const cur = Math.exp(K * Math.min(sim, tCrash));
      if (Math.floor(cur) > lastWhole) {
        lastWhole = Math.floor(cur);
        sfx.tick();
      }
      if (sim >= tCrash) {
        setT(tCrash);
        setPhase("crashed");
        finish(res, m, tgt);
        return;
      }
      setT(sim);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };


  // --- graf (automatsko skaliranje kao na pravim crash igrama) ---
  const maxT = Math.max(8, t * 1.15);
  const maxM = Math.max(2, mult * 1.25);
  const x = (s: number) => PAD.l + (s / maxT) * (W - PAD.l - PAD.r);
  const y = (m: number) => H - PAD.b - ((m - 1) / (maxM - 1)) * (H - PAD.t - PAD.b);
  const N = 70;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const s = (t * i) / N;
    pts.push(`${x(s).toFixed(1)},${y(Math.exp(K * s)).toFixed(1)}`);
  }
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${x(t).toFixed(1)},${y(1)} L${x(0)},${y(1)} Z`;
  const tipX = x(t);
  const tipY = y(mult);
  const crashed = phase === "crashed";
  const won = cashed != null;
  const col = crashed && !won ? "#ff3b5c" : won ? "#34d399" : "#ffb547";

  // oznake na y osi
  const yStep = maxM <= 3 ? 0.5 : maxM <= 6 ? 1 : maxM <= 15 ? 2 : maxM <= 40 ? 5 : maxM <= 120 ? 20 : maxM <= 400 ? 50 : 200;
  const yTicks: number[] = [];
  for (let v = 1; v <= maxM; v += yStep) yTicks.push(Number(v.toFixed(2)));
  const xStep = maxT <= 12 ? 2 : maxT <= 30 ? 5 : 10;
  const xTicks: number[] = [];
  for (let v = 0; v <= maxT; v += xStep) xTicks.push(v);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Crash</h1>
        <p className="text-sm text-muted">Postavi auto cash-out i pokreni. Multiplikator raste dok ne crasha — ako stigne do tvog cilja, osvajaš ulog × cilj. Šansa = 96% / cilj.</p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto">
        {last.map((m, i) => (
          <span key={i} className={`shrink-0 rounded px-2 py-1 font-display text-xs ${m >= 10 ? "bg-amber-400/20 text-amber-300" : m >= 2 ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-muted"}`}>{m.toFixed(2)}x</span>
        ))}
      </div>

      <div
        className={`card relative overflow-hidden ${crashed && !won ? "crash-shake" : ""}`}
        style={{ boxShadow: phase !== "idle" ? `0 0 50px -18px ${col}` : undefined, borderColor: phase !== "idle" ? `${col}66` : undefined }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-[260px] w-full sm:h-[380px]" preserveAspectRatio="none">
          <defs>
            <linearGradient id="crashFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={col} stopOpacity="0.35" />
              <stop offset="100%" stopColor={col} stopOpacity="0" />
            </linearGradient>
            <filter id="crashGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#ffffff0d" />
              <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#ffffff55">{v}×</text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v}`} x={x(v)} y={H - 10} textAnchor="middle" fontSize="12" fill="#ffffff40">{v}s</text>
          ))}
          {/* auto cash-out linija */}
          {phase !== "idle" && shownTarget <= maxM && (
            <g>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(shownTarget)} y2={y(shownTarget)} stroke="#34d399" strokeOpacity="0.6" strokeDasharray="6 6" />
              <text x={W - PAD.r} y={y(shownTarget) - 6} textAnchor="end" fontSize="12" fontWeight="700" fill="#34d399">Cash-out {shownTarget}×</text>
            </g>
          )}
          {phase !== "idle" && (
            <>
              <path d={area} fill="url(#crashFill)" />
              <path d={line} fill="none" stroke={col} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#crashGlow)" vectorEffect="non-scaling-stroke" />
              {crashed ? (
                <g>
                  <circle cx={tipX} cy={tipY} r="16" fill={won ? "#34d39955" : "#ff3b5c55"} className="crash-boom" />
                  <circle cx={tipX} cy={tipY} r="7" fill={won ? "#34d399" : "#ff3b5c"} />
                </g>
              ) : (
                <g>
                  <circle cx={tipX} cy={tipY} r="12" fill={col} opacity="0.3" />
                  <circle cx={tipX} cy={tipY} r="6" fill="#fff" filter="url(#crashGlow)" />
                </g>
              )}
            </>
          )}
        </svg>

        {/* veliki multiplikator */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            {phase === "idle" ? (
              <div className="font-display text-2xl font-bold text-muted sm:text-3xl">Postavi cilj i pokreni</div>
            ) : (
              <>
                <div className="font-display text-6xl font-black tabular-nums drop-shadow-[0_4px_24px_rgba(0,0,0,.6)] sm:text-8xl" style={{ color: crashed ? col : "#fff" }}>
                  {mult.toFixed(2)}×
                </div>
                {crashed && <div className="mt-1 font-display text-xl font-extrabold uppercase tracking-widest" style={{ color: "#ff3b5c" }}>Crash!</div>}
                {won && (
                  <div className="pop mt-2 inline-block rounded-full bg-emerald-500/20 px-4 py-1 font-display text-lg font-bold text-emerald-300 ring-1 ring-emerald-400/50">
                    Isplaćeno {shownTarget}× · +{coins(bet * shownTarget)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {phase === "flying" && won && (
          <button type="button" className="absolute bottom-3 right-3 rounded-lg border border-line bg-ink/80 px-3 py-1.5 text-sm font-bold text-muted hover:text-fg" onClick={() => (skip.current = true)}>
            Preskoči
          </button>
        )}
      </div>

      <div className="card grid gap-4 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <BetInput value={bet} onChange={setBet} disabled={busy} min={limits.crash_min_bet ?? 0.1} max={limits.crash_max_bet ?? 10000} />
        <div>
          <label className="label" htmlFor="t">Auto cash-out</label>
          <div className="flex gap-1">
            <input id="t" type="number" step="0.1" min={1.01} max={1000} className="input min-w-0" value={target} disabled={busy} onChange={(e) => setTarget(Number(e.target.value))} />
            {[1.5, 2, 5, 10].map((v) => (
              <button key={v} className="btn-ghost shrink-0 px-2.5" disabled={busy} onClick={() => setTarget(v)}>{v}x</button>
            ))}
          </div>
        </div>
        <button className="btn-primary h-10 min-w-40" disabled={busy || bet <= 0 || target < 1.01 || target > 1000} onClick={play}>
          {busy ? "Leti..." : `Pokreni · šansa ${Math.min(96 / target, 100).toFixed(1)}%`}
        </button>
      </div>
      <p className="text-xs text-muted">Mogući dobitak: <span className="text-accent">{coins(bet * target)}</span></p>
    </div>
  );
}
