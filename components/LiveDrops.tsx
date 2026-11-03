"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { Item } from "@/lib/types";
import { RARITY, coins } from "@/lib/format";
import { CarArt } from "./CarArt";

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
    <div className="overflow-hidden rounded-xl border border-line bg-ink/80 backdrop-blur">
      <div className="flex items-center gap-2 bg-panel2 px-3 py-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        <span className="font-display text-lg font-bold tracking-wide">Uživo iz garaže</span>
      </div>
      <ol>
        {drops.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Prvi drop može biti tvoj.</li>}
        {drops.map((d, i) => {
          const c = RARITY[d.item.rarity].color;
          return (
            <li key={d.id} className="drop-in grid grid-cols-[1.6rem_4px_1fr_auto] items-center gap-2 border-t border-line/70 px-3 py-1.5">
              <span className="font-display text-base font-bold tabular-nums text-muted">{i + 1}</span>
              <span className="h-7 w-1 rounded" style={{ background: c }} />
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
            <CarArt id={d.item.id} body={d.item.body} rarity={d.item.rarity} className="mx-auto h-10 w-24" />
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
