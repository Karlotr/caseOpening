"use client";

import { useEffect, useState } from "react";
import type { Item } from "@/lib/types";
import { RARITY, coins } from "@/lib/format";
import { rarityRank, sfx } from "@/lib/sound";
import { CarArt } from "./CarArt";
import { CountUp } from "./CountUp";

// Scena otkrivanja nakon otvaranja kutije: kartice se okreću jedna po jedna, vrijednost se broji, profit je jasan.
export function RevealStage({
  items,
  cost,
  demo,
  againLabel,
  onAgain,
  onSell,
  busy,
}: {
  items: Item[];
  cost: number;
  demo?: boolean;
  againLabel: React.ReactNode;
  onAgain?: () => void;
  onSell?: () => void;
  busy?: boolean;
}) {
  const [shown, setShown] = useState(0);
  const total = items.reduce((s, i) => s + i.value, 0);
  const visibleTotal = items.slice(0, shown).reduce((s, i) => s + i.value, 0);
  const ratio = cost > 0 ? total / cost : null;
  const profit = cost > 0 ? total - cost : null;
  const allShown = shown >= items.length;

  useEffect(() => {
    setShown(0);
    const ts = items.map((_, i) =>
      setTimeout(() => {
        setShown(i + 1);
        sfx.flip();
        // brojanje vrijednosti — kratki "tick" zvukovi
        const ticks = Math.min(14, 4 + rarityRank(items[i].rarity) * 2);
        for (let k = 0; k < ticks; k++) setTimeout(() => sfx.count(), 60 + k * 55);
      }, 120 + i * 320)
    );
    return () => ts.forEach(clearTimeout);
  }, [items]);

  const best = items.reduce((a, b) => (b.value > a.value ? b : a), items[0]);

  return (
    <div className="pop relative overflow-hidden rounded-xl border border-line bg-ink/70 p-4">
      <div className="rays pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[700px] opacity-20" style={{ ["--ray" as string]: RARITY[best.rarity].color }} />
      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-muted">{demo ? "Demo vrtnja, ništa nije spremljeno" : items.length > 1 ? `Tvojih ${items.length} auta` : "Tvoj auto"}</div>
          <div className="font-display text-5xl font-black leading-none text-accent">
            <CountUp value={visibleTotal} duration={500} />
          </div>
        </div>
        {ratio !== null && allShown && !demo && (
          <div className={`pop rounded-lg px-3 py-2 text-right ${profit! >= 0 ? "bg-emerald-400/15 text-emerald-300" : "bg-panel2 text-muted"}`}>
            <div className="font-display text-3xl font-black leading-none">{ratio.toFixed(2).replace(".", ",")}×</div>
            <div className="text-sm font-semibold">
              {profit! >= 0 ? `+${coins(profit)} profit` : `${coins(profit)} u odnosu na cijenu`}
            </div>
          </div>
        )}
      </div>

      <div className={`relative mt-4 grid gap-3 ${items.length === 1 ? "grid-cols-1 sm:max-w-sm" : items.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"}`} style={{ perspective: 900 }}>
        {items.map((it, i) => {
          const r = RARITY[it.rarity];
          const on = i < shown;
          const big = rarityRank(it.rarity) >= 3;
          return (
            <div
              key={i}
              className="relative rounded-xl border-2 bg-panel p-3 text-center"
              style={{
                borderColor: on ? r.color : "var(--color-line)",
                transform: on ? "rotateY(0deg)" : "rotateY(90deg)",
                opacity: on ? 1 : 0,
                transition: "transform .45s cubic-bezier(.2,1.3,.4,1), opacity .2s",
                boxShadow: on && big ? `0 0 36px ${r.color}66` : undefined,
                backgroundImage: `radial-gradient(110% 80% at 50% 110%, ${r.color}55, transparent 65%)`,
              }}
            >
              <div className="text-sm font-bold" style={{ color: r.color }}>{r.label}</div>
              <CarArt id={it.id} body={it.body} rarity={it.rarity} className={`mx-auto ${items.length === 1 ? "h-28 w-60" : "h-16 w-36"}`} />
              <div className="text-xs text-muted">{it.brand}, {it.year}</div>
              <div className={`font-display font-black leading-tight ${items.length === 1 ? "text-3xl" : "text-xl"}`}>{it.model}</div>
              <div className="mt-1 font-display text-2xl font-black text-accent">{on ? <CountUp value={it.value} from={0} duration={600} /> : "0,00"}</div>
            </div>
          );
        })}
      </div>

      <div className="relative mt-4 flex flex-wrap gap-2">
        {onAgain && (
          <button className="btn-primary glow-pulse px-6 py-3 text-lg" onClick={onAgain} disabled={busy}>
            {againLabel}
          </button>
        )}
        {onSell && !demo && (
          <button className="btn-ghost py-3" onClick={onSell} disabled={busy}>
            Prodaj za {coins(total)}
          </button>
        )}
        <span className="self-center text-xs text-muted">Razmaknica = otvori ponovno</span>
      </div>
    </div>
  );
}
