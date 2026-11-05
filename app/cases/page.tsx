"use client";

import { useEffect, useMemo, useState } from "react";
import { getCases } from "@/lib/data";
import type { CaseType, CaseWithItems } from "@/lib/types";
import { CaseCard } from "@/components/CaseCard";
import { useFavorites } from "@/lib/favorites";

type Tab = CaseType | "all" | "fav";
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
    const f = cases.filter(
      (c) =>
        (tab === "fav" ? fav.includes(c.id) : c.case_type === tab) &&
        (!q || c.name.toLowerCase().includes(q.toLowerCase()) || c.items.some((i) => `${i.brand} ${i.model}`.toLowerCase().includes(q.toLowerCase())))
    );
    const val = (c: CaseWithItems) => (c.case_type === "gem" ? c.gem_price ?? 0 : c.case_type === "level" ? c.min_level : c.price);
    return f.sort((a, b) => (sort === "asc" ? val(a) - val(b) : val(b) - val(a)));
  }, [cases, tab, q, sort, fav]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="h1">Kutije</h1>
        <div className="flex flex-wrap gap-2">
          <input className="input w-56" placeholder="Traži kutiju ili auto (npr. Supra)" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as "asc" | "desc")}>
            <option value="asc">Cijena ↑</option>
            <option value="desc">Cijena ↓</option>
          </select>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={tab === t.k ? "btn-primary" : "btn-ghost"}>
            {t.l}
          </button>
        ))}
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
