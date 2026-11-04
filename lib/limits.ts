"use client";

import { createClient } from "@/utils/supabase/client";

// Limiti koje admin mijenja (tablica site_limits). Zadane vrijednosti dok se ne učitaju.
export type Limits = Record<string, number>;
export const DEFAULT_LIMITS: Limits = {
  battle_max_cases: 50,
  case_max_open: 5,
  jackpot_round_sec: 60,
  jackpot_min_bet: 1,
  jackpot_max_bet: 10000,
  jackpot_fee_pct: 5,
};
export type LimitRow = { key: string; value: number; min_value: number; max_value: number; label: string; sort: number };

export async function loadLimitRows(): Promise<LimitRow[]> {
  const { data } = await createClient().from("site_limits").select("*").order("sort");
  return ((data ?? []) as LimitRow[]).map((r) => ({ ...r, value: Number(r.value), min_value: Number(r.min_value), max_value: Number(r.max_value) }));
}

export async function loadLimits(): Promise<Limits> {
  const rows = await loadLimitRows();
  return { ...DEFAULT_LIMITS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
}
