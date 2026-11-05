import type { Rarity } from "./types";

export const coins = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// skraćeni prikaz za uske prostore (navbar): 950 → 950, 70.508 → 70,5k, 1.250.000 → 1,25M
export const compact = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0);
  const a = Math.abs(v);
  const f = (x: number, d: number) => x.toLocaleString("hr-HR", { maximumFractionDigits: d });
  if (a < 1000) return f(v, a < 100 ? 2 : 0);
  if (a < 1e6) return `${f(v / 1e3, a < 1e4 ? 2 : 1)}k`;
  if (a < 1e9) return `${f(v / 1e6, 2)}M`;
  return `${f(v / 1e9, 2)}B`;
};

export const RARITY: Record<Rarity, { label: string; color: string }> = {
  common: { label: "Obični", color: "#9ca3af" },
  uncommon: { label: "Neobični", color: "#3b82f6" },
  rare: { label: "Rijetki", color: "#8b5cf6" },
  epic: { label: "Epski", color: "#ec4899" },
  legendary: { label: "Legendarni", color: "#ef4444" },
  mythic: { label: "Mitski", color: "#facc15" },
};

// XP potreban za level L (mora odgovarati xp_for_level / level_for_xp u SQL-u)
// do 100: 25·(L−1)²; nakon 100 svaki level je 3× skuplji; max 500
export const MAX_LEVEL = 500;
export const xpForLevel = (level: number) => {
  const l = Math.max(1, Math.min(MAX_LEVEL, level));
  return l <= 100 ? 25 * (l - 1) ** 2 : 245025 + 75 * ((l - 1) ** 2 - 99 ** 2);
};

export const levelProgress = (xp: number, level: number) => {
  const a = xpForLevel(level);
  if (level >= MAX_LEVEL) return { pct: 100, next: a, current: a };
  const b = xpForLevel(level + 1);
  return { pct: Math.max(0, Math.min(100, ((xp - a) / (b - a)) * 100)), next: b, current: a };
};

export const errMsg = (e: unknown) => {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Nešto je pošlo po zlu.";
};

export const carName = (i: { brand: string; model: string }) => `${i.brand} ${i.model}`;
