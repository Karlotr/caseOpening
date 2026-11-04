"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { coins } from "@/lib/format";

export type Entry = { label: string; names?: string; sub?: string; color: string; weight: number };

const LAPS = 9; // koliko puta se traka ponavlja
const TARGET_LAP = 6; // u kojem krugu se zaustavlja

const initials = (s: string) =>
  s
    .split(/[\s,·]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

// Jackpot rulet: traka obojenih segmenata čija je širina proporcionalna šansi.
// `ticket` (0–1) je pozicija koju je izvukao server; ako ne odgovara pobjedniku, uzima se nasumična točka unutar njegovog segmenta.
export function NameReel({
  entries,
  winner,
  spinKey,
  duration = 6000,
  ticket,
  pot,
  onDone,
}: {
  entries: Entry[];
  winner: number;
  spinKey: number;
  duration?: number;
  ticket?: number | null;
  pot?: number;
  onDone?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(900);
  const [offset, setOffset] = useState(0);
  const [anim, setAnim] = useState(false);
  const [landed, setLanded] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  const total = entries.reduce((s, e) => s + e.weight, 0) || 1;
  const lap = Math.max(boxW * 1.1, 640);
  const segs = entries.map((e, i) => {
    const before = entries.slice(0, i).reduce((s, x) => s + x.weight, 0);
    return { start: before / total, size: e.weight / total };
  });

  useLayoutEffect(() => {
    const w = box.current?.clientWidth ?? 900;
    setBoxW(w);
    // početni položaj: sredina drugog kruga
    setOffset(Math.max(w * 1.1, 640) * 1.5 - w / 2);
  }, []);

  useEffect(() => {
    if (!spinKey || !box.current) return;
    const w = box.current.clientWidth;
    const L = Math.max(w * 1.1, 640);
    const s = segs[winner] ?? { start: 0, size: 1 };
    const inWinner = ticket != null && ticket >= s.start && ticket < s.start + s.size;
    // ne staj točno na rub segmenta
    const frac = inWinner ? ticket! : s.start + s.size * (0.15 + Math.random() * 0.7);
    const target = TARGET_LAP * L + frac * L - w / 2;

    setLanded(false);
    setAnim(false);
    setSpinning(true);
    setOffset(L * 1.5 - w / 2);
    let raf = 0;
    let last = -1;
    const t0 = performance.now();
    const segAt = (x: number) => {
      const f = (((x + w / 2) / L) % 1 + 1) % 1;
      return segs.findIndex((g) => f >= g.start && f < g.start + g.size);
    };
    const watch = () => {
      if (!track.current) return;
      const m = new DOMMatrixReadOnly(getComputedStyle(track.current).transform);
      const idx = segAt(-m.m41);
      if (idx !== last) {
        if (last !== -1) sfx.tick();
        last = idx;
      }
      if (performance.now() - t0 < duration + 100) raf = requestAnimationFrame(watch);
    };
    const id = setTimeout(() => {
      setAnim(true);
      setOffset(target);
      sfx.spin();
      raf = requestAnimationFrame(watch);
    }, 120);
    const t = setTimeout(() => {
      setLanded(true);
      setSpinning(false);
      doneRef.current?.();
    }, duration + 220);
    return () => {
      clearTimeout(id);
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
    // segs/ticket se čitaju u trenutku pokretanja vrtnje
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey, winner, duration]);

  return (
    <div className="relative">
      <div className="mb-2 text-center font-display text-sm font-bold text-muted">
        {spinning ? "Biranje pobjednika…" : landed ? `Pobjednik: ${entries[winner]?.label ?? ""}` : "Jackpot"}
      </div>
      <div ref={box} className="relative h-36 overflow-hidden rounded-2xl border border-white/[.07] bg-[#07070f]">
        <div
          ref={track}
          className="absolute inset-y-0 left-0 flex"
          style={{ transform: `translateX(${-offset}px)`, transition: anim ? `transform ${duration}ms cubic-bezier(0.12,0.6,0.08,1)` : "none" }}
        >
          {Array.from({ length: LAPS }, (_, k) =>
            entries.map((e, i) => {
              const wpx = segs[i].size * lap;
              const isWin = landed && k === TARGET_LAP && i === winner;
              return (
                <div
                  key={`${k}-${i}`}
                  className="relative flex h-full shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden border-r border-black/50"
                  style={{
                    width: wpx,
                    backgroundColor: `color-mix(in oklab, ${e.color} ${isWin ? 85 : 62}%, #07070f)`,
                    backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.07) 0 10px, transparent 10px 20px)",
                    opacity: landed && !isWin ? 0.35 : 1,
                    boxShadow: isWin ? `inset 0 0 0 3px #fff, 0 0 40px ${e.color}` : undefined,
                    transition: "opacity .4s, background-color .4s",
                  }}
                >
                  {wpx > 56 && (
                    <>
                      <div className="flex -space-x-2">
                        {(e.names ?? e.label)
                          .split(/\s*[,&·]\s*/)
                          .filter(Boolean)
                          .slice(0, wpx > 140 ? 3 : 1)
                          .map((n, j) => (
                            <span
                              key={j}
                              title={n}
                              className="grid h-9 w-9 place-items-center rounded-full border-2 bg-[#0c0c1c] font-display text-xs font-black text-white"
                              style={{ borderColor: e.color }}
                            >
                              {initials(n)}
                            </span>
                          ))}
                      </div>
                      <div className="font-display text-xl font-black leading-none text-white drop-shadow">
                        {((e.weight / total) * 100).toFixed(2).replace(".", ",")}%
                      </div>
                      {wpx > 120 && <div className="max-w-full truncate px-2 text-xs font-semibold text-white/80">{e.label}</div>}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
        {/* pokazivač */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center">
          <div className="h-0 w-0 border-x-[10px] border-t-[12px] border-x-transparent border-t-white drop-shadow-[0_0_8px_#fff]" />
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2 bg-white/80 shadow-[0_0_12px_#fff]" />
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(90deg,#07070f,transparent_12%,transparent_88%,#07070f)]" />
      </div>
      {pot !== undefined && (
        <div className="mx-auto -mt-4 w-fit rounded-xl border border-white/10 bg-panel px-5 py-2 font-display text-lg font-bold shadow-xl relative z-30">
          <span className="text-muted">Jackpot</span> <span className="coin" /> <span className="text-accent">{coins(pot)}</span>
        </div>
      )}
    </div>
  );
}
