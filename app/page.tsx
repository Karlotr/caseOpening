"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCases } from "@/lib/data";
import type { CaseWithItems } from "@/lib/types";
import { CaseCard } from "@/components/CaseCard";
import { DropTower } from "@/components/LiveDrops";
import { CarImage } from "@/components/CarImage";

const ICON: Record<string, React.ReactNode> = {
  battles: <path d="M5 5l14 14M19 5L5 19M3 9l6-6M15 21l6-6" />,
  upgrader: <path d="M12 20V5M5 12l7-7 7 7M5 21h14" />,
  slide: <path d="M4 12h12M12 6l6 6-6 6M3 6v12" />,
  trinity: <><circle cx="6" cy="12" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="18" cy="12" r="2.5" /></>,
  jackpot: <><circle cx="12" cy="12" r="8" /><path d="M12 4v8l6 5" /></>,
  rewards: <><rect x="4" y="9" width="16" height="11" rx="2" /><path d="M12 9v11M4 13h16M12 9c-3 0-5-1-5-3s3-2 5 3c2-5 5-5 5-3s-2 3-5 3" /></>,
};

const MODES = [
  { href: "/battles", k: "battles", t: "Case Battles", d: "1v1 do 6-way, Crazy i Jackpot, sponzorirani i privatni.", c: "#ff2b4e" },
  { href: "/upgrader", k: "upgrader", t: "Upgrader", d: "Daj Golfa, uzmi Porschea. Ti biraš šansu.", c: "#8b5cf6" },
  { href: "/slide", k: "slide", t: "Slide", d: "Odaberi multiplikator i pusti traku.", c: "#5ce1ff" },
  { href: "/trinity", k: "trinity", t: "Trinity", d: "Crvena, crna ili zlatna 14×.", c: "#ff5a3c" },
  { href: "/jackpot", k: "jackpot", t: "Jackpot", d: "Svake minute nova runda s pravim igračima.", c: "#34d399" },
  { href: "/rewards", k: "rewards", t: "Nagrade", d: "Dnevna kutija, level kutije i kiša coina u chatu.", c: "#ffb547" },
];

// tragovi svjetla (duga ekspozicija) iza auta
const TRAILS = [
  { top: "58%", w: "46%", c: "#ff2b4e", d: "2.2s", delay: "0s" },
  { top: "64%", w: "60%", c: "#ffb547", d: "2.8s", delay: ".5s" },
  { top: "70%", w: "38%", c: "#ffe1a8", d: "1.9s", delay: "1.1s", rev: true },
  { top: "75%", w: "52%", c: "#ff2b4e", d: "2.5s", delay: "1.6s" },
  { top: "81%", w: "44%", c: "#5ce1ff", d: "3.1s", delay: ".8s", rev: true },
];

export default function Home() {
  const [cases, setCases] = useState<CaseWithItems[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    getCases().then(setCases).catch(() => setErr("Kutije se nisu učitale. Provjeri je li supabase/schema.sql pokrenut u Supabaseu."));
  }, []);
  const normal = cases.filter((c) => c.case_type === "normal");

  return (
    <div className="space-y-14">
      <section className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="@container card relative overflow-hidden p-7 pb-14 sm:p-12 sm:pb-14">
          {/* noćna cesta */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_75%_70%,#ff2b4e2b,transparent_70%),radial-gradient(50%_50%_at_90%_30%,#5ce1ff1c,transparent_70%)]" />
            <div className="absolute inset-x-0 bottom-0 h-[44%] bg-[linear-gradient(180deg,transparent,#05050c_70%)]" />
            <div className="absolute inset-x-0 bottom-[16%] h-px bg-[linear-gradient(90deg,transparent,#ffffff40,transparent)]" />
            {TRAILS.map((t, i) => (
              <span
                key={i}
                className={`trail ${t.rev ? "trail-rev" : ""}`}
                style={{ top: t.top, width: t.w, ["--c" as string]: t.c, ["--d" as string]: t.d, ["--delay" as string]: t.delay }}
              />
            ))}
          </div>

          <div className="relative z-10 grid h-full items-end gap-6 @3xl:min-h-[440px] @3xl:grid-cols-[1fr_1.1fr]">
            <div className="self-start">
              <h1 className="headline-in font-display text-[52px] font-extrabold leading-[.88] sm:text-[72px] @5xl:text-[84px]" style={{ fontVariationSettings: '"wdth" 75, "opsz" 96' }}>
                Od Fiće do
                <br />
                Ferrarija 250 GTO
              </h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
                Otvaraj kutije s pravim modelima i oldtajmerima, bori se u battleovima i slaži svoju garažu.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/cases" className="btn-primary px-7 py-3.5 text-lg">Otvori kutiju</Link>
                <Link href="/battles" className="btn-ghost px-5 py-3.5">Uđi u battle</Link>
              </div>
            </div>
            <div className="hero-car pointer-events-none relative mx-auto w-full max-w-[520px] @3xl:mb-4 @3xl:max-w-[600px] @3xl:translate-x-6">
              {/* svjetlo farova */}
              <div className="absolute -left-[6%] top-[40%] h-24 w-40 rounded-full bg-[radial-gradient(closest-side,#fff7d6aa,transparent)] blur-xl" />
              <CarImage item={{ id: 76, brand: "Ferrari", model: "F40", year: 1989, body: "super", rarity: "legendary" }} reflect className="relative w-full" />
            </div>
          </div>
        </div>
        <DropTower />
      </section>

      <section>
        <h2 className="mb-5 font-display text-4xl font-extrabold">Igre</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m) => (
            <Link key={m.href} href={m.href} className="spot group card relative flex items-start gap-4 overflow-hidden p-5 transition duration-300 hover:-translate-y-0.5 hover:border-white/20">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl transition group-hover:scale-110" style={{ background: `${m.c}1f`, boxShadow: `0 0 24px -6px ${m.c}`, color: m.c }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICON[m.k]}</svg>
              </span>
              <span>
                <span className="block font-display text-2xl font-extrabold leading-none">{m.t}</span>
                <span className="mt-1.5 block text-muted">{m.d}</span>
              </span>
              <span className="absolute inset-x-0 bottom-0 h-px opacity-0 transition group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${m.c}, transparent)` }} />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-display text-4xl font-extrabold">Kutije</h2>
          <Link href="/cases" className="font-semibold text-accent2 hover:underline">Sve kutije</Link>
        </div>
        {err && <div className="card p-4 text-red-300">{err}</div>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(normal.length ? normal.slice(0, 8) : Array.from({ length: 8 })).map((c, i) =>
            c ? <CaseCard key={(c as CaseWithItems).id} c={c as CaseWithItems} /> : <div key={i} className="card aspect-[4/5] animate-pulse" />
          )}
        </div>
      </section>
    </div>
  );
}
