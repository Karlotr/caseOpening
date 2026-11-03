import type { Item } from "@/lib/types";
import { RARITY, coins } from "@/lib/format";
import { CarArt } from "./CarArt";

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
      className={`group relative flex flex-col overflow-hidden rounded-lg border bg-panel text-left transition ${
        selected ? "border-accent ring-2 ring-accent" : "border-line hover:border-white/25"
      } ${onClick ? "cursor-pointer" : ""}`}
      style={{ backgroundImage: `radial-gradient(120% 80% at 50% 110%, ${r.color}33, transparent 60%)` }}
    >
      <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: r.color }} />
      <div className="flex items-center justify-between px-2.5 pt-2 text-[10px] uppercase tracking-wider">
        <span style={{ color: r.color }}>{r.label}</span>
        {chance !== undefined && <span className="text-muted">{(chance * 100).toFixed(chance < 0.001 ? 4 : 2)}%</span>}
      </div>
      <CarArt id={item.id} body={item.body} rarity={item.rarity} className={size === "sm" ? "mx-auto h-12 w-28" : "mx-auto h-16 w-36"} />
      <div className="px-2.5 pb-2.5">
        <div className="truncate text-[11px] text-muted">
          {item.brand} · {item.year}
        </div>
        <div className="truncate text-sm font-semibold leading-tight">{item.model}</div>
        <div className="mt-1 font-display text-sm text-accent">
          <span className="coin" /> {coins(item.value)}
        </div>
        {footer}
      </div>
    </Comp>
  );
}
