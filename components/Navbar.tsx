"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { CountUp } from "./CountUp";
import { GameIcon } from "./GameIcon";
import { isMuted, onMuteChange, setMuted, sfx } from "@/lib/sound";
import { useAuth } from "./AuthProvider";
import { coins, compact, levelProgress } from "@/lib/format";

export const NAV = [
  { href: "/cases", label: "Kutije" },
  { href: "/battles", label: "Battles" },
  { href: "/upgrader", label: "Upgrader" },
  { href: "/crash", label: "Crash" },
  { href: "/crossroad", label: "Crossroad" },
  { href: "/plinko", label: "Plinko" },
  { href: "/rulet", label: "Rulet" },
  { href: "/jackpot", label: "Jackpot" },
  { href: "/rewards", label: "Nagrade", more: true },
  { href: "/gems", label: "Gemovi", more: true },
  { href: "/leaderboard", label: "Ljestvica", more: true },
];

// desktop: glavne poveznice u redu, ostale u "Više"; mobitel (all): sve
function Links({ onClick, all = false }: { onClick?: () => void; all?: boolean }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const moreBox = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // zatvori klikom izvan izbornika ili Escapeom (ne odmah na izlazak miša — tada se ne može doći do stavki)
  useEffect(() => {
    if (!more) return;
    const onDown = (e: PointerEvent) => {
      if (!moreBox.current?.contains(e.target as Node)) setMore(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [more]);
  useEffect(() => () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); }, []);
  const extra = NAV.filter((n) => n.more);
  const extraActive = extra.some((n) => path === n.href || path.startsWith(n.href + "/"));
  return (
    <>
      {NAV.filter((n) => all || !n.more).map((n) => {
        const active = path === n.href || path.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onClick}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 font-display text-[15px] font-bold transition 2xl:px-3 2xl:text-[16px] ${
              active ? "text-fg" : "text-muted hover:bg-white/[.05] hover:text-fg"
            }`}
          >
            {/* desktop: ikona tek kad ima mjesta; mobilni izbornik: uvijek */}
            <GameIcon href={n.href} className={`h-4 w-4 ${active ? "text-accent" : "opacity-80"} ${all ? "" : "hidden xl:block"}`} />
            {n.label}
            {active && <span className={`absolute inset-x-3 h-[2px] rounded-full bg-[linear-gradient(90deg,#ff2b4e,#ffb547)] shadow-[0_0_12px_#ff5a3c] ${all ? "bottom-0.5" : "-bottom-[14px]"}`} />}
          </Link>
        );
      })}
      {!all && (
        <div
          ref={moreBox}
          className="relative"
          onMouseEnter={() => leaveTimer.current && clearTimeout(leaveTimer.current)}
          onMouseLeave={() => {
            leaveTimer.current = setTimeout(() => setMore(false), 250);
          }}
        >
          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            aria-expanded={more}
            className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-2 font-display text-[15px] font-bold transition 2xl:px-3 2xl:text-[16px] ${extraActive ? "text-fg" : "text-muted hover:bg-white/[.05] hover:text-fg"}`}
          >
            Više
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition ${more ? "rotate-180" : ""}`} aria-hidden><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {more && (
            // pt-2 umjesto mt-1: nema rupe između gumba i izbornika u kojoj bi miš "izašao"
            <div className="absolute left-0 top-full z-[55] w-44 pt-2">
            <div className="rounded-2xl border border-white/10 bg-[#14142c] p-1.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,.85)]">
              {extra.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setMore(false)} className={`flex items-center gap-2 rounded px-3 py-2 font-display text-[15px] font-bold hover:bg-white/5 ${path.startsWith(n.href) ? "text-fg" : "text-muted"}`}>
                  <GameIcon href={n.href} />
                  {n.label}
                </Link>
              ))}
            </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function StaticLinks() {
  return (
    <>
      {NAV.filter((n) => !n.more).map((n) => (
        <Link key={n.href} href={n.href} className="flex items-center gap-1.5 px-2 py-2 font-display text-[15px] font-bold text-muted">
          <GameIcon href={n.href} className="hidden h-4 w-4 opacity-80 xl:block" />
          {n.label}
        </Link>
      ))}
    </>
  );
}

// stalna boja ikone po imenu (isto ime = ista boja)
const nameHue = (n?: string | null) => [...(n ?? "")].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

function UserBox() {
  const { user, profile, isAdmin, isTester, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  if (loading) return <div className="h-9 w-40 animate-pulse rounded-md bg-white/5" />;
  if (!user)
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="btn-ghost">Prijava</Link>
        <Link href="/register" className="btn-primary hidden sm:inline-flex">Registracija</Link>
      </div>
    );
  const lp = profile ? levelProgress(profile.xp, profile.level) : { pct: 0 };
  return (
    <div className="relative flex shrink-0 items-center gap-1.5 sm:gap-3">
      <Link href="/gems" className="hidden items-center gap-1.5 rounded-xl border border-emerald-400/20 xl:!hidden 2xl:!flex bg-emerald-400/[.06] px-3 py-1.5 font-display text-base font-bold text-emerald-300 transition hover:border-emerald-400/50 sm:flex" title={`Gemovi: ${coins(profile?.gems ?? 0)}`}>
        <span className="gem" /> <CountUp value={profile?.gems ?? 0} format={compact} />
      </Link>
      <div className="flex shrink-0 flex-col items-start gap-0.5 whitespace-nowrap rounded-xl border border-accent/40 bg-accent/10 px-2.5 py-1 font-display text-sm font-bold tabular-nums text-accent shadow-[0_0_24px_-8px_#ffb547] sm:flex-row sm:items-center sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-base xl:flex-col xl:items-start xl:gap-0.5 xl:py-1 2xl:flex-row 2xl:items-center 2xl:gap-1.5 2xl:py-1.5" title="Stanje (virtualni coini)">
        <span className="flex items-center gap-1.5 leading-none">
          <span className="coin" /> <CountUp value={profile?.balance ?? 0} />
        </span>
        {/* mobitel: gemovi ispod coina (zaseban gumb ne stane u traku) */}
        <Link href="/gems" className="flex items-center gap-1 text-[11px] leading-none text-emerald-300 sm:hidden xl:flex 2xl:hidden" title={`Gemovi: ${coins(profile?.gems ?? 0)}`}>
          <span className="gem" /> <CountUp value={profile?.gems ?? 0} format={compact} />
        </Link>
      </div>
      <button onClick={() => setOpen((o) => !o)} className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1 hover:bg-white/5 sm:px-2" aria-label="Korisnički izbornik">
        {/* okrugla ikona s početnim slovom imena + level kao značka */}
        <span className="relative shrink-0">
          <span
            className="grid h-9 w-9 place-items-center rounded-full font-display text-base font-black uppercase text-ink ring-2 ring-white/15"
            style={{ background: `linear-gradient(135deg, hsl(${nameHue(profile?.username)} 85% 72%), hsl(${(nameHue(profile?.username) + 40) % 360} 80% 58%))` }}
            title={profile?.username}
          >
            {(profile?.username ?? "?").trim().charAt(0) || "?"}
          </span>
          <span
            className="absolute -bottom-1.5 -right-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[linear-gradient(135deg,#5ce1ff,#8b5cf6)] px-1 font-display text-[10px] font-black tabular-nums leading-none text-ink ring-2 ring-[#090a14]"
            title="Level"
          >
            {profile?.level ?? 1}
          </span>
        </span>
        <span className="hidden flex-col items-start min-[1700px]:flex">
          <span className="text-sm font-semibold leading-none">{profile?.username}</span>
          <span className="mt-1 h-1.5 w-20 overflow-hidden rounded bg-white/10">
            <span className="block h-full bg-accent transition-[width] duration-700" style={{ width: `${lp.pct}%` }} />
          </span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-[55] w-[min(14rem,calc(100vw-1.5rem))] rounded-2xl border border-white/10 bg-[#14142c] p-1.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,.85)]" onMouseLeave={() => setOpen(false)}>
          <Link href="/profile" onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm hover:bg-white/5">Profil i povijest</Link>
          <Link href="/rewards" onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm hover:bg-white/5">Nagrade i level</Link>
          <Link href="/affiliate" onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm hover:bg-white/5">Pozovi prijatelje</Link>
          <Link href="/nova-lozinka" onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm hover:bg-white/5">Promijeni lozinku</Link>
          {isAdmin && <Link href="/admin" onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm font-semibold text-accent2 hover:bg-white/5">Admin panel</Link>}
          {!isAdmin && isTester && <Link href="/admin" onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm font-semibold text-amber-300 hover:bg-white/5">Tester panel</Link>}
          <button onClick={() => { setOpen(false); signOut(); }} className="block w-full rounded px-3 py-2 text-left text-sm text-red-400 hover:bg-white/5">
            Odjava
          </button>
        </div>
      )}
    </div>
  );
}

function SoundToggle() {
  const [m, setM] = useState(false);
  useEffect(() => {
    setM(isMuted());
    return onMuteChange(setM);
  }, []);
  return (
    <button
      onClick={() => { setMuted(!m); if (m) sfx.click(); }}
      className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-muted transition hover:border-white/25 hover:text-fg"
      aria-label={m ? "Uključi zvuk" : "Isključi zvuk"}
      title={m ? "Uključi zvuk" : "Isključi zvuk"}
    >
      {m ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="m23 9-6 6M17 9l6 6" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
      )}
    </button>
  );
}

export function Navbar() {
  const [mobile, setMobile] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-white/[.06] bg-[#090a14]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-4 xl:max-w-none xl:gap-6 xl:px-6 2xl:px-8">
        <button className="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg xl:hidden" onClick={() => setMobile((m) => !m)} aria-label="Izbornik" aria-expanded={mobile}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Garaža.gg naslovna">
          <span className="relative grid h-8 w-8 place-items-center">
            <span className="absolute inset-0 rounded-lg bg-[linear-gradient(135deg,#ff2b4e,#ffb547)] shadow-[0_0_20px_-2px_#ff2b4e]" />
            <span className="relative h-1 w-5 rounded-full bg-white/90 shadow-[0_0_8px_#fff]" />
          </span>
          <span className="hidden font-display text-2xl font-extrabold min-[430px]:inline">Garaža<span className="text-muted">.gg</span></span>
        </Link>
        <nav className="hidden min-w-max flex-1 items-center gap-0.5 xl:flex 2xl:gap-1">
          <Suspense fallback={<StaticLinks />}>
            <Links />
          </Suspense>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span className="hidden sm:block"><SoundToggle /></span>
          <UserBox />
        </div>
      </div>
      {mobile && (
        <nav className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line p-3 xl:hidden">
          <div className="grid grid-cols-2 gap-1">
            <Suspense fallback={<StaticLinks />}>
              <Links onClick={() => setMobile(false)} all />
            </Suspense>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line pt-3 sm:hidden">
            <span className="text-sm text-muted">Zvuk</span>
            <SoundToggle />
          </div>
        </nav>
      )}
    </header>
  );
}
