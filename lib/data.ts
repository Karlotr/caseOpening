"use client";

import { createClient } from "@/utils/supabase/client";
import type { CaseRow, CaseWithItems, Item } from "./types";

let casesPromise: Promise<CaseWithItems[]> | null = null;
let itemsPromise: Promise<Item[]> | null = null;

const num = <T extends Record<string, unknown>>(r: T, keys: string[]) => {
  const o: Record<string, unknown> = { ...r };
  keys.forEach((k) => {
    if (o[k] !== null && o[k] !== undefined) o[k] = Number(o[k]);
  });
  return o as T;
};

export function resetDataCache() {
  itemsPromise = null;
  casesPromise = null;
}

export function getItems(): Promise<Item[]> {
  if (!itemsPromise) {
    itemsPromise = (async () => {
      const { data, error } = await createClient().from("items").select("*").order("value");
      if (error) {
        itemsPromise = null;
        throw error;
      }
      return (data ?? []).map((r) => num(r, ["value"]) as Item);
    })();
  }
  return itemsPromise;
}

export function getCases(): Promise<CaseWithItems[]> {
  if (!casesPromise) {
    casesPromise = (async () => {
      const sb = createClient();
      const [{ data: cases, error }, { data: ci, error: e2 }, items] = await Promise.all([
        sb.from("cases").select("*").order("sort"),
        sb.from("case_items").select("case_id,item_id,weight"),
        getItems(),
      ]);
      if (error || e2) {
        casesPromise = null;
        throw error ?? e2;
      }
      const byId = new Map(items.map((i) => [i.id, i]));
      return (cases ?? []).map((c) => {
        const row = num(c, ["price", "gem_price"]) as CaseRow;
        const rows = (ci ?? []).filter((x) => x.case_id === row.id);
        const total = rows.reduce((s, x) => s + Number(x.weight), 0);
        const list = rows
          .map((x) => ({ ...byId.get(x.item_id)!, weight: Number(x.weight), chance: Number(x.weight) / total }))
          .sort((a, b) => b.value - a.value);
        return { ...row, items: list };
      });
    })();
  }
  return casesPromise;
}

// nasumični predmet iz kutije prema težinama (samo za vizualni "filler" u reelu)
export function randomFromCase(c: CaseWithItems): Item {
  let r = Math.random();
  for (const it of c.items) {
    r -= it.chance;
    if (r <= 0) return it;
  }
  return c.items[c.items.length - 1];
}
