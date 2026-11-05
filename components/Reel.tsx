"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Item } from "@/lib/types";
import { RARITY, coins } from "@/lib/format";
import { rarityRank, sfx } from "@/lib/sound";
import { CarImage } from "./CarImage";

const GOLD_RANK = 4; // legendarni i mitski auti se u traci skrivaju iza zlatnog dijamanta

// Zlatni dijamant (tajna) — kao "gold" u CS kutijama: zrake, pulsiranje, odsjaj i iskrice
function GoldTile({ big = false }: { big?: boolean }) {
  const d = big ? "h-24 w-24" : "h-12 w-12";
  return (
    <div className={`gold-tile relative grid place-items-center ${big ? "h-28 w-28" : "h-14 w-14"}`}>
      {/* rotirajuće zlatne zrake */}
      <div className="gold-rays pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[260%] rounded-full" />
      <div className="gold-aura absolute inset-0 rounded-full bg-[radial-gradient(circle,#facc15aa,transparent_65%)] blur-md" />
      <div className={`gold-gem relative ${d} overflow-hidden bg-[linear-gradient(135deg,#fff7c2,#facc15_35%,#d97706_70%,#fde68a)] shadow-[0_0_24px_#facc15]`} style={{ clipPath: "polygon(50% 0, 100% 38%, 50% 100%, 0 38%)" }}>
        {/* odsjaj koji prelazi preko dijamanta */}
        <span className="gold-shine absolute inset-y-0 -left-full w-full bg-[linear-gradient(100deg,transparent_30%,#ffffffcc_50%,transparent_70%)]" />
      </div>
      <span className={`absolute font-display font-black text-amber-900 ${big ? "text-4xl" : "text-xl"}`} style={{ marginTop: big ? -10 : -6 }}>?</span>
      {/* iskrice */}
      <i className="gold-spark" style={{ top: "6%", left: "78%", animationDelay: "0s" }} />
      <i className="gold-spark" style={{ top: "70%", left: "8%", animationDelay: ".7s" }} />
      <i className="gold-spark" style={{ top: "18%", left: "4%", animationDelay: "1.3s" }} />
      <i className="gold-spark" style={{ top: "82%", left: "84%", animationDelay: "1.9s" }} />
    </div>
  );
}

const SPIN_EASE = "cubic-bezier(0.08, 0.6, 0.12, 1)";
const SETTLE_EASE = "cubic-bezier(0.45, 0, 0.2, 1)"; // kratko poravnanje na sredinu nakon zaustavljanja

type Stage = "idle" | "spin" | "gold" | "spin2" | "done";

// Spinner: lista predmeta, pobjednik na `winnerIndex`. Promjena `spinKey` pokreće animaciju.
// Ako je pobjednik legendaran ili mitski, prvo stane na zlatni dijamant, pa se vrti druga traka samo s rijetkima.
export function Reel({
  items,
  winnerIndex,
  spinKey,
  duration = 5000,
  vertical = false,
  sound = true,
  goldSound,
  size = "md",
  pool,
  onDone,
}: {
  items: Item[];
  winnerIndex: number;
  spinKey: number;
  duration?: number;
  vertical?: boolean;
  sound?: boolean;
  goldSound?: boolean; // zvukovi zlatne vrtnje i kad je `sound` isključen (battle: sve trake)
  size?: "md" | "lg";
  pool?: Item[]; // svi auti iz kutije (za drugu, "zlatnu" vrtnju)
  onDone?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [dur, setDur] = useState(duration);
  const [ease, setEase] = useState(SPIN_EASE);
  const [stage, setStage] = useState<Stage>("idle");
  const [strip, setStrip] = useState<Item[]>(items);
  const lg = size === "lg" && !vertical;
  const tile = vertical ? 112 : lg ? 188 : 156;
  const H = lg ? 214 : 172;
  const doneRef = useRef(onDone);
  const itemsRef = useRef(items);
  const poolRef = useRef(pool);
  // useLayoutEffect (i to PRIJE efekta vrtnje) — inače vrtnja krene sa starom trakom iz prošlog otvaranja
  useLayoutEffect(() => {
    doneRef.current = onDone;
    itemsRef.current = items;
    poolRef.current = pool;
  }, [onDone, items, pool]);

  // prije prve vrtnje prikaži trenutne predmete
  useEffect(() => {
    if (stage === "idle") setStrip(items);
  }, [items, stage]);

  // vrtnju pokreće SAMO nova vrijednost spinKey (ne promjena brzine, veličine itd.)
  const gs = goldSound ?? sound;
  const cfg = useRef({ winnerIndex, duration, vertical, tile, sound, gs });
  useLayoutEffect(() => {
    cfg.current = { winnerIndex, duration, vertical, tile, sound, gs };
  }, [winnerIndex, duration, vertical, tile, sound, gs]);

  useLayoutEffect(() => {
    if (!spinKey || !box.current) return;
    const { winnerIndex, duration, vertical, tile, sound, gs } = cfg.current;
    const size = vertical ? box.current.clientHeight : box.current.clientWidth;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let raf = 0;

    const run = (len: number, onLand: () => void, goldSpin = false) => {
      let lastIdx = -1;
      setEase(SPIN_EASE);
      const t0 = performance.now();
      const watch = () => {
        if (!track.current) return;
        const m = new DOMMatrixReadOnly(getComputedStyle(track.current).transform);
        const pos = -(vertical ? m.m42 : m.m41) + size / 2;
        const idx = Math.floor(pos / tile);
        if (idx !== lastIdx) {
          if (lastIdx !== -1 && (goldSpin ? gs : sound)) (goldSpin ? sfx.goldTick : sfx.tick)();
          lastIdx = idx;
        }
        if (performance.now() - t0 < len + 100) raf = requestAnimationFrame(watch);
      };
      // traka stane negdje na kartici (napetost), pa se glatko poravna točno na sredinu.
      // Ukupno trajanje ostaje `len` (battle tajming se ne mijenja).
      const settle = Math.min(420, len * 0.25);
      const center = winnerIndex * tile - size / 2 + tile / 2;
      setAnimate(false);
      setOffset(0);
      setDur(len - settle);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setAnimate(true);
          setOffset(center + (Math.random() - 0.5) * tile * 0.7);
          if (sound) sfx.spin();
          raf = requestAnimationFrame(watch);
        })
      );
      timers.push(
        setTimeout(() => {
          setEase(SETTLE_EASE);
          setDur(settle);
          setOffset(center);
        }, len - settle + 30)
      );
      timers.push(setTimeout(onLand, len + 80));
    };

    const finish = () => {
      setStage("done");
      const w = itemsRef.current[winnerIndex];
      if (w && golden && gs) sfx.goldWin();
      else if (w && sound) sfx.reveal(w.rarity);
      doneRef.current?.();
    };

    const base = itemsRef.current;
    const winner = base[winnerIndex];
    const src = poolRef.current ?? base;
    let rare = src.filter((i) => rarityRank(i.rarity) >= GOLD_RANK);
    // za napetost u drugoj traci: ako je malo legendarnih, dodaj i epske
    if (rare.length > 0 && rare.length < 4) rare = src.filter((i) => rarityRank(i.rarity) >= GOLD_RANK - 1);
    const golden = !!winner && rarityRank(winner.rarity) >= GOLD_RANK && rare.length > 0;

    setStrip(base);
    setStage("spin");
    run(duration, () => {
      if (!golden) return finish();
      // 1) zlatni dijamant "eksplodira"
      setStage("gold");
      if (gs) sfx.gold();
      timers.push(
        setTimeout(() => {
          // 2) druga vrtnja samo s rijetkim autima
          const s2 = Array.from({ length: Math.max(winnerIndex + 8, 30) }, () => rare[Math.floor(Math.random() * rare.length)]);
          s2[winnerIndex] = winner;
          setStrip(s2);
          setStage("spin2");
          run(Math.max(2200, duration * 0.6), finish, true);
        }, 1300)
      );
    });

    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, [spinKey]);

  const landed = stage === "done";
  const showGoldHidden = stage === "idle" || stage === "spin" || stage === "gold";
  const winner = strip[winnerIndex];
  const wc = winner ? RARITY[winner.rarity].color : "#f5821f";
  const glow = stage === "gold" ? "#facc15" : landed ? wc : null;

  return (
    <div
      ref={box}
      className={`reel relative w-full min-w-0 overflow-hidden rounded-2xl border bg-[linear-gradient(180deg,#0c0c1c,#07070f)] transition-colors duration-500 ${vertical ? "h-[260px] md:h-[336px]" : ""} ${stage === "spin2" ? "bg-[radial-gradient(circle,#facc1522,transparent_70%)]" : ""}`}
      style={{ height: vertical ? undefined : H, borderColor: glow ?? "var(--color-line)", boxShadow: glow ? `0 0 30px ${glow}55, inset 0 0 40px ${glow}22` : undefined }}
    >
      <div
        ref={track}
        className={vertical ? "flex flex-col" : "flex"}
        style={{
          transform: vertical ? `translateY(${-offset}px)` : `translateX(${-offset}px)`,
          transition: animate ? `transform ${dur}ms ${ease}` : "none",
        }}
      >
        {strip.map((it, i) => {
          const c = RARITY[it.rarity].color;
          const isWin = (landed || stage === "gold") && i === winnerIndex;
          const hidden = showGoldHidden && rarityRank(it.rarity) >= GOLD_RANK;
          return (
            <div
              key={i}
              className={`relative flex shrink-0 flex-col items-center justify-center ${isWin ? "landed z-10" : ""}`}
              style={{
                width: vertical ? "100%" : tile,
                height: vertical ? tile : H,
                borderRight: vertical ? undefined : "1px solid #ffffff0a",
                borderBottom: vertical ? "1px solid #ffffff0a" : undefined,
                background: hidden ? "radial-gradient(80% 70% at 50% 60%, #facc1555, transparent 72%), linear-gradient(180deg, transparent 60%, #facc151a)" : `radial-gradient(90% 70% at 50% 100%, ${c}${isWin ? "88" : "38"}, transparent 70%)`,
                opacity: (landed || stage === "gold") && !isWin ? 0.25 : 1,
                transition: "opacity .4s",
              }}
            >
              {hidden ? (
                <>
                  <GoldTile big={isWin && stage === "gold"} />
                  {!(isWin && stage === "gold") && <div className="gold-label mt-1 font-display text-sm font-bold">Rijetko</div>}
                </>
              ) : (
                <>
                  <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: c }} />
                  <CarImage item={it} className={vertical ? "h-11 w-24" : lg ? "h-20 w-40" : "h-16 w-32"} />
                  <div className="mt-0.5 w-full truncate px-2 text-center text-[11px] text-muted">{it.brand}</div>
                  <div className={`w-full truncate px-2 text-center font-semibold leading-tight ${isWin ? "text-[15px]" : "text-[13px]"}`}>{it.model}</div>
                  <span className={`plate mt-1 ${lg ? "text-base" : "text-[13px]"} ${isWin ? "scale-125 transition-transform" : ""}`}>{coins(it.value)}</span>
                  {isWin && <span className="mt-1 text-xs font-bold" style={{ color: c }}>{RARITY[it.rarity].label}</span>}
                </>
              )}
            </div>
          );
        })}
      </div>
      {stage === "gold" && <div className="flash pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle,#facc15aa,transparent_60%)]" />}
      {/* oznaka */}
      <div className={`pointer-events-none absolute z-20 ${vertical ? "inset-x-0 top-1/2 -translate-y-1/2" : "inset-y-0 left-1/2 -translate-x-1/2"}`}>
        {vertical ? (
          <>
            <div className="h-[2px] w-full bg-[linear-gradient(90deg,#ff2b4e,#ffb547,#ff2b4e)] shadow-[0_0_16px_#ff5a3c]" />
            <div className="absolute -left-1 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[7px] border-l-[9px] border-y-transparent border-l-accent" />
            <div className="absolute -right-1 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[7px] border-r-[9px] border-y-transparent border-r-accent" />
          </>
        ) : (
          <>
            <div className="h-full w-[2px] bg-[linear-gradient(180deg,#ff2b4e,#ffb547,#ff2b4e)] shadow-[0_0_16px_#ff5a3c]" />
            <div className="absolute -top-1 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[8px] border-t-[10px] border-x-transparent border-t-accent" />
            <div className="absolute -bottom-1 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[8px] border-b-[10px] border-x-transparent border-b-accent" />
          </>
        )}
      </div>
      <div className={`pointer-events-none absolute inset-0 z-10 ${vertical ? "bg-[linear-gradient(180deg,var(--color-ink),transparent_22%,transparent_78%,var(--color-ink))]" : "bg-[linear-gradient(90deg,var(--color-ink),transparent_18%,transparent_82%,var(--color-ink))]"}`} />
    </div>
  );
}
