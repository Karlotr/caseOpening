import type { Rarity } from "./types";

export const coins = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const RARITY: Record<Rarity, { label: string; color: string }> = {
  common: { label: "Obični", color: "#9ca3af" },
  uncommon: { label: "Neobični", color: "#3b82f6" },
  rare: { label: "Rijetki", color: "#8b5cf6" },
  epic: { label: "Epski", color: "#ec4899" },
  legendary: { label: "Legendarni", color: "#ef4444" },
  mythic: { label: "Mitski", color: "#facc15" },
};

// XP potreban za level L (mora odgovarati level_for_xp u SQL-u)
export const xpForLevel = (level: number) => 25 * (level - 1) ** 2;

export const levelProgress = (xp: number, level: number) => {
  const a = xpForLevel(level);
  const b = xpForLevel(level + 1);
  return { pct: Math.max(0, Math.min(100, ((xp - a) / (b - a)) * 100)), next: b, current: a };
};

export const errMsg = (e: unknown) => {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Nešto je pošlo po zlu.";
};

export const carName = (i: { brand: string; model: string }) => `${i.brand} ${i.model}`;
