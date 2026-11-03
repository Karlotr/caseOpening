"use client";

import { createClient } from "@/utils/supabase/client";
import type { Item } from "./types";

export type InvRow = { id: number; created_at: string; source: string; status: string; item: Item };

export async function loadInventory(status: "owned" | "all" = "owned"): Promise<InvRow[]> {
  let q = createClient().from("inventory").select("id, created_at, source, status, items(*)").order("created_at", { ascending: false }).limit(500);
  if (status === "owned") q = q.eq("status", "owned");
  const { data } = await q;
  return (data ?? []).map((r) => {
    const it = (r as unknown as { items: Item }).items;
    return { id: r.id, created_at: r.created_at, source: r.source, status: r.status, item: { ...it, value: Number(it.value), inventory_id: r.id } };
  });
}
