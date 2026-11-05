"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Item } from "@/lib/types";
import { RARITY, coins } from "@/lib/format";
import { rarityRank, sfx } from "@/lib/sound";
import { CarImage } from "./CarImage";

const GOLD_RANK = 4; // zamjensko pravilo (bez goldMin): legendarni i mitski su "zlatni"

// Zlatni drop (tajna) — dijamant iz public/diamond.webp sa zrakama, sjajem, odsjajem i iskricama.
// Zlatnih je malo (dinamični prag, lib/gold.ts), pa si možemo priuštiti bogatije efekte.
// Animira se samo transform/opacity; efekti rade i dok se traka vrti (zlatni obrub, zrake, sjaj).
const BURST = Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2);
function GoldTile({ big = false, vertical = false, small = false }: { big?: boolean; vertical?: boolean; small?: boolean }) {
  const S = big ? (small ? 108 : 124) : vertical || small ? 60 : 76;
  return (
    <div className={`gold-tile relative grid place-items-center ${big ? "gold-pop" : ""}`} style={{ width: S, height: S }}>
      <div className={`gold-rays ${big ? "gold-rays-fast" : ""}`} />
      <div className="gold-aura absolute -inset-[30%] rounded-full bg-[radial-gradient(circle,#facc15aa_0%,#f59e0b44_38%,transparent_68%)]" />
      <div className="gold-float relative h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/diamond.webp" alt="" width={S} height={S} draggable={false} decoding="async" className="gold-img h-full w-full select-none" />
        {/* odsjaj samo po obliku dijamanta (maska) */}
        <span className="gold-shine-mask">
          <span className="gold-shine-bar" />
        </span>
      </div>
      <i className="gold-spark" style={{ top: "2%", left: "80%", animationDelay: "0s" }} />
      <i className="gold-spark" style={{ top: "70%", left: "4%", animationDelay: ".9s" }} />
      <i className="gold-spark" style={{ top: "12%", left: "6%", animationDelay: "1.7s" }} />
      {big && (
        <>
          <span className="gold-ring" />
          <span className="gold-ring gold-ring-2" />
          {BURST.map((a, i) => (
            <i key={i} className="gold-burst" style={{ ["--bx" as string]: `${Math.cos(a) * (90 + (i % 3) * 18)}px`, ["--by" as string]: `${Math.sin(a) * (90 + (i % 3) * 18)}px`, animationDelay: `${(i % 4) * 25}ms` }} />
          ))}
        </>
      )}
    </div>
  );
}

// Near-miss (samo vizualno, ishod se ne mijenja): ponekad je odmah do dobitka skuplji auto,
// a traka prvo stane malo bliže njemu pa se poravna. Rijetko i blago, da ne bude očito.
const NEAR_MISS = 0.16;

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
  goldMin,
  onDone,
}: {
  items: Item[];
  winnerIndex: number;
  spinKey: number;
  duration?: number;
  vertical?: boolean;
  sound?: boolean;
  goldSound?: boolean; // zvukovi zlatne vrtnje i kad je `sound` isključen (battle: sve trake)
  size?: "sm" | "md" | "lg"; // sm: kompaktna vodoravna traka (battle)
  pool?: Item[]; // svi auti iz kutije (za drugu, "zlatnu" vrtnju)
  goldMin?: number; // dinamični prag zlatnog dropa za ovu kutiju (lib/gold.ts)
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
  const sm = size === "sm" && !vertical;
  const tile = vertical ? 112 : lg ? 188 : sm ? 116 : 156;
  const H = lg ? 214 : sm ? 150 : 172;
  const isGold = (it: Item) => (goldMin !== undefined ? it.value >= goldMin : rarityRank(it.rarity) >= GOLD_RANK);
  const goldRef = useRef(isGold);
  useLayoutEffect(() => {
    goldRef.current = isGold;
  });
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

    const run = (len: number, onLand: () => void, goldSpin = false, lean = 0) => {
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
          // lean ≠ 0: stani bliže susjedu (near-miss), inače nasumično unutar polja
          setOffset(center + (lean ? lean * tile * (0.3 + Math.random() * 0.12) : (Math.random() - 0.5) * tile * 0.7));
          if (sound) sfx.spin();
          // praćenje pozicije (za tick zvuk) čita getComputedStyle svaki frame — skupo; radi samo traka koja svira
          if (goldSpin ? gs : sound) raf = requestAnimationFrame(watch);
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

    let base = itemsRef.current;
    const winner = base[winnerIndex];
    const src = poolRef.current ?? base;
    const gold = goldRef.current;
    // near-miss: skuplji auto iz kutije (gornjih ~15%) odmah iznad/ispod dobitka
    let lean = 0;
    if (winner && !gold(winner) && Math.random() < NEAR_MISS) {
      // prvo skuplji "obični" auti; zlatni dijamant do dobitka samo ponekad (inače je previše očito)
      const pricier = [...src].filter((i) => i.value > winner.value * 2).sort((a, b) => b.value - a.value);
      const plain = pricier.filter((i) => !gold(i));
      const pickFrom = plain.length ? plain : Math.random() < 0.4 ? pricier : [];
      const top = pickFrom.slice(0, Math.max(1, Math.ceil(pickFrom.length * 0.35)));
      if (top.length) {
        lean = Math.random() < 0.5 ? -1 : 1;
        const n = winnerIndex + lean;
        if (n >= 0 && n < base.length) {
          base = base.slice();
          base[n] = top[Math.floor(Math.random() * top.length)];
        } else lean = 0;
      }
    }
    let rare = src.filter(gold);
    // za napetost u drugoj traci: ako je malo zlatnih, dodaj i one malo ispod praga
    if (rare.length > 0 && rare.length < 4) {
      const minGold = Math.min(...rare.map((i) => i.value));
      rare = src.filter((i) => i.value >= minGold * 0.35);
    }
    const golden = !!winner && gold(winner) && rare.length > 0;

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
    }, false, lean);

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
      className={`reel relative w-full min-w-0 overflow-hidden rounded-2xl border [contain:layout_paint] ${stage === "spin" || stage === "spin2" ? "reel-moving" : ""} bg-[linear-gradient(180deg,#0c0c1c,#07070f)] transition-colors duration-500 ${vertical ? "h-[260px] md:h-[336px]" : ""} ${stage === "spin2" ? "bg-[radial-gradient(circle,#facc1522,transparent_70%)]" : ""}`}
      style={{ height: vertical ? undefined : H, borderColor: glow ?? "var(--color-line)", boxShadow: glow ? `0 0 30px ${glow}55, inset 0 0 40px ${glow}22` : undefined }}
    >
      <div
        ref={track}
        className={`${vertical ? "flex flex-col" : "flex"} ${animate ? "will-change-transform" : ""}`}
        style={{
          transform: vertical ? `translateY(${-offset}px)` : `translateX(${-offset}px)`,
          transition: animate ? `transform ${dur}ms ${ease}` : "none",
        }}
      >
        {strip.map((it, i) => {
          const c = RARITY[it.rarity].color;
          const isWin = (landed || stage === "gold") && i === winnerIndex;
          const hidden = showGoldHidden && isGold(it);
          return (
            <div
              key={i}
              className={`relative flex shrink-0 flex-col items-center justify-center ${isWin ? "landed z-10" : ""} ${hidden ? "gold-cell" : ""}`}
              style={{
                width: vertical ? "100%" : tile,
                height: vertical ? tile : H,
                borderRight: vertical ? undefined : "1px solid #ffffff0a",
                borderBottom: vertical ? "1px solid #ffffff0a" : undefined,
                background: hidden ? "radial-gradient(75% 70% at 50% 50%, #facc1566, #f59e0b1f 55%, transparent 75%), linear-gradient(180deg, #facc150d, #facc1526)" : `radial-gradient(90% 70% at 50% 100%, ${c}${isWin ? "88" : "38"}, transparent 70%)`,
                opacity: (landed || stage === "gold") && !isWin ? 0.25 : 1,
                transition: "opacity .4s",
              }}
            >
              {hidden ? (
                <GoldTile big={isWin && stage === "gold"} vertical={vertical} small={sm} />
              ) : (
                <>
                  <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: c }} />
                  <CarImage item={it} eager thumb className={vertical ? "h-11 w-24" : lg ? "h-20 w-40" : sm ? "h-12 w-24" : "h-16 w-32"} />
                  <div className="mt-0.5 w-full truncate px-2 text-center text-[11px] text-muted">{it.brand}</div>
                  <div className={`w-full truncate px-2 text-center font-semibold leading-tight ${isWin ? "text-[15px]" : "text-[13px]"}`}>{it.model}</div>
                  <span className={`plate mt-1 ${lg ? "text-base" : sm ? "text-[11px]" : "text-[13px]"} ${isWin ? "scale-125 transition-transform" : ""}`}>{coins(it.value)}</span>
                  {isWin && <span className="mt-1 text-xs font-bold" style={{ color: c }}>{RARITY[it.rarity].label}</span>}
                </>
              )}
            </div>
          );
        })}
      </div>
      {/* kratki bljesak u boji rijetkosti kad traka stane (jači za rjeđe) */}
      {landed && (
        <div
          key={`hit${spinKey}`}
          className="reel-hit pointer-events-none absolute inset-0 z-20 rounded-2xl"
          style={{ ["--hc" as string]: wc, ["--hp" as string]: String(0.45 + 0.14 * Math.min(4, rarityRank(winner?.rarity ?? "common"))) }}
        />
      )}
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
