"use client";

import { createClient } from "@/utils/supabase/client";

export const MODES = [
  { k: "1v1", l: "1v1", seats: 2, team: 1 },
  { k: "1v1v1", l: "1v1v1", seats: 3, team: 1 },
  { k: "1v1v1v1", l: "1v1v1v1", seats: 4, team: 1 },
  { k: "6-way", l: "6-way", seats: 6, team: 1 },
  { k: "2v2", l: "2v2", seats: 4, team: 2 },
  { k: "3v3", l: "3v3", seats: 6, team: 3 },
] as const;

export type Battle = {
  id: string;
  creator_id: string;
  mode: string;
  seats: number;
  team_size: number;
  case_ids: number[];
  cost: number;
  crazy: boolean;
  jackpot: boolean;
  jackpot_ticket: number | null;
  sponsored: boolean;
  private: boolean;
  status: "waiting" | "finished" | "cancelled";
  winner_team: number | null;
  total_value: number | null;
  created_at: string;
  finished_at: string | null;
};
export type BattlePlayer = { battle_id: string; seat: number; team: number; user_id: string | null; is_bot: boolean; name: string; total: number; stake: number };
export type BattleDrop = { battle_id: string; round: number; seat: number; item_id: number };

// Crazy i Jackpot su neovisni prekidači i mogu se kombinirati
export const modeLabel = (b: { crazy: boolean; jackpot?: boolean }) =>
  b.crazy && b.jackpot ? "Crazy Jackpot" : b.jackpot ? "Jackpot" : b.crazy ? "Crazy" : "Klasično";
export const modeDesc = (b: { crazy: boolean; jackpot?: boolean }) =>
  b.crazy && b.jackpot
    ? "Manja vrijednost daje veću šansu. Na kraju se vrti rulet."
    : b.jackpot
      ? "Veća vrijednost daje veću šansu. Na kraju se vrti rulet."
      : b.crazy
        ? "Najmanja ukupna vrijednost pobjeđuje."
        : "Najveća ukupna vrijednost pobjeđuje.";
// težina za Jackpot rulet: vrijednost, ili 1/vrijednost u Crazy modu
export const jackpotWeight = (total: number, crazy: boolean) => (crazy ? 1 / Math.max(total, 0.01) : total);

export const TEAM_COLORS = ["#f5821f", "#8fcbeb", "#a78bfa", "#34d399", "#f472b6", "#facc15"];

export const normBattle = (b: Record<string, unknown>): Battle => ({
  ...(b as unknown as Battle),
  jackpot: !!b.jackpot,
  sponsored: !!b.sponsored,
  private: !!b.private,
  jackpot_ticket: b.jackpot_ticket == null ? null : Number(b.jackpot_ticket),
  cost: Number(b.cost),
  total_value: b.total_value === null ? null : Number(b.total_value),
});

export async function loadBattle(id: string) {
  const sb = createClient();
  const [{ data: b }, { data: p }, { data: d }] = await Promise.all([
    sb.from("battles").select("*").eq("id", id).maybeSingle(),
    sb.from("battle_players").select("*").eq("battle_id", id).order("seat"),
    sb.from("battle_drops").select("*").eq("battle_id", id).order("round"),
  ]);
  return {
    battle: b ? normBattle(b) : null,
    players: (p ?? []).map((x) => ({ ...x, total: Number(x.total), stake: Number(x.stake ?? 1) })) as BattlePlayer[],
    drops: (d ?? []) as BattleDrop[],
  };
}
