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

// Kutija kao pravi kofer: poklopac s ručkom i kopčama, metalni sjaj, uzorak u boji kutije,
// auto koji "izlazi" iz prozora, reflektori i pod; na hover se poklopac odškrine i iznutra zasvijetli.
export function CaseArt({ c, className = "", big = false }: { c: CaseWithItems; className?: string; big?: boolean }) {
  const top = c.items[0];
  const h = hashOf(c.slug);
  const col = c.color;
  const angle = h % 180;
  const kind = h % 3; // 0 pruge, 1 rombovi, 2 točkice
  const pattern =
    kind === 0
      ? `repeating-linear-gradient(${angle}deg, #ffffff16 0 6%, transparent 6% 14%)`
      : kind === 1
        ? `repeating-linear-gradient(${45 + (angle % 30)}deg, #ffffff12 0 5%, transparent 5% 12%), repeating-linear-gradient(${-45 - (angle % 30)}deg, #ffffff10 0 5%, transparent 5% 12%)`
        : `radial-gradient(circle, #ffffff1e 0 18%, transparent 20%) 0 0 / 14% 14%`;
  const tag = caseTag(c);
  const gemCase = c.case_type === "gem";
  const premium = c.price >= 1000 || (c.gem_price ?? 0) >= 500;
  return (
    <div
      className={`@container relative overflow-hidden rounded-xl [perspective:600px] ${className}`}
      style={{ background: `radial-gradient(70% 60% at 50% 40%, color-mix(in srgb, ${col} 38%, transparent), transparent 72%), linear-gradient(180deg, #19173f, #0a0a18)` }}
    >
      {/* reflektori */}
      <div className="case-beam pointer-events-none absolute -top-[10%] left-[18%] h-[90%] w-[22%] -rotate-[18deg]" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${col} 45%, #fff 20%), transparent 80%)` }} />
      <div className="case-beam case-beam-2 pointer-events-none absolute -top-[10%] right-[18%] h-[90%] w-[22%] rotate-[18deg]" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${col} 45%, #fff 20%), transparent 80%)` }} />
      {/* pod */}
      <div className="pointer-events-none absolute bottom-[1%] left-1/2 h-[12%] w-[86%] -translate-x-1/2 rounded-[50%] blur-[2px]" style={{ background: `radial-gradient(closest-side, ${col}88, transparent)` }} />

      <div className="case-body absolute left-[9%] right-[9%] top-[16%] bottom-[8%] transition-transform duration-500 group-hover:-translate-y-[3%] group-hover:scale-[1.03]">
        {/* tijelo kutije */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[12%/16%]"
          style={{
            background: `${pattern}, linear-gradient(160deg, color-mix(in srgb, ${col} 80%, #fff 20%), color-mix(in srgb, ${col} 72%, #000 28%) 52%, color-mix(in srgb, ${col} 42%, #000 58%))`,
            boxShadow: `inset 0 1px 0 #ffffff66, inset 0 -4px 0 #00000066, inset 0 0 0 1px #ffffff22, 0 12px 26px -10px #000, 0 0 30px -6px ${col}`,
          }}
        >
          {/* metalni odsjaj koji prelazi */}
          <span className="case-sheen pointer-events-none absolute inset-y-0 -left-1/2 w-1/2" />
          {/* zakovice */}
          {["left-[4%] bottom-[6%]", "right-[4%] bottom-[6%]"].map((pos) => (
            <span key={pos} className={`absolute ${pos} h-[5%] w-[3.5%] rounded-full bg-white/50 shadow-[inset_0_-1px_0_#0006]`} />
          ))}
          {/* prozor */}
          <div className="absolute inset-x-[10%] top-[36%] bottom-[10%] overflow-hidden rounded-[10%/16%] border border-white/20 bg-[linear-gradient(180deg,#0b0b1ae6,#05050ce6)] shadow-[inset_0_3px_12px_#000d]">
            <div className="absolute inset-x-0 bottom-0 h-2/3" style={{ background: `radial-gradient(60% 80% at 50% 100%, ${col}77, transparent 70%)` }} />
            <div className="case-inner-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: `radial-gradient(60% 60% at 50% 30%, ${col}aa, transparent 70%)` }} />
          </div>
        </div>
        {/* poklopac (odškrine se na hover) */}
        <div
          className="absolute inset-x-0 top-0 h-[30%] origin-top rounded-t-[12%_50%] border-b border-black/50 transition-transform duration-500 group-hover:[transform:rotateX(28deg)_translateY(-6%)]"
          style={{ background: `${pattern}, linear-gradient(180deg, color-mix(in srgb, ${col} 60%, #fff 25%), color-mix(in srgb, ${col} 55%, #000 45%))`, boxShadow: "inset 0 1px 0 #ffffff77, 0 3px 6px -2px #000a" }}
        >
          {/* kopče */}
          <span className="absolute bottom-[-18%] left-[14%] h-[44%] w-[8%] rounded-[25%] bg-[linear-gradient(180deg,#f8fafc,#94a3b8_60%,#64748b)] shadow-[0_1px_2px_#000a]" />
          <span className="absolute bottom-[-18%] right-[14%] h-[44%] w-[8%] rounded-[25%] bg-[linear-gradient(180deg,#f8fafc,#94a3b8_60%,#64748b)] shadow-[0_1px_2px_#000a]" />
        </div>
        {/* ručka */}
        <div className="absolute left-1/2 top-[-12%] h-[13%] w-[28%] -translate-x-1/2 rounded-t-full border-[max(2px,1.3cqw)] border-b-0 border-white/75 shadow-[0_0_6px_#0008]" />
        {/* auto "izlazi" iz prozora */}
        {top && (
          <div className="pointer-events-none absolute inset-x-[8%] top-[26%] bottom-[11%] flex items-end justify-center">
            <CarImage item={top} reflect={big} className="h-[82%] w-[92%] drop-shadow-[0_6px_10px_#000c] transition-transform duration-500 group-hover:-translate-y-[6%] group-hover:scale-[1.08]" />
          </div>
        )}
      </div>

      {premium && (
        <>
          <i className="case-spark" style={{ left: "16%", top: "30%", animationDelay: "0s" }} />
          <i className="case-spark" style={{ left: "82%", top: "48%", animationDelay: ".9s" }} />
          <i className="case-spark" style={{ left: "70%", top: "18%", animationDelay: "1.7s" }} />
        </>
      )}

      {/* oznaka ideje kutije */}
      {(tag || gemCase) && (
        <span
          className="absolute right-[5%] top-[5%] z-10 rotate-[8deg] rounded-[0.35em] px-[0.45em] py-[0.15em] font-display font-black leading-none text-ink shadow-[0_2px_10px_#000b,inset_0_1px_0_#fff8]"
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
