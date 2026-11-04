export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
export type Body = "hatch" | "sedan" | "coupe" | "super" | "suv" | "classic" | "muscle";

export type Item = {
  id: number;
  brand: string;
  model: string;
  year: number;
  category: string;
  body: Body;
  rarity: Rarity;
  value: number;
  photo?: boolean;
  inventory_id?: number;
  roll?: { ticket: number; chance: number; gap: number; top: boolean };
};

export type CaseType = "normal" | "daily" | "gem" | "level";

export type CaseRow = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  case_type: CaseType;
  price: number;
  gem_price: number | null;
  min_level: number;
  streak_min: number | null;
  color: string;
  sort: number;
};

export type CaseWithItems = CaseRow & { items: (Item & { weight: number; chance: number })[] };

export type Profile = {
  id: string;
  username: string;
  balance: number;
  gems: number;
  xp: number;
  level: number;
  daily_streak: number;
  last_daily_at: string | null;
  last_weekly_at: string | null;
  last_monthly_at: string | null;
  last_rain_at: string | null;
};

export type LevelUp = { level_up: number | null; bonus?: number };
