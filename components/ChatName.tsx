import type { CSSProperties } from "react";

export type ChatStyle = { color?: string; effect?: "glow" | "shine" | "rainbow" | "pulse"; badge?: string } | null | undefined;

export const CHAT_COLORS = [
  { name: "Zlatna", hex: "#ffc53d" },
  { name: "Natrij", hex: "#ffb547" },
  { name: "Xenon", hex: "#5ce1ff" },
  { name: "Crvena", hex: "#ff2b4e" },
  { name: "Ljubičasta", hex: "#a78bfa" },
  { name: "Zelena", hex: "#4ade80" },
  { name: "Ružičasta", hex: "#f472b6" },
  { name: "Bijela", hex: "#ffffff" },
];
export const CHAT_EFFECTS = [
  { id: "none", name: "Bez efekta" },
  { id: "glow", name: "Sjaj" },
  { id: "shine", name: "Odsjaj" },
  { id: "pulse", name: "Puls" },
  { id: "rainbow", name: "Duga" },
] as const;

// Ime u chatu s bojom/efektom i oznakom (npr. Admin)
export function ChatName({ name, style, mine }: { name: string; style: ChatStyle; mine?: boolean }) {
  const color = style?.color ?? (style?.badge ? "#ffc53d" : undefined);
  const vars = color ? ({ "--cn": color } as CSSProperties) : undefined;
  const fx = style?.effect ? `cn-${style.effect}` : "";
  return (
    <span className="flex min-w-0 items-center gap-1.5" style={vars}>
      {style?.badge && (
        <span className="cn-badge shrink-0 rounded px-1.5 py-px font-display text-[11px] font-extrabold leading-4">{style.badge}</span>
      )}
      <span className={`truncate font-semibold ${color || fx ? "cn" : mine ? "text-accent2" : ""} ${fx}`}>{name}</span>
    </span>
  );
}
