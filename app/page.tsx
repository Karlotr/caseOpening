"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCases } from "@/lib/data";
import type { CaseWithItems } from "@/lib/types";
import { CaseCard } from "@/components/CaseCard";
import { LiveDrops } from "@/components/LiveDrops";
import { CarArt } from "@/components/CarArt";

const MODES = [
  { href: "/cases", t: "Kutije", d: "Od Fiće do Ferrarija 250 GTO", c: "#facc15" },
  { href: "/battles", t: "Case Battles", d: "1v1, 2v2, 3v3 i 6-way", c: "#ef4444" },
  { href: "/upgrader", t: "Upgrader", d: "Zamijeni Golfa za Porschea", c: "#8b5cf6" },
  { href: "/slide", t: "Slide", d: "Odaberi multiplikator", c: "#06b6d4" },
  { href: "/trinity", t: "Trinity", d: "Crvena, crna ili zlatna", c: "#f97316" },
  { href: "/jackpot", t: "Jackpot", d: "Pobjednik nosi sve", c: "#10b981" },
];

export default function Home() {
  const [cases, setCases] = useState<CaseWithItems[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    getCases().then(setCases).catch(() => setErr("Ne mogu učitati kutije — je li pokrenut supabase/schema.sql?"));
  }, []);
  const normal = cases.filter((c) => c.case_type === "normal");

  return (
    <div className="space-y-8">
      <section className="card relative overflow-hidden p-6 sm:p-10">
        <div className="checker-strip absolute inset-x-0 top-0" />
        <div className="relative z-10 max-w-xl">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Kutije · Battles · Oldtajmeri</div>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">
            Od <span className="text-accent">Fiće</span> do <span className="text-accent2">Ferrarija 250 GTO</span>.
          </h1>
          <p className="mt-3 text-muted">
            Otvaraj kutije pune legendarnih automobila, bori se u case battleovima, skupljaj gemove i penji se po levelima. Svaki dan besplatna kutija.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/cases" className="btn-primary">Otvori kutiju</Link>
            <Link href="/battles" className="btn-ghost">Case Battles</Link>
            <Link href="/rewards" className="btn-ghost">Besplatne nagrade</Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-10 bottom-0 hidden w-[560px] opacity-90 md:block">
          <CarArt id={3} body="super" rarity="mythic" className="w-full" />
        </div>
      </section>

      <LiveDrops />

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold tracking-wide">Igre</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {MODES.map((m) => (
            <Link key={m.href} href={m.href} className="card group p-4 transition hover:-translate-y-0.5" style={{ borderTopColor: m.c, borderTopWidth: 3 }}>
              <div className="font-display font-semibold">{m.t}</div>
              <div className="mt-1 text-xs text-muted">{m.d}</div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl font-semibold tracking-wide">Popularne kutije</h2>
          <Link href="/cases" className="text-sm text-accent hover:underline">Sve kutije →</Link>
        </div>
        {err && <div className="card p-4 text-sm text-red-400">{err}</div>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(normal.length ? normal.slice(0, 8) : Array.from({ length: 8 })).map((c, i) =>
            c ? <CaseCard key={(c as CaseWithItems).id} c={c as CaseWithItems} /> : <div key={i} className="card h-52 animate-pulse" />
          )}
        </div>
      </section>
    </div>
  );
}
