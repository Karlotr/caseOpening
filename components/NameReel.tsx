"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

export type Entry = { label: string; sub?: string; color: string; weight: number };

// Rulet s imenima (Jackpot) — širina "šanse" je proporcionalna težini
export function NameReel({ entries, winner, spinKey, duration = 6000, onDone }: { entries: Entry[]; winner: number; spinKey: number; duration?: number; onDone?: () => void }) {
  const TILE = 132;
  const WIN = 58;
  const box = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [strip, setStrip] = useState<number[]>([]);
  const [offset, setOffset] = useState(0);
  const [anim, setAnim] = useState(false);
  const [landed, setLanded] = useState(false);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!spinKey) return;
    const total = entries.reduce((s, e) => s + e.weight, 0) || 1;
    const pick = () => {
      let x = Math.random() * total;
      for (let i = 0; i < entries.length; i++) {
        x -= entries[i].weight;
        if (x <= 0) return i;
      }
      return 0;
    };
    const s = Array.from({ length: 70 }, pick);
    s[WIN] = winner;
    setStrip(s);
    setAnim(false);
    setLanded(false);
    setOffset(0);
    let raf = 0;
    let last = -1;
    const t0 = performance.now();
    const w = box.current?.clientWidth ?? 800;
    const watch = () => {
      if (!track.current) return;
      const m = new DOMMatrixReadOnly(getComputedStyle(track.current).transform);
      const idx = Math.floor((-m.m41 + w / 2) / TILE);
      if (idx !== last) {
        if (last !== -1) sfx.tick();
        last = idx;
      }
      if (performance.now() - t0 < duration + 100) raf = requestAnimationFrame(watch);
    };
    const id = setTimeout(() => {
      setAnim(true);
      setOffset(WIN * TILE - w / 2 + TILE / 2 + (Math.random() - 0.5) * TILE * 0.6);
      sfx.spin();
      raf = requestAnimationFrame(watch);
    }, 120);
    const t = setTimeout(() => {
      setLanded(true);
      doneRef.current?.();
    }, duration + 220);
    return () => {
      clearTimeout(id);
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [spinKey, winner, entries, duration]);

  return (
    <div ref={box} className="relative h-32 overflow-hidden rounded-xl border border-line bg-ink">
      <div ref={track} className="flex h-full items-center" style={{ transform: `translateX(${-offset}px)`, transition: anim ? `transform ${duration}ms cubic-bezier(0.1,0.65,0.1,1)` : "none" }}>
        {strip.map((ei, i) => {
          const e = entries[ei];
          const isWin = landed && i === WIN;
          return (
            <div key={i} className={`shrink-0 px-1 ${isWin ? "landed relative z-10" : ""}`} style={{ width: TILE, opacity: landed && !isWin ? 0.3 : 1, transition: "opacity .4s" }}>
              <div className="grid h-24 place-items-center rounded-lg border-2 bg-panel2 px-2 text-center" style={{ borderColor: e.color, boxShadow: isWin ? `0 0 30px ${e.color}` : undefined }}>
                <div className="min-w-0">
                  <div className="truncate font-display text-xl font-black leading-none" style={{ color: e.color }}>{e.label}</div>
                  {e.sub && <div className="mt-1 truncate text-xs text-muted">{e.sub}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2 bg-accent shadow-[0_0_14px_#f5821f]" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(90deg,var(--color-ink),transparent_18%,transparent_82%,var(--color-ink))]" />
    </div>
  );
}
