"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Item } from "@/lib/types";
import { RARITY, coins } from "@/lib/format";
import { sfx } from "@/lib/sound";
import { CarArt } from "./CarArt";

// Spinner: lista predmeta, pobjednik na `winnerIndex`. Promjena `spinKey` pokreće animaciju.
export function Reel({
  items,
  winnerIndex,
  spinKey,
  duration = 5000,
  vertical = false,
  sound = true,
  size = "md",
  onDone,
}: {
  items: Item[];
  winnerIndex: number;
  spinKey: number;
  duration?: number;
  vertical?: boolean;
  sound?: boolean;
  size?: "md" | "lg";
  onDone?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [landed, setLanded] = useState(false);
  const lg = size === "lg" && !vertical;
  const tile = vertical ? 112 : lg ? 188 : 156;
  const H = lg ? 214 : 172;
  const doneRef = useRef(onDone);
  const itemsRef = useRef(items);
  useEffect(() => {
    doneRef.current = onDone;
    itemsRef.current = items;
  }, [onDone, items]);

  useLayoutEffect(() => {
    if (!spinKey || !box.current) return;
    const size = vertical ? box.current.clientHeight : box.current.clientWidth;
    const jitter = (Math.random() - 0.5) * tile * 0.7;
    setAnimate(false);
    setLanded(false);
    setOffset(0);
    let raf = 0;
    let lastIdx = -1;
    const t0 = performance.now();
    // tick zvuk kad pločica prođe ispod oznake
    const watch = () => {
      if (!track.current) return;
      const m = new DOMMatrixReadOnly(getComputedStyle(track.current).transform);
      const pos = -(vertical ? m.m42 : m.m41) + size / 2;
      const idx = Math.floor(pos / tile);
      if (idx !== lastIdx) {
        if (lastIdx !== -1 && sound) sfx.tick();
        lastIdx = idx;
      }
      if (performance.now() - t0 < duration + 100) raf = requestAnimationFrame(watch);
    };
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimate(true);
        setOffset(winnerIndex * tile - size / 2 + tile / 2 + jitter);
        if (sound) sfx.spin();
        raf = requestAnimationFrame(watch);
      })
    );
    const t = setTimeout(() => {
      setLanded(true);
      const w = itemsRef.current[winnerIndex];
      if (sound && w) sfx.reveal(w.rarity);
      doneRef.current?.();
    }, duration + 80);
    return () => {
      cancelAnimationFrame(id);
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [spinKey, winnerIndex, duration, vertical, tile, sound]);

  const winner = items[winnerIndex];
  const wc = winner ? RARITY[winner.rarity].color : "#f5821f";

  return (
    <div
      ref={box}
      className={`reel relative w-full min-w-0 overflow-hidden rounded-lg border bg-ink transition-colors duration-500 ${vertical ? "h-[336px]" : ""}`}
      style={{ height: vertical ? undefined : H, borderColor: landed ? wc : "var(--color-line)", boxShadow: landed ? `0 0 30px ${wc}55, inset 0 0 40px ${wc}22` : undefined }}
    >
      <div
        ref={track}
        className={vertical ? "flex flex-col" : "flex"}
        style={{
          transform: vertical ? `translateY(${-offset}px)` : `translateX(${-offset}px)`,
          transition: animate ? `transform ${duration}ms cubic-bezier(0.08, 0.6, 0.12, 1)` : "none",
        }}
      >
        {items.map((it, i) => {
          const c = RARITY[it.rarity].color;
          const isWin = landed && i === winnerIndex;
          return (
            <div
              key={i}
              className={`relative flex shrink-0 flex-col items-center justify-center ${isWin ? "landed z-10" : ""}`}
              style={{
                width: vertical ? "100%" : tile,
                height: vertical ? tile : H,
                borderRight: vertical ? undefined : "1px solid var(--color-line)",
                borderBottom: vertical ? "1px solid var(--color-line)" : undefined,
                background: `radial-gradient(90% 70% at 50% 100%, ${c}${isWin ? "88" : "38"}, transparent 70%)`,
                opacity: landed && !isWin ? 0.35 : 1,
                transition: "opacity .4s",
              }}
            >
              <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: c }} />
              <CarArt id={it.id} body={it.body} rarity={it.rarity} className={vertical ? "h-11 w-24" : lg ? "h-20 w-40" : "h-16 w-32"} />
              <div className="mt-0.5 w-full truncate px-2 text-center text-[11px] text-muted">{it.brand}</div>
              <div className="w-full truncate px-2 text-center text-[13px] font-semibold leading-tight">{it.model}</div>
              <span className={`plate mt-1 ${lg ? "text-base" : "text-[13px]"} ${isWin ? "scale-125 transition-transform" : ""}`}>{coins(it.value)}</span>
            </div>
          );
        })}
      </div>
      {/* oznaka */}
      <div className={`pointer-events-none absolute z-20 ${vertical ? "inset-x-0 top-1/2 -translate-y-1/2" : "inset-y-0 left-1/2 -translate-x-1/2"}`}>
        {vertical ? (
          <>
            <div className="h-[2px] w-full bg-accent shadow-[0_0_14px_#f5821f]" />
            <div className="absolute -left-1 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[7px] border-l-[9px] border-y-transparent border-l-accent" />
            <div className="absolute -right-1 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[7px] border-r-[9px] border-y-transparent border-r-accent" />
          </>
        ) : (
          <>
            <div className="h-full w-[2px] bg-accent shadow-[0_0_14px_#f5821f]" />
            <div className="absolute -top-1 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[8px] border-t-[10px] border-x-transparent border-t-accent" />
            <div className="absolute -bottom-1 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[8px] border-b-[10px] border-x-transparent border-b-accent" />
          </>
        )}
      </div>
      <div className={`pointer-events-none absolute inset-0 z-10 ${vertical ? "bg-[linear-gradient(180deg,var(--color-ink),transparent_22%,transparent_78%,var(--color-ink))]" : "bg-[linear-gradient(90deg,var(--color-ink),transparent_18%,transparent_82%,var(--color-ink))]"}`} />
    </div>
  );
}
