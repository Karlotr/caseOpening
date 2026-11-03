import Link from "next/link";
import type { CaseWithItems } from "@/lib/types";
import { coins } from "@/lib/format";
import { CarArt } from "./CarArt";

export function CaseArt({ c, className = "" }: { c: CaseWithItems; className?: string }) {
  const top = c.items[0];
  return (
    <div
      className={`relative grid place-items-center overflow-hidden rounded-lg ${className}`}
      style={{ background: `radial-gradient(80% 80% at 50% 30%, ${c.color}55, ${c.color}10 60%, transparent), linear-gradient(180deg, #1b1e25, #121418)` }}
    >
      <div className="absolute inset-x-6 top-1/2 h-[46%] -translate-y-1/2 rounded-md border-2 border-white/10 bg-black/30" style={{ boxShadow: `0 0 40px ${c.color}40` }} />
      <div className="checker-strip absolute inset-x-6 top-[27%]" />
      {top && <CarArt id={top.id} body={top.body} rarity={top.rarity} className="relative h-20 w-44 drop-shadow-[0_8px_16px_rgba(0,0,0,.6)]" />}
    </div>
  );
}

export function CaseCard({ c }: { c: CaseWithItems }) {
  const price =
    c.case_type === "gem" ? (
      <span className="text-emerald-400"><span className="gem" /> {coins(c.gem_price)}</span>
    ) : c.case_type === "level" ? (
      <span className="text-sky-400">Level {c.min_level}+</span>
    ) : c.case_type === "daily" ? (
      <span className="text-emerald-400">Besplatno</span>
    ) : (
      <span className="text-accent"><span className="coin" /> {coins(c.price)}</span>
    );
  return (
    <Link href={`/cases/${c.slug}`} className="card group overflow-hidden p-3 transition hover:-translate-y-0.5 hover:border-white/25">
      <CaseArt c={c} className="h-36" />
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-display font-semibold tracking-wide">{c.name}</div>
          <div className="truncate text-xs text-muted">{c.items.length} automobila</div>
        </div>
        <div className="shrink-0 font-display text-sm">{price}</div>
      </div>
    </Link>
  );
}
