import Link from "next/link";
import type { CaseWithItems } from "@/lib/types";
import { coins } from "@/lib/format";
import { CarImage } from "./CarImage";
import { LevelCaseStatus } from "./LevelCaseStatus";

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

// stabilni "nasumični" broj iz sluga — svaka kutija dobije svoj uzorak
const hashOf = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 2166136261);

// Kutija kao pravi kofer: poklopac s ručkom i kopčama, uzorak u boji kutije, prozor s najskupljim autom i oznaka ideje
export function CaseArt({ c, className = "", big = false }: { c: CaseWithItems; className?: string; big?: boolean }) {
  const top = c.items[0];
  const h = hashOf(c.slug);
  const col = c.color;
  const angle = h % 180;
  const kind = h % 3; // 0 pruge, 1 chevron, 2 točkice
  const pattern =
    kind === 0
      ? `repeating-linear-gradient(${angle}deg, #ffffff14 0 6%, transparent 6% 14%)`
      : kind === 1
        ? `repeating-linear-gradient(${45 + (angle % 30)}deg, #ffffff12 0 5%, transparent 5% 12%), repeating-linear-gradient(${-45 - (angle % 30)}deg, #ffffff10 0 5%, transparent 5% 12%)`
        : `radial-gradient(circle, #ffffff1c 0 18%, transparent 20%) 0 0 / 14% 14%`;
  const tag = caseTag(c);
  const gemCase = c.case_type === "gem";
  return (
    <div
      className={`@container relative overflow-hidden rounded-xl ${className}`}
      style={{ background: `radial-gradient(80% 70% at 50% 35%, color-mix(in srgb, ${col} 35%, transparent), transparent 70%), linear-gradient(180deg, #17153a, #0b0b1a)` }}
    >
      {/* tijelo kutije */}
      <div
        className="absolute left-[9%] right-[9%] top-[15%] bottom-[7%] rounded-[12%/16%] shadow-[0_10px_24px_-8px_#000c]"
        style={{
          background: `${pattern}, linear-gradient(160deg, color-mix(in srgb, ${col} 85%, #fff 15%), color-mix(in srgb, ${col} 70%, #000 30%) 55%, color-mix(in srgb, ${col} 45%, #000 55%))`,
          boxShadow: `inset 0 1px 0 #ffffff55, inset 0 -3px 0 #00000055, 0 0 28px -6px ${col}`,
        }}
      >
        {/* poklopac */}
        <div className="absolute inset-x-0 top-0 h-[28%] rounded-t-[inherit] border-b border-black/40 bg-black/25 shadow-[inset_0_1px_0_#ffffff40]" />
        {/* kopče */}
        <span className="absolute left-[14%] top-[22%] h-[14%] w-[8%] rounded-[25%] bg-[linear-gradient(180deg,#f8fafc,#94a3b8)] shadow-[0_1px_2px_#0008]" />
        <span className="absolute right-[14%] top-[22%] h-[14%] w-[8%] rounded-[25%] bg-[linear-gradient(180deg,#f8fafc,#94a3b8)] shadow-[0_1px_2px_#0008]" />
        {/* prozor s autom */}
        <div className="absolute inset-x-[10%] top-[36%] bottom-[10%] overflow-hidden rounded-[10%/16%] border border-white/15 bg-[linear-gradient(180deg,#0b0b1acc,#05050ccc)] shadow-[inset_0_2px_10px_#000c]">
          <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: `radial-gradient(60% 80% at 50% 100%, ${col}55, transparent 70%)` }} />
          {top && (
            <div className="absolute inset-0 flex items-center justify-center">
              <CarImage item={top} reflect={big} className="h-[78%] w-[86%] transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:scale-[1.06]" />
            </div>
          )}
          {/* odsjaj stakla */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,#ffffff1f_0%,transparent_35%,transparent_70%,#ffffff0d_100%)]" />
        </div>
      </div>
      {/* ručka */}
      <div className="absolute left-1/2 top-[7%] h-[11%] w-[26%] -translate-x-1/2 rounded-t-full border-[max(2px,1.2cqw)] border-b-0 border-white/70 shadow-[0_0_6px_#0008]" />
      {/* oznaka ideje kutije */}
      {(tag || gemCase) && (
        <span
          className="absolute right-[5%] top-[5%] rotate-[8deg] rounded-[0.35em] px-[0.45em] py-[0.15em] font-display font-black leading-none text-ink shadow-[0_2px_8px_#000a]"
          style={{ fontSize: "clamp(8px, 9cqw, 30px)", background: gemCase ? "linear-gradient(135deg,#a7f3d0,#10b981)" : "linear-gradient(135deg,#fff7c2,#facc15 55%,#f59e0b)" }}
        >
          {tag}
        </span>
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
