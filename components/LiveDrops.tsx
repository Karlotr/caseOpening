"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { Item } from "@/lib/types";
import { RARITY, coins } from "@/lib/format";
import { CarImage } from "./CarImage";

type Drop = { id: number; username: string; source: string; created_at: string; item: Item };

function useDrops(limit: number) {
  const [drops, setDrops] = useState<Drop[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await createClient().rpc("recent_drops", { p_limit: limit });
      if (alive && data) setDrops(data as Drop[]);
    };
    load();
    const t = setInterval(load, 6000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [limit]);
  return drops;
}

const src = (s: string) => (s.startsWith("case:") ? "kutija" : s.startsWith("daily") ? "dnevna" : s);

// "Timing tower" kao u F1 prijenosu — zadnji dropovi uživo
export function DropTower() {
  const drops = useDrops(9);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/[.06] px-4 py-3">
        <span className="h-2 w-2 animate-pulse rounded-full bg-tail shadow-[0_0_10px_#ff2b4e]" />
        <span className="font-display text-xl font-extrabold">Uživo iz garaže</span>
      </div>
      <ol>
        {drops.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Prvi drop može biti tvoj.</li>}
        {drops.map((d, i) => {
          const c = RARITY[d.item.rarity].color;
          return (
            <li key={d.id} className="drop-in grid grid-cols-[1.4rem_3.2rem_1fr_auto] items-center gap-2 border-t border-white/[.04] px-3 py-1.5 transition hover:bg-white/[.03]">
              <span className="font-display text-base font-bold tabular-nums text-muted">{i + 1}</span>
              <span className="relative grid h-8 place-items-center rounded-md" style={{ background: `radial-gradient(closest-side, ${c}55, transparent)` }}><CarImage item={d.item} className="h-8 w-12" /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{d.item.brand} {d.item.model}</span>
                <span className="block truncate text-xs text-muted">{d.username} · {src(d.source)}</span>
              </span>
              <span className="plate text-sm">{coins(d.item.value)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function LiveDrops() {
  const drops = useDrops(16);
  if (!drops.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Zadnji dropovi">
      {drops.map((d) => {
        const c = RARITY[d.item.rarity].color;
        return (
          <div key={d.id} className="drop-in w-40 shrink-0 rounded-lg border border-line bg-panel p-2" style={{ boxShadow: `inset 0 -3px 0 ${c}` }}>
            <CarImage item={d.item} className="mx-auto h-10 w-24" />
            <div className="truncate text-sm font-semibold">{d.item.model}</div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="truncate">{d.username}</span>
              <span className="font-display text-sm font-bold text-accent">{coins(d.item.value)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
