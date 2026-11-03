"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCases } from "@/lib/data";
import type { CaseWithItems } from "@/lib/types";
import { CaseCard } from "@/components/CaseCard";
import { DropTower } from "@/components/LiveDrops";
import { CarImage } from "@/components/CarImage";

const MODES = [
  { href: "/battles", t: "Case Battles", d: "1v1 do 6-way. Najjača garaža nosi sve, ili u Jackpot modu vrijednost određuje šansu.", c: "#f5821f" },
  { href: "/upgrader", t: "Upgrader", d: "Daj Golfa, uzmi Porschea. Ti biraš šansu.", c: "#a78bfa" },
  { href: "/slide", t: "Slide", d: "Odaberi multiplikator i pusti traku.", c: "#8fcbeb" },
  { href: "/trinity", t: "Trinity", d: "Crvena, crna ili zlatna 14×.", c: "#ef4444" },
  { href: "/jackpot", t: "Jackpot", d: "Veći ulog, veća šansa. Pobjednik uzima pot.", c: "#34d399" },
  { href: "/rewards", t: "Nagrade", d: "Dnevna kutija, kiša coina, tjedni i mjesečni drop.", c: "#facc15" },
];

function StartLights() {
  const [on, setOn] = useState(0);
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOut(true);
      return;
    }
    const ts = [1, 2, 3, 4, 5].map((n) => setTimeout(() => setOn(n), 250 + n * 380));
    ts.push(setTimeout(() => setOut(true), 250 + 5 * 380 + 650));
    return () => ts.forEach(clearTimeout);
  }, []);
  return (
    <div className="flex gap-2.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="flex flex-col gap-1.5 rounded-md bg-[#0a0a0a] p-1.5">
          <span className={`light h-6 w-6 rounded-full sm:h-7 sm:w-7 ${!out && on >= n ? "on" : ""}`} />
          <span className={`light h-6 w-6 rounded-full sm:h-7 sm:w-7 ${!out && on >= n ? "on" : ""}`} />
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [cases, setCases] = useState<CaseWithItems[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    getCases().then(setCases).catch(() => setErr("Kutije se nisu učitale. Provjeri je li supabase/schema.sql pokrenut u Supabaseu."));
  }, []);
  const normal = cases.filter((c) => c.case_type === "normal");

  return (
    <div className="space-y-12">
      <section className="relative grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-panel p-6 pb-44 sm:p-10 sm:pb-48">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 sm:h-48">
            <div className="livery absolute inset-x-0 bottom-0 h-full opacity-90" />
            <div className="absolute inset-x-0 bottom-0 h-6 bg-[repeating-linear-gradient(90deg,#ffffff1a_0_40px,transparent_40px_80px)]" />
          </div>
          <div className="relative z-10 max-w-xl">
            <StartLights />
            <h1 className="mt-8 font-display text-6xl font-black leading-[0.9] tracking-tight sm:text-7xl">
              Od Fiće do Ferrarija 250 GTO
            </h1>
            <p className="mt-4 max-w-md text-lg text-muted">
              Otvaraj kutije s pravim modelima i oldtajmerima, bori se u battleovima i slaži svoju garažu.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/cases" className="btn-primary px-7 py-3 text-lg">Otvori kutiju</Link>
              <Link href="/battles" className="btn-ghost px-5 py-3">Uđi u battle</Link>
            </div>
          </div>
          <div className="hero-car pointer-events-none absolute bottom-2 right-4 w-[85%] max-w-[460px] sm:right-10">
            <CarImage item={{ id: 3, brand: "Ferrari", model: "F40", year: 1989, body: "super", rarity: "legendary" }} className="w-full drop-shadow-[0_24px_30px_rgba(0,0,0,.7)]" />
          </div>
        </div>
        <DropTower />
      </section>

      <section>
        <h2 className="mb-4 font-display text-4xl font-extrabold tracking-tight">Igre</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m) => (
            <Link key={m.href} href={m.href} className="group relative overflow-hidden rounded-xl border border-line bg-panel p-5 transition hover:border-white/30">
              <span className="absolute inset-y-0 left-0 w-1.5 transition-all group-hover:w-2.5" style={{ background: m.c }} />
              <div className="font-display text-3xl font-extrabold leading-none tracking-tight">{m.t}</div>
              <p className="mt-2 text-muted">{m.d}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-4xl font-extrabold tracking-tight">Kutije</h2>
          <Link href="/cases" className="font-semibold text-accent2 hover:underline">Sve kutije</Link>
        </div>
        {err && <div className="card p-4 text-red-300">{err}</div>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(normal.length ? normal.slice(0, 8) : Array.from({ length: 8 })).map((c, i) =>
            c ? <CaseCard key={(c as CaseWithItems).id} c={c as CaseWithItems} /> : <div key={i} className="card aspect-[4/4] animate-pulse" />
          )}
        </div>
      </section>
    </div>
  );
}
