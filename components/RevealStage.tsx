"use client";

import { useEffect, useState } from "react";
import type { Item } from "@/lib/types";
import { RARITY, coins } from "@/lib/format";
import { rarityRank, sfx } from "@/lib/sound";
import { CarImage } from "./CarImage";
import { CountUp } from "./CountUp";

const fmtPct = (x: number) => `${(x * 100).toFixed(x < 0.001 ? 4 : x < 0.01 ? 3 : 2).replace(".", ",")} %`;
const oneIn = (p: number) => (p > 0 ? Math.max(1, Math.round(1 / p)).toLocaleString("hr-HR") : "∞");

// Scena otkrivanja nakon otvaranja kutije: kartice se okreću jedna po jedna, vrijednost se broji, profit je jasan.
export function RevealStage({
  items,
  cost,
  demo,
  againLabel,
  onAgain,
  busy,
}: {
  items: Item[];
  cost: number;
  demo?: boolean;
  againLabel: React.ReactNode;
  onAgain?: () => void;
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
              <CarImage item={it} className={`mx-auto ${items.length === 1 ? "h-28 w-60" : "h-16 w-36"}`} />
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
        {!demo && allShown && <span className="self-center rounded-lg bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">+{coins(total)} dodano na račun</span>}
        {!demo && <span className="self-center text-xs text-muted">Razmaknica = otvori ponovno</span>}
      </div>
      {!demo && allShown && items.some((i) => i.roll) && (
        <details className="relative mt-4 rounded-lg border border-line/70 bg-ink/40 text-sm">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs text-muted hover:text-fg">Detalji izvlačenja (ticket i rijetkost)</summary>
          <div className="divide-y divide-line/60 px-3 pb-2">
            {items.map((it, k) =>
              it.roll ? (
                <div key={k} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-2 sm:grid-cols-[minmax(0,1fr)_7rem_9rem_minmax(0,12rem)]">
                  <span className="truncate font-semibold">{it.brand} {it.model}</span>
                  <span className="text-right tabular-nums text-muted sm:text-left" title="Izvučeni broj od 0 do 1 (auti poredani od najjeftinijeg do najskupljeg)">#{Math.floor(Number(it.roll.ticket) * 100000).toString().padStart(5, "0")}</span>
                  <span className="tabular-nums" style={{ color: RARITY[it.rarity].color }}>
                    {fmtPct(Number(it.roll.chance))} · 1 u {oneIn(Number(it.roll.chance))}
                  </span>
                  <span className="text-right text-xs text-muted sm:text-left">
                    {it.roll.top ? "Najrjeđi auto u kutiji" : `Do skupljeg auta falilo ${fmtPct(Number(it.roll.gap))}`}
                  </span>
                </div>
              ) : null
            )}
            <p className="pt-2 text-xs text-muted">Ticket je broj od 00000 do 99999. Auti su poredani od najjeftinijeg do najskupljeg, pa što je ticket bliže 99999, to je drop rjeđi.</p>
          </div>
        </details>
      )}
    </div>
  );
}
