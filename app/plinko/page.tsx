"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { coins } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { sfx } from "@/lib/sound";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { BetInput } from "@/components/BetInput";
import { RequireAuth } from "@/components/RequireAuth";
import { useCelebrate } from "@/components/WinOverlay";

// Plinko: server izvuče samo pretinac (plinko_drop u SQL-u), a putanju do njega ovdje složimo nasumično.
type Risk = "low" | "medium" | "high";
type Rows = 8 | 12 | 16;
type Res = { balls: { bucket: number; mult: number; payout: number }[]; payout: number };
type Cfg = { min_bet: number; max_bet: number; tables: Record<string, number[]> };
type Ball = { id: number; pts: { x: number; y: number }[]; t0: number; bucket: number; rows: number; mult: number; payout: number; el: SVGCircleElement | null; seg: number };

const RISKS: { k: Risk; l: string }[] = [
  { k: "low", l: "Nisko" },
  { k: "medium", l: "Srednje" },
  { k: "high", l: "Visoko" },
];
const ROW_H = 0.88;
const Y0 = 0.9;
const PEG_R = 0.09;
const BALL_R = 0.2;
const FIRST = 200; // ms do prvog klina
const STEP = 110; // ms po redu
const LAST = 170;

const fmtMult = (m: number) => (m >= 100 ? `${Math.round(m)}` : m >= 10 ? `${+m.toFixed(1)}` : `${+m.toFixed(2)}`);
// boja pretinca: sredina žuta → rubovi crveni
const bucketColor = (b: number, rows: number) => {
  const f = Math.abs(b - rows / 2) / (rows / 2);
  return `hsl(${48 - 58 * f} 92% ${56 - 6 * f}%)`;
};

export default function PlinkoPage() {
  return (
    <RequireAuth what="igrati Plinko">
      <Plinko />
    </RequireAuth>
  );
}

function Plinko() {
  const rpc = useRpc();
  const toast = useToast();
  const celebrate = useCelebrate();
  const { profile, holdWallet } = useAuth();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [bet, setBet] = useState(1);
  const [risk, setRisk] = useState<Risk>("medium");
  const [rows, setRows] = useState<Rows>(12);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [ballIds, setBallIds] = useState<number[]>([]);
  const [history, setHistory] = useState<{ m: number; b: number; rows: number; key: number }[]>([]);
  const balls = useRef<Map<number, Ball>>(new Map());
  const bucketEls = useRef<(SVGGElement | null)[]>([]);
  const raf = useRef(0);
  const nextId = useRef(1);
  const lastTick = useRef(0);
  const shown = useRef<number | null>(null); // stanje koje se prikazuje dok loptice padaju

  useEffect(() => {
    createClient()
      .rpc("plinko_config")
      .then(({ data }) => {
        if (!data) return;
        const c = data as Cfg;
        for (const k of Object.keys(c.tables)) c.tables[k] = c.tables[k].map(Number);
        setCfg(c);
      });
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const W = rows + 2;
  const cx = W / 2;
  const bucketY = Y0 + rows * ROW_H + 0.12;
  const H = bucketY + 1.0;
  const table = cfg?.tables[`${rows}_${risk}`] ?? [];

  const land = useCallback(
    (b: Ball) => {
      // pretinac odskoči
      bucketEls.current[b.bucket]?.animate([{ transform: "translateY(0)" }, { transform: "translateY(0.16px)" }, { transform: "translateY(0)" }], { duration: 260, easing: "ease-out" });
      sfx.coin();
      setHistory((h) => [{ m: b.mult, b: b.bucket, rows: b.rows, key: b.id }, ...h].slice(0, 14));
      if (shown.current != null) {
        shown.current += b.payout;
        holdWallet({ balance: shown.current });
      }
      if (b.mult >= 25) celebrate({ title: `${fmtMult(b.mult)}×`, subtitle: "Plinko", amount: b.payout, tier: b.mult >= 100 ? 3 : 2 });
      else if (b.mult >= 5) toast(`${fmtMult(b.mult)}× · +${coins(b.payout)}`, "gold");
    },
    [holdWallet, celebrate, toast]
  );

  const loopRef = useRef<() => void>(() => {});
  // jedna animacijska petlja za sve loptice (bez React rendera po frameu)
  const loop = useCallback(() => {
    const now = performance.now();
    for (const b of balls.current.values()) {
      const n = b.pts.length - 1; // broj segmenata
      let el = now - b.t0;
      if (el < 0) {
        b.el?.setAttribute("opacity", "0");
        continue;
      }
      b.el?.setAttribute("opacity", "1");
      let seg = 0;
      let dur = FIRST;
      while (seg < n) {
        dur = seg === 0 ? FIRST : seg === n - 1 ? LAST : STEP;
        if (el < dur) break;
        el -= dur;
        seg++;
      }
      if (seg !== b.seg && seg > 0 && seg < n) {
        // udarac u klin
        if (now - lastTick.current > 35) {
          sfx.tick();
          lastTick.current = now;
        }
      }
      b.seg = seg;
      if (seg >= n) {
        const p = b.pts[n];
        b.el?.setAttribute("cx", String(p.x));
        b.el?.setAttribute("cy", String(p.y));
        balls.current.delete(b.id);
        land(b);
        setBallIds((ids) => ids.filter((x) => x !== b.id));
        continue;
      }
      const t = el / dur;
      const A = b.pts[seg];
      const B = b.pts[seg + 1];
      // vodoravno glatko, okomito gravitacija + mali odskok od klina
      const x = A.x + (B.x - A.x) * (1 - (1 - t) * (1 - t));
      const hop = seg === 0 ? 0 : 0.32 * Math.sin(Math.PI * Math.min(1, t * 1.6)) * (1 - t);
      const y = A.y + (B.y - A.y) * t * t - hop;
      b.el?.setAttribute("cx", x.toFixed(3));
      b.el?.setAttribute("cy", y.toFixed(3));
    }
    if (balls.current.size) raf.current = requestAnimationFrame(() => loopRef.current());
    else {
      raf.current = 0;
      if (shown.current != null) {
        shown.current = null;
        holdWallet(null);
      }
    }
  }, [land, holdWallet]);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  const drop = useCallback(async () => {
    if (busy || !cfg || !profile) return;
    const total = Math.round(bet * count * 100) / 100;
    setBusy(true);
    const res = await rpc<Res>("plinko_drop", { p_bet: bet, p_rows: rows, p_risk: risk, p_count: count }, { silentRefresh: true });
    setBusy(false);
    if (!res) return;
    // dok loptice padaju, stanje = "minus ulog", a dobici se dodaju kako koja padne
    if (shown.current == null) shown.current = profile.balance;
    shown.current = Math.max(0, shown.current - total);
    holdWallet({ balance: shown.current });

    const ids: number[] = [];
    res.balls.forEach((r, i) => {
      // nasumična putanja s točno `bucket` skretanja udesno
      const dirs = Array.from({ length: rows }, (_, k) => (k < r.bucket ? 1 : 0)).sort(() => Math.random() - 0.5);
      const pts = [{ x: cx + (Math.random() - 0.5) * 0.12, y: -0.4 }];
      let R = 0;
      for (let k = 0; k < rows; k++) {
        pts.push({ x: cx + (R - k / 2), y: Y0 + k * ROW_H - PEG_R - BALL_R });
        R += dirs[k];
      }
      pts.push({ x: cx + (r.bucket - rows / 2), y: bucketY + 0.42 });
      const id = nextId.current++;
      ids.push(id);
      balls.current.set(id, { id, pts, t0: performance.now() + i * 140, bucket: r.bucket, rows, mult: Number(r.mult), payout: Number(r.payout), el: null, seg: -1 });
    });
    setBallIds((x) => [...x, ...ids]);
    if (!raf.current) raf.current = requestAnimationFrame(loop);
  }, [busy, cfg, profile, bet, count, rows, risk, rpc, holdWallet, cx, bucketY, loop]);

  // razmak = baci
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        drop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drop]);

  // ako napustiš stranicu usred pada, pokaži pravo stanje
  useEffect(() => () => {
    if (shown.current != null) holdWallet(null);
  }, [holdWallet]);

  if (!cfg) return <div className="card h-[560px] animate-pulse" />;
  const falling = ballIds.length > 0;
  const maxM = Math.max(...table);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Plinko</h1>
        <p className="mt-2 max-w-2xl text-muted">Pusti kuglicu kroz čunjeve. Rubovi plaćaju najviše, sredina najmanje. Biraš rizik i broj redova — do {fmtMult(maxM)}×.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* KONTROLE */}
        <div className="card order-2 space-y-4 p-4 lg:order-1">
          <BetInput value={bet} onChange={setBet} disabled={false} min={Number(cfg.min_bet)} max={Number(cfg.max_bet)} />
          <div>
            <span className="label">Rizik</span>
            <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-line" role="radiogroup" aria-label="Rizik">
              {RISKS.map((r) => (
                <button key={r.k} role="radio" aria-checked={risk === r.k} disabled={falling} onClick={() => setRisk(r.k)} className={`py-2 font-display text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${risk === r.k ? "bg-accent2 text-ink" : "bg-panel hover:bg-panel2"}`}>
                  {r.l}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="label">Redovi</span>
              <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-line" role="radiogroup" aria-label="Broj redova">
                {([8, 12, 16] as Rows[]).map((r) => (
                  <button key={r} role="radio" aria-checked={rows === r} disabled={falling} onClick={() => setRows(r)} className={`py-2 font-display text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${rows === r ? "bg-accent2 text-ink" : "bg-panel hover:bg-panel2"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Kuglica</span>
              <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-line" role="radiogroup" aria-label="Broj kuglica">
                {[1, 5, 10].map((n) => (
                  <button key={n} role="radio" aria-checked={count === n} onClick={() => setCount(n)} className={`py-2 font-display text-sm font-bold transition ${count === n ? "bg-accent2 text-ink" : "bg-panel hover:bg-panel2"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button className="btn-primary w-full py-3.5 text-lg" disabled={busy || bet < Number(cfg.min_bet) || bet > Number(cfg.max_bet)} onClick={drop}>
            {busy ? "…" : `Baci ${count > 1 ? `${count}× ` : ""}· ${coins(bet * count)}`}
          </button>
          <p className="text-xs text-muted">Možeš bacati i dok kuglice još padaju (razmak = baci). Rizik i redovi se mijenjaju kad sve kuglice padnu.</p>
        </div>

        {/* PLOČA */}
        <div className="card order-1 relative overflow-hidden p-3 sm:p-5 lg:order-2">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,#5ce1ff14,transparent_70%)]" />
          {/* zadnji rezultati */}
          <div className="relative mb-2 flex h-7 gap-1.5 overflow-hidden">
            {history.map((h) => (
              <span key={h.key} className="drop-in shrink-0 rounded-md px-2 py-1 font-display text-xs font-black tabular-nums text-ink" style={{ background: bucketColor(h.b, h.rows) }}>
                {fmtMult(h.m)}×
              </span>
            ))}
          </div>
          <svg viewBox={`0 -0.6 ${W} ${H + 0.6}`} className="relative mx-auto block w-full max-w-[720px]" style={{ aspectRatio: `${W} / ${H + 0.6}` }}>
            <defs>
              <radialGradient id="plBall" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#fff7c2" />
                <stop offset="55%" stopColor="#ffb547" />
                <stop offset="100%" stopColor="#d97706" />
              </radialGradient>
              <filter id="plGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="0.12" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* čunjevi */}
            {Array.from({ length: rows }, (_, k) =>
              Array.from({ length: k + 3 }, (_, j) => <circle key={`${k}-${j}`} cx={cx + (j - (k + 2) / 2)} cy={Y0 + k * ROW_H} r={PEG_R} fill="#e2e8f0" opacity={0.85} />)
            )}
            {/* pretinci */}
            {table.map((m, b) => {
              const x = cx + (b - rows / 2);
              const c = bucketColor(b, rows);
              return (
                <g key={b} ref={(el) => void (bucketEls.current[b] = el)}>
                  <rect x={x - 0.46} y={bucketY} width={0.92} height={0.72} rx={0.12} fill={c} />
                  <rect x={x - 0.46} y={bucketY + 0.58} width={0.92} height={0.14} rx={0.07} fill="#000" opacity={0.25} />
                  <text x={x} y={bucketY + 0.44} textAnchor="middle" fontSize={rows === 16 ? 0.27 : 0.32} fontWeight={800} fill="#14101a" style={{ fontFamily: "var(--font-display)" }}>
                    {fmtMult(m)}
                    {rows < 16 ? "×" : ""}
                  </text>
                </g>
              );
            })}
            {/* kuglice */}
            {ballIds.map((id) => (
              <circle
                key={id}
                ref={(el) => {
                  const b = balls.current.get(id);
                  if (b) b.el = el;
                }}
                cx={cx}
                cy={-0.4}
                r={BALL_R}
                fill="url(#plBall)"
                filter="url(#plGlow)"
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
