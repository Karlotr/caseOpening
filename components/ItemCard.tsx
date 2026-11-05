import type { Item } from "@/lib/types";
import { RARITY, coins } from "@/lib/format";
import { CarImage } from "./CarImage";

const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 } as const;

export function ItemCard({
  item,
  chance,
  size = "md",
  selected,
  onClick,
  footer,
}: {
  item: Item;
  chance?: number;
  size?: "sm" | "md";
  selected?: boolean;
  onClick?: () => void;
  footer?: React.ReactNode;
}) {
  const r = RARITY[item.rarity];
  const rank = RANK[item.rarity];
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      aria-pressed={onClick ? !!selected : undefined}
      className={`spot group relative flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border text-left transition duration-300 hover:-translate-y-0.5 ${rank >= 4 ? "sheen" : ""} ${
        selected ? "border-accent2 ring-2 ring-accent2/70" : "border-white/[.07] hover:border-white/20"
      } ${onClick ? "cursor-pointer" : ""}`}
      style={{
        background: `radial-gradient(120% 70% at 50% 108%, ${r.color}${rank >= 3 ? "66" : "40"}, transparent 62%), linear-gradient(180deg, #ffffff0a, #ffffff02), #12122acc`,
        boxShadow: rank >= 3 ? `0 0 0 1px ${r.color}33 inset, 0 18px 40px -24px ${r.color}` : undefined,
      }}
    >
      <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full" style={{ background: r.color, boxShadow: `0 0 12px ${r.color}` }} />
      <div className="relative z-[2] flex items-center justify-between px-3 pt-2.5 text-xs">
        <span className="font-semibold" style={{ color: r.color }}>{r.label}</span>
        {chance !== undefined && <span className="rounded-md bg-black/50 px-1.5 py-0.5 font-display font-bold tabular-nums text-emerald-300">{(chance * 100).toFixed(chance < 0.001 ? 4 : 2)}%</span>}
      </div>
      <div className="relative z-[2] grid place-items-center px-2 pt-1">
        <CarImage item={item} className={`transition-transform duration-500 group-hover:scale-[1.06] ${size === "sm" ? "h-14 w-full max-w-32" : "h-20 w-full max-w-44"}`} />
      </div>
      <div className="relative z-[2] px-3 pb-3 pt-1">
        <div className="truncate text-xs text-muted">{item.brand}, {item.year}</div>
        <div className="truncate font-display text-[17px] font-bold leading-tight">{item.model}</div>
        <span className="plate mt-1.5 text-sm">{coins(item.value)}</span>
        {footer}
      </div>
    </Comp>
  );
}
