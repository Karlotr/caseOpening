import type { Body, Rarity } from "@/lib/types";
import { RARITY } from "@/lib/format";

const SHAPES: Record<Body, { body: string; win: string }> = {
  sedan: {
    body: "M4 38 Q4 31 12 30 L32 28 L44 17 Q47 15 52 15 L78 15 Q83 15 87 19 L96 28 L110 30 Q116 31 116 37 L116 40 L4 40 Z",
    win: "M47 19 L62 19 L62 27 L39 28 Z M66 19 L80 19 Q83 19 85 22 L90 27 L66 27 Z",
  },
  hatch: {
    body: "M6 38 Q6 31 13 30 L30 28 L42 16 Q45 14 50 14 L92 14 Q97 14 99 19 L104 30 Q114 31 114 37 L114 40 L6 40 Z",
    win: "M45 18 L64 18 L64 27 L36 28 Z M68 18 L92 18 Q95 18 96 21 L99 27 L68 27 Z",
  },
  coupe: {
    body: "M4 38 Q4 32 12 30 L36 27 L52 18 Q56 16 62 16 L80 16 Q86 16 92 21 L100 27 L110 29 Q116 31 116 36 L116 40 L4 40 Z",
    win: "M54 20 L68 20 L68 26 L42 27 Z M72 20 L82 20 Q86 20 90 23 L94 26 L72 26 Z",
  },
  super: {
    body: "M2 38 Q2 33 10 32 L40 28 L60 20 Q64 19 70 19 L84 19 Q90 19 98 25 L112 30 Q118 32 118 37 L118 40 L2 40 Z",
    win: "M62 22 L76 22 L76 27 L50 28 Z M80 22 L86 22 Q90 22 95 26 L80 27 Z",
  },
  suv: {
    body: "M6 40 L6 28 Q6 25 10 25 L24 24 L34 12 Q36 10 40 10 L98 10 Q102 10 104 14 L110 26 Q114 27 114 32 L114 40 Z",
    win: "M38 14 L60 14 L60 23 L29 24 Z M64 14 L88 14 L88 23 L64 23 Z M92 14 L100 14 L104 23 L92 23 Z",
  },
  classic: {
    body: "M4 38 Q2 30 14 29 Q20 22 30 22 Q38 22 42 26 L46 18 Q50 13 60 13 L76 13 Q86 13 90 22 L96 26 Q102 22 108 26 Q116 29 116 38 L116 40 L4 40 Z",
    win: "M50 17 L66 17 L66 25 L46 25 Z M70 17 L78 17 Q84 17 87 25 L70 25 Z",
  },
  muscle: {
    body: "M3 39 L3 31 L14 29 L38 27 L50 18 Q53 16 58 16 L84 16 Q88 16 92 20 L100 27 L114 28 Q117 29 117 33 L117 39 Z",
    win: "M52 20 L68 20 L68 26 L42 27 Z M72 20 L84 20 Q87 20 89 23 L92 26 L72 26 Z",
  },
};

const PAINTS = ["#e5e7eb", "#dc2626", "#1d4ed8", "#16a34a", "#f59e0b", "#4b5563", "#7c3aed", "#0891b2", "#be123c", "#ca8a04", "#475569", "#f97316"];

export function CarArt({ id, body, rarity, className }: { id: number; body: Body; rarity: Rarity; className?: string }) {
  const s = SHAPES[body] ?? SHAPES.sedan;
  const paint = PAINTS[(id * 7) % PAINTS.length];
  const glow = RARITY[rarity].color;
  const gid = `g${id}`;
  return (
    <svg viewBox="0 0 120 52" className={className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={paint} stopOpacity="1" />
          <stop offset="1" stopColor={paint} stopOpacity="0.65" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="47" rx="54" ry="3.5" fill={glow} opacity="0.35" />
      <path d={s.body} fill={`url(#${gid})`} stroke="rgba(0,0,0,.55)" strokeWidth="1" />
      <path d={s.win} fill="#0b1220" opacity="0.85" />
      <path d="M8 34 L112 34" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
      {[26, 94].map((x) => (
        <g key={x}>
          <circle cx={x} cy="40" r="8" fill="#0a0a0a" />
          <circle cx={x} cy="40" r="4.2" fill="#9ca3af" />
          <circle cx={x} cy="40" r="1.5" fill="#1f2937" />
        </g>
      ))}
    </svg>
  );
}
