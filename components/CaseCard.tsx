import Link from "next/link";
import type { CaseWithItems } from "@/lib/types";
import { coins } from "@/lib/format";
import { CarArt } from "./CarArt";

// Kutija kao garažni boks: roll-up vrata u boji kutije, najskuplji auto ispred
export function CaseArt({ c, className = "" }: { c: CaseWithItems; className?: string }) {
  const top = c.items[0];
  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`} style={{ background: `linear-gradient(180deg, ${c.color}55, ${c.color}14 70%, #0c1424)` }}>
      <div className="garage-door absolute inset-x-[10%] bottom-[18%] top-[12%] rounded-t-md border-x-2 border-t-2 border-white/10" style={{ background: `linear-gradient(180deg, ${c.color}30, transparent)` }}>
        <div className="garage-door absolute inset-0" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[18%] bg-[repeating-linear-gradient(90deg,#ffffff10_0_18px,transparent_18px_36px)]" />
      {top && (
        <div className="absolute inset-x-0 bottom-[6%] flex justify-center">
          <CarArt id={top.id} body={top.body} rarity={top.rarity} className="h-[52%] max-h-24 w-[70%] drop-shadow-[0_10px_14px_rgba(0,0,0,.7)]" />
        </div>
      )}
    </div>
  );
}

export function CaseCard({ c }: { c: CaseWithItems }) {
  const price =
    c.case_type === "gem" ? (
      <span className="font-display text-xl font-bold text-emerald-300"><span className="gem" /> {coins(c.gem_price)}</span>
    ) : c.case_type === "level" ? (
      <span className="font-display text-xl font-bold text-accent2">Level {c.min_level}+</span>
    ) : c.case_type === "daily" ? (
      <span className="font-display text-xl font-bold text-emerald-300">Besplatno</span>
    ) : (
      <span className="font-display text-xl font-bold text-accent"><span className="coin" /> {coins(c.price)}</span>
    );
  const top = c.items[0];
  return (
    <Link href={`/cases/${c.slug}`} className="group card relative overflow-hidden transition hover:-translate-y-1 hover:border-white/30 focus-visible:-translate-y-1">
      <CaseArt c={c} className="aspect-[4/3] rounded-none transition-transform duration-500 group-hover:scale-[1.03]" />
      <div className="absolute left-0 top-3 h-1.5 w-16" style={{ background: c.color }} />
      <div className="p-3">
        <div className="font-display text-2xl font-extrabold leading-[0.95] tracking-tight">{c.name}</div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm text-muted">do {top ? `${top.brand} ${top.model}` : "—"}</span>
          <span className="shrink-0">{price}</span>
        </div>
      </div>
    </Link>
  );
}
