"use client";

import { useEffect, useMemo, useState } from "react";
import { getItems } from "@/lib/data";
import type { Item, Rarity } from "@/lib/types";
import { RARITY, carName, coins } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { ItemCard } from "@/components/ItemCard";
import { NumberField } from "@/components/NumberField";
import { CarImage } from "@/components/CarImage";
import { RequireAuth } from "@/components/RequireAuth";
import { useCelebrate } from "@/components/WinOverlay";
import { sfx } from "@/lib/sound";

type Res = { won: boolean; chance: number; roll: number };

export default function UpgraderPage() {
  return (
    <RequireAuth what="koristiti upgrader">
      <Upgrader />
    </RequireAuth>
  );
}

function Upgrader() {
  const rpc = useRpc();
  const toast = useToast();
  const { profile, holdWallet } = useAuth();
  const celebrate = useCelebrate();
  const [all, setAll] = useState<Item[]>([]);
  const [extra, setExtra] = useState(0);
  const [target, setTarget] = useState<Item | null>(null);
  const [q, setQ] = useState("");
  const [angle, setAngle] = useState(0);
  const [anim, setAnim] = useState(false);
  const [result, setResult] = useState<Res | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getItems().then(setAll);
  }, []);

  const input = extra || 0;
  const chance = target && input > 0 ? Math.min((input / target.value) * 0.95, 0.8) : 0;
  // ulog ≥ vrijednost auta: nema smisla upgradeati (već ga "imaš"), pa ne pokazujemo zbunjujućih 80%
  const overTarget = !!target && input >= target.value;
  const shownChance = overTarget ? 1 : chance; // krug pun kad je ulog veći od auta
  // filteri i sortiranje popisa ciljeva (svi auti)
  const [rar, setRar] = useState<Rarity | "all">("all");
  const [cat, setCat] = useState("all");
  const [band, setBand] = useState<"all" | "lt100" | "100-1k" | "1k-10k" | "gt10k">("all");
  const [sort, setSort] = useState<"price-asc" | "price-desc" | "chance-desc" | "mult-desc">("price-asc");
  const [reachable, setReachable] = useState(true);
  const cats = useMemo(() => [...new Set(all.map((i) => i.category))].sort((a, b) => a.localeCompare(b, "hr")), [all]);
  const targets = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const inBand = (v: number) =>
      band === "all" || (band === "lt100" ? v < 100 : band === "100-1k" ? v >= 100 && v < 1000 : band === "1k-10k" ? v >= 1000 && v < 10000 : v >= 10000);
    const list = all.filter(
      (i) =>
        (!reachable || i.value > input) &&
        (rar === "all" || i.rarity === rar) &&
        (cat === "all" || i.category === cat) &&
        inBand(i.value) &&
        (!ql || `${carName(i)} ${i.year} ${i.category}`.toLowerCase().includes(ql))
    );
    const by = { "price-asc": (a: Item, b: Item) => a.value - b.value, "price-desc": (a: Item, b: Item) => b.value - a.value, "chance-desc": (a: Item, b: Item) => a.value - b.value, "mult-desc": (a: Item, b: Item) => b.value - a.value }[sort];
    return [...list].sort(by);
  }, [all, input, q, rar, cat, band, sort, reachable]);
  const chanceFor = (i: Item) => (input > 0 && i.value > input ? Math.min((input / i.value) * 0.95, 0.8) : 0);

  const setBet = (v: number) => {
    setResult(null);
    setExtra(Math.max(0, Math.round(v * 100) / 100));
  };

  const go = async () => {
    if (!target || busy) return;
    setBusy(true);
    setResult(null);
    const res = await rpc<Res>("upgrade_items", { p_ids: [], p_target_item: target.id, p_coins: input }, { silentRefresh: true });
    if (!res) return setBusy(false);
    if (profile) holdWallet({ balance: Math.max(0, profile.balance - input) });
    const roll = Number(res.roll);
    setAnim(false);
    setAngle(0);
    sfx.spin();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnim(true);
        setAngle(360 * 5 + roll * 360);
      })
    );
    setTimeout(async () => {
      setResult({ ...res, roll });
      if (res.won) {
        const mult = target.value / Math.max(input, 0.01);
        celebrate({ title: "Upgrade uspio!", subtitle: `${mult.toFixed(2)}× · šansa ${(Number(res.chance) * 100).toFixed(1)}% · isplaćeno na račun`, items: [target], amount: target.value, tier: mult >= 5 ? 3 : mult >= 2 ? 2 : 1 });
      } else {
        sfx.lose();
        toast(`Upgrade nije uspio. ${carName(target)} je ostao u salonu.`, "error");
      }
      holdWallet(null);
      setBusy(false);
    }, 4200);
  };

  const R = 84;
  const C = 2 * Math.PI * R;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Upgrader</h1>
        <p className="text-sm text-muted">Uloži coine i odaberi auto. Ako uspije, dobivaš njegovu vrijednost na račun. Maksimalna šansa 80%.</p>
      </div>

      {/* ARENA: ulog → kolo → cilj */}
      <div className="card relative overflow-hidden p-4 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_45%,#34d39914,transparent_70%)]" />
        <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          {/* ulog */}
          <div className="space-y-3">
            <div className="label">Tvoj ulog</div>
            <div className="flex items-center gap-3">
              <span className="relative grid h-14 w-14 shrink-0 place-items-center">
                {[0, 1, 2].map((k) => (
                  <span key={k} className="coin absolute" style={{ width: 40, height: 40, transform: `translate(${(k - 1) * 6}px, ${-k * 5}px)` }} />
                ))}
              </span>
              <div className="font-display text-3xl font-black tabular-nums text-accent sm:text-4xl">{coins(input)}</div>
            </div>
            <label className="label" htmlFor="extra">Ulog u coinima (stanje {coins(profile?.balance)})</label>
            <NumberField id="extra" className="input" value={extra} onChange={setBet} placeholder="0" />
            <div className="flex flex-wrap gap-1.5">
              {[1, 10, 50, 100].map((v) => (
                <button key={v} type="button" className="rounded-md border border-line px-2.5 py-1 text-sm font-semibold hover:border-accent" onClick={() => setBet(input + v)}>+{v}</button>
              ))}
              <button type="button" className="rounded-md border border-line px-2.5 py-1 text-sm font-semibold hover:border-accent" onClick={() => setBet(input / 2)}>½</button>
              <button type="button" className="rounded-md border border-line px-2.5 py-1 text-sm font-semibold hover:border-accent" onClick={() => setBet(input * 2)}>2×</button>
              <button type="button" className="rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:text-fg" onClick={() => setBet(0)}>Očisti</button>
            </div>
          </div>

          {/* kolo */}
          <div className="mx-auto grid place-items-center">
            <div className={`relative h-64 w-64 sm:h-72 sm:w-72 ${result ? (result.won ? "upg-win" : "upg-lose") : ""}`}>
              <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90">
                <defs>
                  <linearGradient id="upgArc" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor={result ? (result.won ? "#4ade80" : "#f87171") : "#6ee7b7"} />
                    <stop offset="1" stopColor={result ? (result.won ? "#16a34a" : "#dc2626") : "#10b981"} />
                  </linearGradient>
                  <filter id="upgGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="4" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                {/* crtice */}
                {Array.from({ length: 60 }, (_, i) => {
                  const a = (i / 60) * Math.PI * 2;
                  const r1 = 104, r2 = i % 5 === 0 ? 96 : 100;
                  return <line key={i} x1={110 + Math.cos(a) * r1} y1={110 + Math.sin(a) * r1} x2={110 + Math.cos(a) * r2} y2={110 + Math.sin(a) * r2} stroke="#ffffff" strokeOpacity={i % 5 === 0 ? 0.25 : 0.1} strokeWidth="1.5" />;
                })}
                <circle cx="110" cy="110" r={R} fill="none" stroke="#1c1d33" strokeWidth="16" />
                <circle
                  cx="110"
                  cy="110"
                  r={R}
                  fill="none"
                  stroke="url(#upgArc)"
                  strokeWidth="16"
                  strokeLinecap="round"
                  filter="url(#upgGlow)"
                  strokeDasharray={`${shownChance * C} ${C}`}
                  style={{ transition: "stroke-dasharray .45s cubic-bezier(.2,.8,.2,1)" }}
                />
              </svg>
              {/* pokazivač */}
              <div className="absolute inset-0" style={{ transform: `rotate(${angle}deg)`, transition: anim ? "transform 4s cubic-bezier(.1,.7,.1,1)" : "none" }}>
                <div className="absolute left-1/2 top-0 -translate-x-1/2">
                  <div className="h-0 w-0 border-x-[9px] border-t-[14px] border-x-transparent border-t-white drop-shadow-[0_0_8px_#fff]" />
                </div>
                <div className="absolute left-1/2 top-[16px] h-3 w-3 -translate-x-1/2 rounded-full bg-white shadow-[0_0_14px_4px_#ffffffaa]" />
              </div>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  {result ? (
                    <>
                      <div className={`pop font-display text-3xl font-black ${result.won ? "text-emerald-400" : "text-red-400"}`}>{result.won ? "USPJEH" : "PROMAŠAJ"}</div>
                      <div className="text-xs text-muted tabular-nums">šansa {(Number(result.chance) * 100).toFixed(2)}% · roll {(result.roll * 100).toFixed(2)}</div>
                    </>
                  ) : (
                    <>
                      <div className="font-display text-5xl font-black tabular-nums">{overTarget ? "100" : (chance * 100).toFixed(2)}<span className="text-2xl text-muted">%</span></div>
                      <div className="text-xs font-semibold uppercase tracking-widest text-muted">šansa</div>
                    </>
                  )}
                  {target && !result && !overTarget && (
                    <div className="mt-2 inline-block rounded-full bg-accent/15 px-3 py-0.5 font-display text-sm font-black tabular-nums text-accent ring-1 ring-accent/40">
                      {(target.value / Math.max(input, 0.01)).toFixed(2)}×
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button className="btn-primary mt-4 w-64 py-3 text-lg sm:w-72" disabled={!target || input <= 0 || busy || overTarget} onClick={go}>
              {busy ? "Vrti se..." : overTarget ? "Ulog je veći od auta" : "Upgradeaj"}
            </button>
          </div>

          {/* cilj */}
          <div className="space-y-2 lg:text-right">
            <div className="label lg:text-right">Ciljani automobil</div>
            {target ? (
              <div className="relative">
                <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(70% 60% at 50% 60%, ${RARITY[target.rarity].color}44, transparent 70%)` }} />
                <CarImage item={target} reflect className="relative mx-auto h-28 w-full max-w-72 lg:ml-auto lg:mr-0" />
                <div className="relative mt-2">
                  <div className="text-xs font-semibold" style={{ color: RARITY[target.rarity].color }}>{RARITY[target.rarity].label} · {target.brand} · {target.year}</div>
                  <div className="truncate font-display text-2xl font-black">{target.model}</div>
                  <div className="font-display text-2xl font-black tabular-nums text-accent">{coins(target.value)}</div>
                </div>
              </div>
            ) : (
              <div className="grid h-40 place-items-center rounded-2xl border border-dashed border-line text-sm text-muted">Odaberi auto iz popisa ispod.</div>
            )}
          </div>
        </div>
      </div>

      <div>
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-display text-lg font-bold">Odaberi cilj <span className="text-sm font-normal text-muted">({targets.length})</span></h2>
            <input className="input w-full sm:w-56" placeholder="Traži marku, model, godinu…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Traži auto" />
            <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sortiraj">
              <option value="price-asc">Cijena ↑</option>
              <option value="price-desc">Cijena ↓</option>
              <option value="chance-desc">Najveća šansa</option>
              <option value="mult-desc">Najveći multiplikator</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "common", "uncommon", "rare", "epic", "legendary", "mythic"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRar(r)}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition ${rar === r ? "text-ink" : "border-line text-muted hover:text-fg"}`}
                style={rar === r ? { background: r === "all" ? "#5ce1ff" : RARITY[r].color, borderColor: "transparent" } : r !== "all" ? { color: RARITY[r].color } : undefined}
              >
                {r === "all" ? "Sve rijetkosti" : RARITY[r].label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategorija">
              <option value="all">Sve kategorije</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex overflow-hidden rounded-xl border border-line text-xs font-bold" role="radiogroup" aria-label="Cijena">
              {([["all", "Sve cijene"], ["lt100", "< 100"], ["100-1k", "100–1k"], ["1k-10k", "1k–10k"], ["gt10k", "10k+"]] as const).map(([k, l]) => (
                <button key={k} role="radio" aria-checked={band === k} onClick={() => setBand(k)} className={`px-3 py-2 transition ${band === k ? "bg-accent2 text-ink" : "bg-panel hover:bg-panel2"}`}>{l}</button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={reachable} onChange={(e) => setReachable(e.target.checked)} className="accent-cyan-400" />
              Samo skuplji od uloga
            </label>
          </div>
          <div className="grid max-h-[640px] grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 overflow-y-auto overflow-x-hidden pr-1">
            {targets.map((i) => {
              const ch = chanceFor(i);
              return <ItemCard key={i.id} item={i} size="sm" chance={ch > 0 ? ch : undefined} selected={target?.id === i.id} onClick={() => { setTarget(i); setResult(null); }} />;
            })}
            {targets.length === 0 && <div className="col-span-full p-6 text-center text-sm text-muted">Nema auta za ove filtere.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
