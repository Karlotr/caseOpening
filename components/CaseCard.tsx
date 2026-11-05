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

// Kutija kao 3D "lootbox" sanduk (vlastiti SVG crtež) obojan bojom kutije: okovi i kopče, svjetleći utori,
// amblem na prednjoj strani s idejom kutije (50/50, 1%…), a najskuplji auto stoji preko sanduka u kutu.
export function CaseArt({ c, className = "", big = false }: { c: CaseWithItems; className?: string; big?: boolean }) {
  const top = c.items[0];
  const col = c.color;
  const id = `ca${c.id}`;
  const tag = caseTag(c);
  const gemCase = c.case_type === "gem";
  const premium = c.price >= 1000 || (c.gem_price ?? 0) >= 500;
  const mix = (pct: number, w: string) => `color-mix(in srgb, ${col} ${pct}%, ${w})`;
  const dark = "#1d2230";
  const steel = "#3a4256";
  return (
    <div
      className={`@container relative overflow-hidden rounded-xl ${className}`}
      style={{ background: `radial-gradient(70% 60% at 45% 42%, color-mix(in srgb, ${col} 40%, transparent), transparent 72%), linear-gradient(180deg, #19173f, #0a0a18)` }}
    >
      {/* reflektori */}
      <div className="case-beam pointer-events-none absolute -top-[10%] left-[16%] h-[90%] w-[22%] -rotate-[18deg]" style={{ background: `linear-gradient(180deg, ${mix(45, "#fff 20%")}, transparent 80%)` }} />
      <div className="case-beam case-beam-2 pointer-events-none absolute -top-[10%] right-[24%] h-[90%] w-[22%] rotate-[18deg]" style={{ background: `linear-gradient(180deg, ${mix(45, "#fff 20%")}, transparent 80%)` }} />

      <svg viewBox="0 0 200 150" className="case-crate absolute inset-x-[2%] top-[4%] h-[92%] w-[96%] transition-transform duration-500 group-hover:-translate-y-[2%] group-hover:scale-[1.03]" aria-hidden>
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: mix(78, "#fff") }} />
            <stop offset="1" style={{ stopColor: mix(70, "#000") }} />
          </linearGradient>
          <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: mix(65, "#000") }} />
            <stop offset="1" style={{ stopColor: mix(40, "#000") }} />
          </linearGradient>
          <linearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: mix(55, "#fff") }} />
            <stop offset="1" style={{ stopColor: mix(85, "#fff") }} />
          </linearGradient>
          <radialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
            <stop offset="0" style={{ stopColor: mix(100, "#fff") }} stopOpacity=".9" />
            <stop offset="1" style={{ stopColor: col }} stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* sjena na podu */}
        <ellipse cx="102" cy="138" rx="86" ry="9" fill="#000" opacity=".45" />
        <ellipse cx="102" cy="138" rx="70" ry="6" style={{ fill: col }} opacity=".35" />
        {/* lica sanduka */}
        <polygon points="22,58 112,80 112,134 22,112" fill={`url(#${id}f)`} />
        <polygon points="112,80 180,57 180,110 112,134" fill={`url(#${id}s)`} />
        <polygon points="22,58 90,36 180,57 112,80" fill={`url(#${id}t)`} />
        {/* panel na poklopcu */}
        <polygon points="52,57 90,45 148,57 110,70" fill="#ffffff" opacity=".1" stroke="#ffffff" strokeOpacity=".25" strokeWidth=".8" />
        {/* traka poklopca */}
        <polygon points="22,70 112,92 112,99 22,77" fill={dark} />
        <polygon points="112,92 180,69 180,76 112,99" fill={dark} opacity=".9" />
        {/* svjetleći utori */}
        <rect x="36" y="88" width="3.5" height="16" rx="1.5" transform="skewY(14)" style={{ fill: mix(100, "#fff 40%") }} className="case-slot" />
        <rect x="96" y="102" width="3.5" height="16" rx="1.5" transform="skewY(14)" style={{ fill: mix(100, "#fff 40%") }} className="case-slot" />
        <rect x="160" y="80" width="3" height="16" rx="1.5" transform="skewY(-18)" style={{ fill: mix(100, "#fff 40%") }} className="case-slot" opacity=".8" />
        {/* okovi na rubovima */}
        <path d="M22,58 L22,112 M112,80 L112,134 M180,57 L180,110" stroke={steel} strokeWidth="7" strokeLinecap="round" />
        <path d="M22,58 L90,36 L180,57 L112,80 Z" fill="none" stroke={steel} strokeWidth="4.5" strokeLinejoin="round" />
        <path d="M22,112 L112,134 L180,110" fill="none" stroke={steel} strokeWidth="5" strokeLinejoin="round" />
        {/* kopče */}
        <rect x="45" y="70" width="9" height="12" rx="2" transform="skewY(14)" fill="#cbd5e1" stroke="#1f2937" strokeWidth=".8" />
        <rect x="83" y="80" width="9" height="12" rx="2" transform="skewY(14)" fill="#cbd5e1" stroke="#1f2937" strokeWidth=".8" />
        <rect x="143" y="105" width="8" height="11" rx="2" transform="skewY(-18)" fill="#aab4c3" stroke="#1f2937" strokeWidth=".8" />
        {/* amblem s idejom kutije */}
        <g transform="translate(67 110) skewY(14)">
          <rect x="-24" y="-10" width="48" height="22" rx="5" fill={dark} stroke="#ffffff" strokeOpacity=".3" strokeWidth=".8" />
          <rect x="-22" y="-8" width="44" height="18" rx="4" fill={`url(#${id}g)`} opacity=".35" />
          {tag ? (
            <text x="0" y="6.5" textAnchor="middle" fontSize={tag.length > 4 ? 11 : 14} fontWeight="900" fill="#fff" style={{ fontFamily: "var(--font-display)" }}>
              {tag}
            </text>
          ) : (
            <path d="M0,-6 L7,7 L-7,7 Z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" opacity=".85" />
          )}
        </g>
        {/* metalni odsjaj */}
        <polygon className="case-crate-sheen" points="22,58 40,52 40,107 22,112" fill="#fff" opacity=".12" />
      </svg>

      {/* auto preko sanduka u kutu */}
      {top && (
        <div className="pointer-events-none absolute bottom-[3%] right-[-2%] flex h-[50%] w-[64%] items-end justify-end">
          <CarImage item={top} reflect={big} className="h-full w-full drop-shadow-[0_8px_10px_#000d] transition-transform duration-500 group-hover:-translate-x-[4%] group-hover:scale-[1.06]" />
        </div>
      )}

      {premium && (
        <>
          <i className="case-spark" style={{ left: "14%", top: "26%", animationDelay: "0s" }} />
          <i className="case-spark" style={{ left: "60%", top: "14%", animationDelay: ".9s" }} />
          <i className="case-spark" style={{ left: "40%", top: "70%", animationDelay: "1.7s" }} />
        </>
      )}
      {gemCase && (
        <span className="absolute left-[5%] top-[6%] rounded-md bg-emerald-400/90 px-1.5 py-0.5 font-display text-[10px] font-black text-ink shadow-[0_2px_8px_#000a]">
          <span className="gem" /> GEM
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
