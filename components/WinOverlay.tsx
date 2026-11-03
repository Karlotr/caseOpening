"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Item, Rarity } from "@/lib/types";
import { RARITY, coins } from "@/lib/format";
import { rarityRank, sfx } from "@/lib/sound";
import { CarArt } from "./CarArt";
import { CountUp } from "./CountUp";

export type Celebration = {
  title: string;
  subtitle?: string;
  items?: Item[];
  amount?: number; // ukupna vrijednost / dobitak
  tier?: 1 | 2 | 3; // jačina slavlja
};

const Ctx = createContext<(c: Celebration) => void>(() => {});
export const useCelebrate = () => useContext(Ctx);

export const tierFor = (items: Item[] = [], ratio = 1): 1 | 2 | 3 => {
  const best = Math.max(0, ...items.map((i) => rarityRank(i.rarity)));
  if (best >= 4 || ratio >= 10) return 3;
  if (best >= 3 || ratio >= 2.5) return 2;
  return 1;
};

function Confetti({ colors, count }: { colors: string[]; count: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const g = cv.getContext("2d")!;
    const W = (cv.width = window.innerWidth);
    const H = (cv.height = window.innerHeight);
    const ps = Array.from({ length: count }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 120,
      y: H * 0.42,
      vx: (Math.random() - 0.5) * 18,
      vy: -Math.random() * 18 - 6,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      g.clearRect(0, 0, W, H);
      ps.forEach((p) => {
        p.vy += 0.42;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.r);
        g.fillStyle = p.c;
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        g.restore();
      });
      if (t - t0 < 4500) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [colors, count]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[61]" aria-hidden />;
}

export function WinOverlayProvider({ children }: { children: React.ReactNode }) {
  const [c, setC] = useState<(Celebration & { key: number }) | null>(null);
  const celebrate = useCallback((x: Celebration) => {
    const tier = x.tier ?? tierFor(x.items);
    setC({ ...x, tier, key: Date.now() });
    sfx.win(tier);
  }, []);
  const close = () => setC(null);

  useEffect(() => {
    if (!c) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const t = setTimeout(close, c.tier === 3 ? 9000 : 6500);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [c]);

  const best = c?.items?.length ? [...c.items].sort((a, b) => b.value - a.value)[0] : null;
  const rc = best ? RARITY[best.rarity as Rarity].color : "#F5821F";

  return (
    <Ctx value={celebrate}>
      {children}
      {c && (
        <>
          <Confetti key={c.key} colors={[rc, "#F5821F", "#8FCBEB", "#ffffff"]} count={c.tier === 3 ? 260 : c.tier === 2 ? 150 : 80} />
          <div role="dialog" aria-modal="true" aria-label={c.title} onClick={close} className="fixed inset-0 z-[60] grid place-items-center bg-ink/80 p-4 backdrop-blur-sm">
            <div key={c.key} onClick={(e) => e.stopPropagation()} className={`win-pop relative w-full max-w-lg overflow-hidden rounded-2xl border bg-panel p-6 text-center shadow-2xl ${c.tier === 3 ? "shake" : ""}`} style={{ borderColor: rc }}>
              <div className="rays pointer-events-none absolute left-1/2 top-[38%] h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 opacity-40" style={{ ["--ray" as string]: rc }} />
              <div className="relative">
                <div className="font-display text-sm font-semibold" style={{ color: rc }}>{c.subtitle}</div>
                <h2 className="font-display text-5xl font-black leading-none tracking-tight sm:text-6xl">{c.title}</h2>
                {best && (
                  <div className="mx-auto mt-4 max-w-sm">
                    <CarArt id={best.id} body={best.body} rarity={best.rarity} className="mx-auto h-28 w-64 drop-shadow-[0_12px_30px_rgba(0,0,0,.6)]" />
                    <div className="mt-1 text-muted">{best.brand} · {best.year}</div>
                    <div className="font-display text-2xl font-bold">{best.model}</div>
                    <div className="mt-1 text-sm font-semibold" style={{ color: rc }}>{RARITY[best.rarity].label}</div>
                  </div>
                )}
                {c.items && c.items.length > 1 && (
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {c.items.map((i, k) => (
                      <span key={k} className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: RARITY[i.rarity].color + "88" }}>
                        {i.model} <b className="text-accent">{coins(i.value)}</b>
                      </span>
                    ))}
                  </div>
                )}
                {c.amount !== undefined && (
                  <div className="mt-4 font-display text-6xl font-black text-accent">
                    +<CountUp value={c.amount} from={0} duration={1400} />
                  </div>
                )}
                <button className="btn-primary mt-6 min-w-40" onClick={close} autoFocus>Nastavi</button>
              </div>
            </div>
          </div>
        </>
      )}
    </Ctx>
  );
}
