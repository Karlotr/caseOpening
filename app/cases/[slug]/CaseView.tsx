"use client";

import Link from "next/link";
import { useLimits } from "@/lib/useLimits";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCases, randomFromCase } from "@/lib/data";
import type { CaseWithItems, Item } from "@/lib/types";
import { RARITY, coins } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { sfx } from "@/lib/sound";
import { useAuth } from "@/components/AuthProvider";
import { fmtLeft, useNow } from "@/lib/useNow";
import { levelWait, useLevelClaims } from "@/lib/useLevelClaims";
import { useToast } from "@/components/Toast";
import { CaseArt } from "@/components/CaseCard";
import { ItemCard } from "@/components/ItemCard";
import { Reel } from "@/components/Reel";
import { RevealStage } from "@/components/RevealStage";
import { useCelebrate } from "@/components/WinOverlay";
import { goldThreshold, goldTier } from "@/lib/gold";

const WIN = 50;
type OpenResult = { items: Item[]; instant_drop: number | null };

export function CaseView() {
  const { slug } = useParams<{ slug: string }>();
  const { user, profile, holdWallet } = useAuth();
  const { claims: levelClaims, reload: reloadLevelClaims } = useLevelClaims();
  const now = useNow();
  const rpc = useRpc();
  const toast = useToast();
  const celebrate = useCelebrate();
  const limits = useLimits();
  const [c, setC] = useState<CaseWithItems | null>(null);
  const [missing, setMissing] = useState(false);
  const [count, setCount] = useState(1);
  const [fast, setFast] = useState(false);
  const [strips, setStrips] = useState<Item[][]>([]);
  const [spinKey, setSpinKey] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<Item[]>([]);
  const [showWon, setShowWon] = useState(false);
  const [instant, setInstant] = useState<number | null>(null);
  const [doorUp, setDoorUp] = useState(false);
  const [flash, setFlash] = useState<{ key: number; color: string } | null>(null);
  const [lastCost, setLastCost] = useState(0);
  const busyRef = useRef(false);
  const reelsDone = useRef(0);
  const reelBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCases().then((all) => {
      const f = all.find((x) => x.slug === slug);
      if (!f) setMissing(true);
      else {
        setC(f);
        setStrips([Array.from({ length: 60 }, () => randomFromCase(f))]);
      }
    });
  }, [slug]);

  const start = useCallback(
    (winners: Item[]) => {
      if (!c) return;
      setShowWon(false);
      setStrips(
        winners.map((w) => {
          const s = Array.from({ length: 60 }, () => randomFromCase(c));
          s[WIN] = w;
          return s;
        })
      );
      setWon(winners);
      reelsDone.current = 0;
      // mobitel: trake su ispod podataka o kutiji — skrolaj do njih kad krene vrtnja
      if (window.innerWidth < 1024) reelBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const go = () => {
        setSpinning(true);
        setSpinKey((k) => k + 1);
      };
      if (!doorUp) {
        sfx.door();
        setDoorUp(true);
        setTimeout(go, 650);
      } else go();
    },
    [c, doorUp]
  );

  const open = useCallback(async () => {
    if (!c || busyRef.current) return;
    busyRef.current = true;
    const n = c.case_type === "level" ? 1 : count;
    const res = await rpc<OpenResult>("open_case", { p_slug: c.slug, p_count: n }, { silentRefresh: true });
    if (!res) {
      busyRef.current = false;
      return;
    }
    // dobitak je već na računu — prikaži stanje "minus cijena" dok se ne odvrti
    if (profile && c.case_type === "normal") holdWallet({ balance: Math.max(0, profile.balance - c.price * n) });
    setInstant(res.instant_drop ? Number(res.instant_drop) : null);
    setLastCost(c.case_type === "normal" ? c.price * n : 0);
    start(res.items.map((i) => ({ ...i, value: Number(i.value) })));
  }, [c, count, rpc, start, profile, holdWallet]);

  const demo = () => {
    if (!c || busyRef.current) return;
    busyRef.current = true;
    setInstant(null);
    setLastCost(c.price * count);
    start(Array.from({ length: count }, () => ({ ...randomFromCase(c), inventory_id: undefined })));
  };

  const finished = async () => {
    setSpinning(false);
    busyRef.current = false;
    const best = won.reduce((a, b) => (b.value > a.value ? b : a), won[0]);
    if (best) setFlash({ key: Date.now(), color: RARITY[best.rarity].color });
    setShowWon(true);
    const real = !!won[0]?.inventory_id;
    if (!real) return;
    if (c?.case_type === "level") reloadLevelClaims();
    holdWallet(null);
    const total = won.reduce((s, w) => s + w.value, 0);
    const ratio = lastCost ? total / lastCost : 1;
    // overlay preko cijelog ekrana samo za ZLATNI drop: auto koji je jako velik u odnosu na ovu kutiju (lib/gold.ts)
    const goldMin = c ? goldThreshold(c) : Infinity;
    if (best && c && best.value >= goldMin) {
      setTimeout(
        () =>
          celebrate({
            title: best.value / (c.price || 1) >= 20 ? "Ogroman drop!" : "Zlatni drop!",
            subtitle: lastCost ? `${ratio.toFixed(2)}× uloga` : c?.name,
            items: won,
            amount: total,
            tier: goldTier(best.value, c),
          }),
        250 + won.length * 320
      );
    } else if (ratio >= 1) {
      setTimeout(() => sfx.win(1), 200 + won.length * 320);
    }
    if (instant) setTimeout(() => toast(`Instant drop! +${coins(instant)} coina na račun`, "gold"), 1200);
  };

  // nagrada tek kad su SVE trake stale (uključujući drugu, zlatnu vrtnju)
  const reelDone = () => {
    reelsDone.current += 1;
    if (reelsDone.current === won.length) finished();
  };



  // ako napustiš stranicu usred vrtnje, pokaži pravo stanje
  useEffect(() => () => holdWallet(null), [holdWallet]);

  // razmaknica = otvori ponovno (samo kad je već otvorena kutija i prikazan rezultat pravog otvaranja)
  useEffect(() => {
    if (!showWon || !won[0]?.inventory_id) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.code !== "Space" || ["INPUT", "TEXTAREA", "BUTTON", "SELECT"].includes(t.tagName)) return;
      e.preventDefault();
      if (user && c && c.case_type !== "daily") open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, user, c, showWon, won]);

  if (missing) return <div className="card p-8 text-center">Ova kutija ne postoji. <Link href="/cases" className="text-accent2">Natrag na kutije</Link></div>;
  if (!c) return <div className="card h-96 animate-pulse" />;

  const costLabel =
    c.case_type === "gem" ? (
      <><span className="gem" /> {coins((c.gem_price ?? 0) * count)}</>
    ) : c.case_type === "level" ? (
      "besplatno"
    ) : (
      <><span className="coin" /> {coins(c.price * count)}</>
    );
  const levelLocked = c.case_type === "level" && (profile?.level ?? 0) < c.min_level;
  // level kutija već otvorena u zadnja 24 h (ne dok se upravo vrti / prikazuje dobitak)
  const levelWaitMs = c.case_type === "level" && !levelLocked && !spinning && !showWon ? levelWait(levelClaims, c.id, now) : 0;
  const canOpen = !!user && c.case_type !== "daily" && !levelLocked && levelWaitMs <= 0;

  return (
    <div className="space-y-6">
      {flash && <div key={flash.key} className="flash pointer-events-none fixed inset-0 z-50" style={{ background: `radial-gradient(circle at 50% 40%, ${flash.color}, transparent 70%)` }} />}

      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/cases" className="hover:text-fg">Kutije</Link> <span>/</span> <span className="text-fg">{c.name}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="card self-start p-4">
          <CaseArt c={c} className="aspect-[4/3]" />
          <h1 className="mt-3 font-display text-4xl font-black leading-none tracking-tight">{c.name}</h1>
          <p className="mt-1 text-sm text-muted">{c.description}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
            <div className="rounded-md bg-ink/60 p-2">Najskuplji<div className="font-semibold text-fg">{c.items[0]?.model}</div></div>
            <div className="rounded-md bg-ink/60 p-2">Automobila<div className="font-semibold text-fg">{c.items.length}</div></div>
          </div>
        </div>

        <div className="card min-w-0 space-y-4 p-4">
          <div ref={reelBox} className="relative scroll-mt-20 space-y-2 overflow-hidden rounded-lg">
            {strips.map((s, i) => (
              <Reel key={i} size={strips.length === 1 ? "lg" : "md"} pool={c.items} goldMin={goldThreshold(c)} items={s} winnerIndex={WIN} spinKey={spinKey} duration={fast ? 1800 : 5600} sound={i === 0} onDone={reelDone} />
            ))}
            {/* garažna vrata */}
            <div
              className="door absolute inset-0 z-30 grid place-items-center rounded-lg border border-line"
              style={{ transform: doorUp ? "translateY(-102%)" : "none", backgroundColor: "#13203a", backgroundImage: `repeating-linear-gradient(180deg, rgba(255,255,255,.06) 0 2px, transparent 2px 16px), linear-gradient(180deg, ${c.color}55, #13203a 75%)` }}
              aria-hidden={doorUp}
            >
              <div className="text-center">
                <div className="font-display text-4xl font-black tracking-tight">{c.name}</div>
                <div className="mt-1 text-muted">{user ? "Otvori i vidi što je iza vrata" : "Prijavi se za otvaranje"}</div>
              </div>
              <div className="absolute bottom-3 left-1/2 h-2 w-24 -translate-x-1/2 rounded-full bg-white/15" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {c.case_type !== "level" && c.case_type !== "daily" && (
              <div className="flex overflow-hidden rounded-md border border-line" role="group" aria-label="Broj kutija">
                {Array.from({ length: limits.case_max_open }, (_, i) => i + 1).map((n) => (
                  <button key={n} disabled={spinning} onClick={() => setCount(n)} aria-pressed={count === n} className={`px-3.5 py-2 font-display text-lg font-bold ${count === n ? "bg-accent2 text-ink" : "bg-panel hover:bg-panel2"}`}>
                    {n}×
                  </button>
                ))}
              </div>
            )}
            {c.case_type === "daily" ? (
              <Link href="/rewards" className="btn-primary py-3 text-lg">Otvori na stranici Nagrade</Link>
            ) : !user ? (
              <Link href="/login" className="btn-primary py-3 text-lg">Prijavi se za otvaranje</Link>
            ) : (
              <button className={`btn-primary min-w-56 py-3 text-lg ${!spinning && canOpen && !showWon ? "glow-pulse" : ""}`} onClick={open} disabled={!canOpen || spinning}>
                {spinning ? "Vrti se…" : levelLocked ? `Potreban level ${c.min_level}` : levelWaitMs > 0 ? <>✓ Preuzeto · ponovno za {fmtLeft(levelWaitMs)}</> : <>Otvori za {costLabel}</>}
              </button>
            )}
            <button className="btn-ghost" onClick={demo} disabled={spinning}>Besplatna demo vrtnja</button>
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} className="accent-orange-500" /> Brzo otvaranje
            </label>
          </div>

          {showWon && won.length > 0 && (
            <RevealStage
              items={won}
              cost={lastCost}
              demo={!won[0].inventory_id}
              busy={spinning}
              onAgain={won[0].inventory_id ? (canOpen ? open : undefined) : demo}
              againLabel={won[0].inventory_id ? <>Otvori ponovno za {costLabel}</> : "Vrti demo ponovno"}
            />
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-display text-3xl font-extrabold tracking-tight">Što je u kutiji</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {c.items.map((i) => <ItemCard key={i.id} item={i} chance={i.chance} size="sm" />)}
        </div>
      </section>
    </div>
  );
}
