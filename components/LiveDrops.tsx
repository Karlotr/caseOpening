"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { Item } from "@/lib/types";
import { RARITY, coins } from "@/lib/format";
import { CarArt } from "./CarArt";

type Drop = { id: number; username: string; source: string; created_at: string; item: Item };

export function LiveDrops() {
  const [drops, setDrops] = useState<Drop[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await createClient().rpc("recent_drops", { p_limit: 16 });
      if (alive && data) setDrops(data as Drop[]);
    };
    load();
    const t = setInterval(load, 6000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  if (!drops.length) return null;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live dropovi
      </div>
      <div className="flex gap-2 overflow-x-auto p-2 [scrollbar-width:none]">
        {drops.map((d) => {
          const c = RARITY[d.item.rarity].color;
          return (
            <div key={d.id} className="drop-in w-36 shrink-0 rounded-md border border-line bg-black/30 p-2" style={{ borderBottomColor: c, borderBottomWidth: 2 }}>
              <CarArt id={d.item.id} body={d.item.body} rarity={d.item.rarity} className="mx-auto h-10 w-24" />
              <div className="truncate text-xs font-semibold">{d.item.brand} {d.item.model}</div>
              <div className="flex justify-between text-[10px] text-muted">
                <span className="truncate">{d.username}</span>
                <span className="text-accent">{coins(d.item.value)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
