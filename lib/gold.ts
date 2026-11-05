import type { CaseWithItems } from "./types";

// "Zlatni drop" je dinamičan: auto je zlatan ako je JAKO velik u odnosu na kutiju, a ne zato što je legendaran.
// Pravilo: vrijednost ≥ GOLD_X × cijena kutije  I  auto je u rijetkom vrhu kutije (šansa za njega ili skuplji ≤ GOLD_TAIL);
// jako veliki dropovi (≥ BIG_X × cijena) smiju biti i malo češći (≤ BIG_TAIL), npr. "1 u 10".
// Za besplatne / gem kutije umjesto cijene se uzima prosječna vrijednost (EV) kutije.
export const GOLD_X = 3;
export const GOLD_TAIL = 0.06;
export const BIG_X = 5;
export const BIG_TAIL = 0.12;

type GoldCase = Pick<CaseWithItems, "case_type" | "price" | "items">;

export function caseRef(c: GoldCase) {
  if (c.case_type === "normal" && c.price > 0) return c.price;
  return c.items.reduce((s, i) => s + i.value * (i.chance ?? 0), 0) || 1;
}

const cache = new WeakMap<object, number>();

// najmanja vrijednost auta koja se u ovoj kutiji računa kao zlatni drop (Infinity = kutija nema zlatnih)
export function goldThreshold(c: GoldCase | undefined | null): number {
  if (!c || !c.items.length) return Infinity;
  const hit = cache.get(c);
  if (hit !== undefined) return hit;
  const ref = caseRef(c);
  const sorted = [...c.items].sort((a, b) => b.value - a.value);
  let tail = 0;
  let min = Infinity;
  for (const it of sorted) {
    tail += it.chance ?? 0;
    const ok = it.value >= GOLD_X * ref && (tail <= GOLD_TAIL + 1e-9 || (it.value >= BIG_X * ref && tail <= BIG_TAIL + 1e-9));
    if (!ok) break;
    min = it.value;
  }
  cache.set(c, min);
  return min;
}

// jačina slavlja prema tome koliko je drop veći od kutije
export const goldTier = (value: number, c: GoldCase): 2 | 3 => (value / caseRef(c) >= 20 ? 3 : 2);
