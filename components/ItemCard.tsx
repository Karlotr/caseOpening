import type { Item } from "@/lib/types";
import { RARITY, coins } from "@/lib/format";
import { CarImage } from "./CarImage";

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
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      aria-pressed={onClick ? !!selected : undefined}
      className={`group relative flex flex-col overflow-hidden rounded-lg border bg-panel text-left transition ${
        selected ? "border-accent ring-2 ring-accent" : "border-line hover:border-white/30"
      } ${onClick ? "cursor-pointer" : ""}`}
      style={{ backgroundImage: `radial-gradient(120% 80% at 50% 115%, ${r.color}40, transparent 62%)` }}
    >
      <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: r.color }} />
      <div className="flex items-center justify-between px-2.5 pt-2 text-xs">
        <span className="font-semibold" style={{ color: r.color }}>{r.label}</span>
        {chance !== undefined && <span className="tabular-nums text-muted">{(chance * 100).toFixed(chance < 0.001 ? 4 : 2)}%</span>}
      </div>
      <CarImage item={item} className={`mx-auto transition-transform duration-300 group-hover:-translate-y-0.5 ${size === "sm" ? "h-12 w-28" : "h-16 w-36"}`} />
      <div className="px-2.5 pb-2.5">
        <div className="truncate text-xs text-muted">{item.brand}, {item.year}</div>
        <div className="truncate font-semibold leading-tight">{item.model}</div>
        <span className="plate mt-1.5 text-sm">{coins(item.value)}</span>
        {footer}
      </div>
    </Comp>
  );
}
