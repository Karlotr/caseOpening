"use client";

import Link from "next/link";
import type { CaseWithItems } from "@/lib/types";
import { coins } from "@/lib/format";
import { LevelCaseStatus } from "./LevelCaseStatus";
import { useFavorites } from "@/lib/favorites";

// oznaka koja opisuje ideju kutije (50/50, 30/70, 1%, 1:10, LVL 20…)
export function caseTag(c: Pick<CaseWithItems, "name" | "case_type" | "min_level" | "price">): string | null {
  const n = c.name;
  const ratio = n.match(/(\d+)\s*\/\s*(\d+)/);
  if (ratio) return `${ratio[1]}/${ratio[2]}`;
  const pct = n.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (pct) return `${pct[1]}%`;
  const odds = n.match(/(\d+)\s+u\s+(\d+)/i);
  if (odds) return `${odds[1]}:${odds[2]}`;
  if (c.case_type === "level") return `LVL ${c.min_level}`;
  if (c.case_type === "daily") return "FREE";
  if (c.case_type === "gem") return "GEM";
  if (c.price >= 10000) return "VIP";
  return null;
}

// Razina sanduka (vlastite slike public/cases/tier1-4) po vrijednosti kutije.
export function caseTier(c: Pick<CaseWithItems, "case_type" | "price" | "gem_price" | "min_level">): 1 | 2 | 3 | 4 {
  if (c.case_type === "daily") return 1;
  if (c.case_type === "level") return c.min_level < 10 ? 1 : c.min_level < 50 ? 2 : c.min_level < 150 ? 3 : 4;
  if (c.case_type === "gem") { const g = c.gem_price ?? 0; return g < 100 ? 2 : g < 1000 ? 3 : 4; }
  return c.price < 100 ? 1 : c.price < 1000 ? 2 : c.price < 10000 ? 3 : 4;
}

// mali, stalni pomak nijanse po kutiji da dvije kutije iste razine ne izgledaju isto
function caseHue(id: string | number): number {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 33) - 16;
}

// Kutija: sanduk razine 1-4, obojeni sjaj iza (boja kutije), sjaj koji prelazi preko sanduka,
// oznaka ideje kutije (50/50, 1%…) i po želji ime preko slike.
export function CaseArt({ c, className = "", label = false }: { c: CaseWithItems; className?: string; big?: boolean; label?: boolean }) {
  const col = c.color;
  const tag = caseTag(c);
  const tier = caseTier(c);
  const src = `/cases/tier${tier}.webp`;
  const hue = tier === 1 ? 0 : caseHue(c.id);
  const gemCase = c.case_type === "gem";
  const premium = tier >= 3;
  const mask = { WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" } as const;
  return (
    <div
      className={`@container relative overflow-hidden rounded-xl ${className}`}
      style={{ background: `radial-gradient(75% 65% at 50% 48%, color-mix(in srgb, ${col} 38%, transparent), transparent 74%), linear-gradient(180deg, #19173f, #0a0a18)` }}
    >
      {/* reflektori */}
      <div className="case-beam pointer-events-none absolute -top-[10%] left-[16%] h-[90%] w-[22%] -rotate-[18deg]" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${col} 45%, #fff 20%), transparent 80%)` }} />
      <div className="case-beam case-beam-2 pointer-events-none absolute -top-[10%] right-[24%] h-[90%] w-[22%] rotate-[18deg]" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${col} 45%, #fff 20%), transparent 80%)` }} />
      {/* sjaj u boji kutije iza sanduka */}
      <div className="case-glow pointer-events-none absolute inset-[12%_8%_6%]" style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${col} 85%, #fff 15%), transparent)` }} />

      <div className={`case-float absolute inset-x-[7%] transition-transform duration-500 group-hover:-translate-y-[2%] group-hover:scale-[1.04] ${label ? "top-[7%] bottom-[25%]" : "top-[9%] bottom-[9%]"}`}>
        {/* sjena na podu */}
        <div className="absolute inset-x-[10%] -bottom-[4%] h-[12%] rounded-[50%] bg-black/60 blur-[6px]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          className="relative h-full w-full select-none object-contain"
          style={{ filter: `hue-rotate(${hue}deg) drop-shadow(0 0 10px color-mix(in srgb, ${col} 55%, transparent))` }}
        />
        {/* sjaj koji prelazi samo preko sanduka */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={mask}>
          <div className="case-sheen absolute inset-y-0 left-0 w-[35%]" />
          {tier === 1 && <div className="absolute inset-0 mix-blend-color opacity-[.22]" style={{ background: col }} />}
        </div>
      </div>

      {tag && (
        <span className="absolute right-[5%] top-[6%] z-10 rounded-md @max-[130px]:hidden px-1.5 py-0.5 font-display text-[clamp(9px,6cqw,15px)] font-black leading-none text-white shadow-[0_2px_10px_#000a] ring-1 ring-white/25" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${col} 80%, #000), #0b0b16cc)` }}>
          {tag}
        </span>
      )}
      {premium && (
        <>
          <i className="case-spark" style={{ left: "14%", top: "26%", animationDelay: "0s" }} />
          <i className="case-spark" style={{ left: "62%", top: "14%", animationDelay: ".9s" }} />
          <i className="case-spark" style={{ left: "40%", top: "68%", animationDelay: "1.7s" }} />
          {tier === 4 && <i className="case-spark" style={{ left: "84%", top: "52%", animationDelay: "2.2s" }} />}
        </>
      )}
      {gemCase && !label && (
        <span className="absolute left-[5%] bottom-[6%] rounded-md bg-emerald-400/90 px-1.5 py-0.5 font-display text-[10px] font-black text-ink shadow-[0_2px_8px_#000a]">
          <span className="gem" /> GEM
        </span>
      )}
      {label && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-[5%] pb-[3%] pt-[10%]">
          <div className="truncate font-display text-[clamp(15px,9cqw,26px)] font-extrabold leading-tight text-white [text-shadow:0_2px_8px_#000,0_0_18px_var(--cg)]" style={{ ["--cg" as string]: col }}>
            {c.name}
          </div>
        </div>
      )}
    </div>
  );
}

export function CaseCard({ c }: { c: CaseWithItems }) {
  const { isFav, toggle } = useFavorites();
  const fav = isFav(c.id);
  const price =
    c.case_type === "gem" ? (
      <span className="text-emerald-300"><span className="gem" /> {coins(c.gem_price)}</span>
    ) : c.case_type === "level" ? (
      <span className="text-accent2">Level {c.min_level}+</span>
    ) : c.case_type === "daily" ? (
      <span className="text-emerald-300">Besplatno</span>
    ) : (
      <span className="text-accent"><span className="coin" /> {coins(c.price)}</span>
    );
  const top = c.items[0];
  return (
    <Link href={`/cases/${c.slug}`} className="spot group card relative overflow-hidden p-2 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_24px_60px_-24px_var(--g)]" style={{ ["--g" as string]: c.color }}>
      <div className="relative">
        <CaseArt c={c} label className="aspect-[4/3]" />
        {c.case_type === "level" && <LevelCaseStatus caseId={c.id} minLevel={c.min_level} />}
        {/* omiljena kutija */}
        <button
          type="button"
          aria-pressed={fav}
          aria-label={fav ? "Makni iz omiljenih" : "Dodaj u omiljene"}
          title={fav ? "Makni iz omiljenih" : "Dodaj u omiljene"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle(c.id);
          }}
          className={`absolute left-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-lg leading-none ring-1 transition hover:scale-110 ${fav ? "text-amber-300 ring-amber-300/60 shadow-[0_0_14px_#facc1588]" : "text-white/60 ring-white/15 hover:text-white"}`}
        >
          {fav ? "★" : "☆"}
        </button>
      </div>
      <div className="px-2 pb-1.5 pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm text-muted">do {top ? `${top.brand} ${top.model}` : "—"}</span>
          <span className="shrink-0 rounded-lg bg-black/30 px-2 py-1 font-display text-lg font-extrabold ring-1 ring-white/10">{price}</span>
        </div>
      </div>
    </Link>
  );
}
