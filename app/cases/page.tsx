"use client";

import { useEffect, useMemo, useState } from "react";
import { getCases } from "@/lib/data";
import type { CaseType, CaseWithItems } from "@/lib/types";
import { CaseCard } from "@/components/CaseCard";
import { useFavorites } from "@/lib/favorites";

type Tab = CaseType | "fav";
const TABS: { k: Tab; l: string }[] = [
  { k: "fav", l: "★ Omiljene" },
  { k: "normal", l: "Kutije" },
  { k: "gem", l: "Gem kutije" },
  { k: "level", l: "Level kutije" },
  { k: "daily", l: "Dnevne" },
];

export default function CasesPage() {
  const [cases, setCases] = useState<CaseWithItems[]>([]);
  const [tab, setTab] = useState<Tab>("normal");
  const { fav } = useFavorites();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  useEffect(() => {
    getCases().then(setCases).catch(() => {});
  }, []);
  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const f = cases.filter(
      (c) =>
        (tab === "fav" ? fav.includes(c.id) : c.case_type === tab) &&
        (!ql || c.name.toLowerCase().includes(ql) || c.items.some((i) => `${i.brand} ${i.model}`.toLowerCase().includes(ql)))
    );
    const val = (c: CaseWithItems) => (c.case_type === "gem" ? c.gem_price ?? 0 : c.case_type === "level" ? c.min_level : c.price);
    // omiljene uvijek prve, unutar toga po cijeni
    return f.sort((a, b) => Number(fav.includes(b.id)) - Number(fav.includes(a.id)) || (sort === "asc" ? val(a) - val(b) : val(b) - val(a)));
  }, [cases, tab, q, sort, fav]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="h1">Kutije</h1>
        <div className="flex w-full gap-2 sm:w-auto">
          <input className="input min-w-0 flex-1 sm:w-64 sm:flex-none" placeholder="Traži kutiju ili auto (npr. Supra)" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-auto shrink-0" value={sort} onChange={(e) => setSort(e.target.value as "asc" | "desc")} aria-label="Sortiraj">
            <option value="asc">Cijena ↑</option>
            <option value="desc">Cijena ↓</option>
          </select>
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const on = tab === t.k;
          const n = t.k === "fav" ? fav.filter((id) => cases.some((c) => c.id === id)).length : 0;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold ring-1 transition sm:px-4 sm:py-2 ${
                on ? "bg-[linear-gradient(100deg,#ff2b4e,#ff5a3c_45%,#ffb547)] text-white ring-white/20 shadow-[0_6px_20px_-8px_#ff2b4ecc]" : "bg-white/[.04] text-white/75 ring-white/10 hover:bg-white/[.08] hover:text-white"
              }`}
            >
              {t.l}
              {n > 0 && <span className={`ml-1.5 rounded-full px-1.5 text-[11px] ${on ? "bg-black/25" : "bg-amber-300/20 text-amber-200"}`}>{n}</span>}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cases.length === 0
          ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="card h-52 animate-pulse" />)
          : list.map((c) => <CaseCard key={c.id} c={c} />)}
      </div>
      {cases.length > 0 && list.length === 0 && <p className="text-sm text-muted">{tab === "fav" ? "Još nemaš omiljenih kutija — klikni ☆ na kutiji." : "Nema rezultata."}</p>}
    </div>
  );
}
