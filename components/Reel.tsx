"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Item } from "@/lib/types";
import { RARITY } from "@/lib/format";
import { CarArt } from "./CarArt";

// Spinner: lista predmeta, pobjednik na `winnerIndex`. Promjena `spinKey` pokreće animaciju.
export function Reel({
  items,
  winnerIndex,
  spinKey,
  duration = 5000,
  vertical = false,
  onDone,
}: {
  items: Item[];
  winnerIndex: number;
  spinKey: number;
  duration?: number;
  vertical?: boolean;
  onDone?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);
  const tile = vertical ? 104 : 148;
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useLayoutEffect(() => {
    if (!spinKey || !box.current) return;
    const size = vertical ? box.current.clientHeight : box.current.clientWidth;
    const jitter = (Math.random() - 0.5) * tile * 0.7;
    setAnimate(false);
    setOffset(0);
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimate(true);
        setOffset(winnerIndex * tile - size / 2 + tile / 2 + jitter);
      })
    );
    const t = setTimeout(() => doneRef.current?.(), duration + 80);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
    };
  }, [spinKey, winnerIndex, duration, vertical, tile]);

  return (
    <div ref={box} className={`reel relative w-full min-w-0 overflow-hidden rounded-lg border border-line bg-black/40 ${vertical ? "h-[312px]" : "h-[150px]"}`}>
      <div
        className={vertical ? "flex flex-col" : "flex"}
        style={{
          transform: vertical ? `translateY(${-offset}px)` : `translateX(${-offset}px)`,
          transition: animate ? `transform ${duration}ms cubic-bezier(0.08, 0.6, 0.12, 1)` : "none",
        }}
      >
        {items.map((it, i) => {
          const c = RARITY[it.rarity].color;
          return (
            <div
              key={i}
              className="flex shrink-0 flex-col items-center justify-center border-line"
              style={{
                width: vertical ? "100%" : tile,
                height: vertical ? tile : 150,
                borderRight: vertical ? undefined : "1px solid var(--color-line)",
                borderBottom: vertical ? "1px solid var(--color-line)" : undefined,
                background: `radial-gradient(90% 70% at 50% 100%, ${c}40, transparent 70%)`,
              }}
            >
              <CarArt id={it.id} body={it.body} rarity={it.rarity} className={vertical ? "h-12 w-24" : "h-16 w-32"} />
              <div className="mt-1 w-full truncate px-2 text-center text-[11px] text-muted">{it.brand}</div>
              <div className="w-full truncate px-2 text-center text-xs font-semibold">{it.model}</div>
            </div>
          );
        })}
      </div>
      <div
        className={`pointer-events-none absolute bg-accent shadow-[0_0_12px_var(--color-accent)] ${
          vertical ? "inset-x-0 top-1/2 h-0.5 -translate-y-1/2" : "inset-y-0 left-1/2 w-0.5 -translate-x-1/2"
        }`}
      />
    </div>
  );
}
