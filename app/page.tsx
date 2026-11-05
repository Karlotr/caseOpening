"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCases } from "@/lib/data";
import type { CaseWithItems } from "@/lib/types";
import { CaseCard } from "@/components/CaseCard";
import { DropTower } from "@/components/LiveDrops";
import { CarImage } from "@/components/CarImage";

type Mode = { href: string; t: string; d: string; c: string; span: string; art: React.ReactNode; badge?: string };

// mini "ilustracije" za pločice igara (čisti SVG/CSS, bez slika)
const CrashArt = () => (
  <svg viewBox="0 0 120 70" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
    <defs>
      <linearGradient id="hcF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5ce1ff" stopOpacity=".45" /><stop offset="1" stopColor="#5ce1ff" stopOpacity="0" /></linearGradient>
    </defs>
    <path d="M0 68 C40 66 70 56 92 30 L104 12 L104 70 L0 70Z" fill="url(#hcF)" />
    <path d="M0 68 C40 66 70 56 92 30 L104 12" fill="none" stroke="#5ce1ff" strokeWidth="3" strokeLinecap="round" />
    <circle cx="104" cy="12" r="4" fill="#fff" />
  </svg>
);
const RoadArt = () => (
  <div className="flex h-full w-full overflow-hidden rounded-lg" aria-hidden>
    {[0, 1, 2, 3, 4].map((i) => (
      <div key={i} className="relative flex-1 border-r-2 border-dashed border-white/15 bg-[#14152a]">
        <span className={`home-road-car absolute left-1/2 h-6 w-3.5 -translate-x-1/2 rounded ${["bg-[#ff2b4e]", "bg-[#ffb547]", "bg-[#a78bfa]", "bg-[#5ce1ff]", "bg-[#34d399]"][i]}`} style={{ animationDuration: `${1.2 + i * 0.35}s`, animationDelay: `${-i * 0.4}s` }} />
      </div>
    ))}
  </div>
);
const RuletArt = () => (
  <div className="flex h-full w-full items-center gap-1" aria-hidden>
    {["#ff2b4e", "#1f2033", "#ff2b4e", "#facc15", "#1f2033", "#ff2b4e", "#1f2033"].map((c, i) => (
      <span key={i} className="h-[70%] flex-1 rounded-md ring-1 ring-white/10" style={{ background: c, boxShadow: c === "#facc15" ? "0 0 18px #facc15" : undefined }} />
    ))}
  </div>
);
const JackpotArt = () => (
  <svg viewBox="0 0 60 60" className="h-full w-full" aria-hidden>
    {[["#34d399", 0, 40], ["#5ce1ff", 40, 25], ["#ffb547", 65, 20], ["#ff2b4e", 85, 15]].map(([c, o, l], i) => (
      <circle key={i} cx="30" cy="30" r="22" fill="none" stroke={c as string} strokeWidth="9" pathLength="100" strokeDasharray={`${l} 100`} strokeDashoffset={-(o as number)} transform="rotate(-90 30 30)" />
    ))}
  </svg>
);
const IconArt = ({ d, c }: { d: React.ReactNode; c: string }) => (
  <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

const MODES: Mode[] = [
  {
    href: "/cases", t: "Kutije", d: "Od Fiće za 1,50 do kutija od 163.000. 50/50, 30/70 i hypercari.", c: "#ffb547", span: "col-span-2 row-span-2",
    art: <CarImage item={{ id: 76, brand: "Ferrari", model: "F40", year: 1989, body: "super", rarity: "legendary" }} reflect className="h-full w-full" />,
  },
  {
    href: "/battles", t: "Case Battles", d: "1v1 do 3v3, Crazy i Jackpot. Pobjednik nosi sve.", c: "#ff2b4e", span: "col-span-2",
    art: (
      <div className="flex h-full items-center justify-center gap-3 font-display text-4xl font-black" aria-hidden>
        <span className="h-12 w-12 rounded-xl bg-[#ff2b4e]/80 shadow-[0_0_24px_#ff2b4e]" />
        <span className="text-white/80">VS</span>
        <span className="h-12 w-12 rounded-xl bg-[#5ce1ff]/80 shadow-[0_0_24px_#5ce1ff]" />
      </div>
    ),
  },
  { href: "/crash", t: "Crash", d: "Svi u istoj rundi. Izađi prije crasha.", c: "#5ce1ff", span: "", art: <CrashArt /> },
  { href: "/crossroad", t: "Crossroad", d: "Prijeđi autocestu traku po traku.", c: "#34d399", span: "", art: <RoadArt />, badge: "Novo" },
  { href: "/upgrader", t: "Upgrader", d: "Daj Golfa, uzmi Porschea.", c: "#8b5cf6", span: "", art: <IconArt c="#a78bfa" d={<path d="M12 20V5M5 12l7-7 7 7M5 21h14" />} /> },
  { href: "/rulet", t: "Rulet", d: "Crvena, crna ili zlatna 14×.", c: "#ff5a3c", span: "", art: <RuletArt /> },
  { href: "/jackpot", t: "Jackpot", d: "Svake minute nova runda.", c: "#34d399", span: "", art: <JackpotArt /> },
  {
    href: "/rewards", t: "Nagrade", d: "Dnevna kutija, level kutije, kiša.", c: "#ffb547", span: "",
    art: <IconArt c="#ffb547" d={<><rect x="4" y="9" width="16" height="11" rx="2" /><path d="M12 9v11M4 13h16M12 9c-3 0-5-1-5-3s3-2 5 3c2-5 5-5 5-3s-2 3-5 3" /></>} />,
  },
];

function ModeTile({ m, big = false }: { m: Mode; big?: boolean }) {
  return (
    <Link
      href={m.href}
      className={`spot group card relative flex flex-col justify-end overflow-hidden p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/25 sm:p-5 ${m.span}`}
      style={{ background: `radial-gradient(120% 90% at 100% 0%, ${m.c}2e, transparent 60%), linear-gradient(180deg, #ffffff06, transparent)`, ["--g" as string]: m.c }}
    >
      <div className={`pointer-events-none absolute transition duration-500 group-hover:scale-105 ${big ? "inset-x-4 top-3 bottom-[38%] sm:inset-x-8" : "right-3 top-3 h-[40%] w-[46%] opacity-90"}`}>{m.art}</div>
      {m.badge && <span className="absolute left-3 top-3 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-ink shadow-[0_0_14px_#34d399]">{m.badge}</span>}
      <div className="relative">
        <div className={`font-display font-extrabold leading-none ${big ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}>{m.t}</div>
        <div className={`mt-1 text-muted ${big ? "text-sm sm:text-base" : "hidden text-sm sm:block"}`}>{m.d}</div>
      </div>
      <span className="absolute inset-x-0 bottom-0 h-[2px] opacity-0 transition group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${m.c}, transparent)` }} />
    </Link>
  );
}

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
        <div className="min-w-0 space-y-4">
          {/* kratki naslov — igre su u fokusu */}
          <div className="card relative overflow-hidden px-5 py-5 sm:px-7 sm:py-6">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-[radial-gradient(60%_120%_at_85%_50%,#ff2b4e26,transparent_70%)]" />
              {TRAILS.slice(0, 3).map((t, i) => (
                <span key={i} className={`trail ${t.rev ? "trail-rev" : ""}`} style={{ top: `${30 + i * 22}%`, width: t.w, ["--c" as string]: t.c, ["--d" as string]: t.d, ["--delay" as string]: t.delay }} />
              ))}
            </div>
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="headline-in font-display text-3xl font-extrabold leading-[.95] sm:text-4xl 2xl:text-5xl" style={{ fontVariationSettings: '"wdth" 75, "opsz" 96' }}>
                  Od Fiće do Ferrarija 250 GTO
                </h1>
                <p className="mt-2 hidden max-w-xl text-muted sm:block">Kutije s pravim modelima i oldtajmerima, battleovi, crash i još šest igara. Samo virtualni coini.</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href="/cases" className="btn-primary px-6 py-3 text-base">Otvori kutiju</Link>
                <Link href="/battles" className="btn-ghost px-5 py-3">Uđi u battle</Link>
              </div>
            </div>
          </div>

          {/* igre */}
          <div className="grid auto-rows-[136px] grid-cols-2 gap-3 sm:auto-rows-[160px] lg:grid-cols-4">
            {MODES.map((m, i) => (
              <ModeTile key={m.href} m={m} big={i === 0} />
            ))}
          </div>
        </div>
        <DropTower />
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
