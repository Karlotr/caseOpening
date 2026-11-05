import Link from "next/link";
import type { CaseWithItems } from "@/lib/types";
import { coins } from "@/lib/format";
import { CarImage } from "./CarImage";
import { LevelCaseStatus } from "./LevelCaseStatus";

// Kutija kao izložbeni salon: reflektor u boji kutije, sjajni pod, najskuplji auto s odrazom
export function CaseArt({ c, className = "", big = false }: { c: CaseWithItems; className?: string; big?: boolean }) {
  const top = c.items[0];
  return (
    <div className={`showroom relative overflow-hidden rounded-xl ${className}`} style={{ ["--glow" as string]: c.color }}>
      {/* snop reflektora */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[70%] -translate-x-1/2 bg-[linear-gradient(180deg,#ffffff1f,transparent_70%)] [clip-path:polygon(38%_0,62%_0,100%_100%,0_100%)]" />
      <div className="showroom-floor absolute inset-x-0 bottom-0 h-[34%]" />
      {top && (
        <div className="absolute inset-x-0 bottom-[22%] flex justify-center">
          <CarImage item={top} reflect className={`${big ? "h-[58%] max-h-40" : "h-[50%] max-h-28"} w-[78%] transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-[1.06]`} />
        </div>
      )}
    </div>
  );
}

export function CaseCard({ c }: { c: CaseWithItems }) {
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
        <CaseArt c={c} className="aspect-[4/3]" />
        {c.case_type === "level" && <LevelCaseStatus caseId={c.id} minLevel={c.min_level} />}
      </div>
      <div className="px-2 pb-1.5 pt-3">
        <div className="font-display text-[22px] font-extrabold leading-[1]">{c.name}</div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm text-muted">do {top ? `${top.brand} ${top.model}` : "—"}</span>
          <span className="shrink-0 rounded-lg bg-black/30 px-2 py-1 font-display text-lg font-extrabold ring-1 ring-white/10">{price}</span>
        </div>
      </div>
    </Link>
  );
}
