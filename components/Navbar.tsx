"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CountUp } from "./CountUp";
import { isMuted, onMuteChange, setMuted, sfx } from "@/lib/sound";
import { useAuth } from "./AuthProvider";
import { levelProgress } from "@/lib/format";

export const NAV = [
  { href: "/cases", label: "Kutije" },
  { href: "/battles", label: "Battles" },
  { href: "/upgrader", label: "Upgrader" },
  { href: "/slide", label: "Slide" },
  { href: "/trinity", label: "Trinity" },
  { href: "/jackpot", label: "Jackpot" },
  { href: "/rewards", label: "Nagrade", more: true },
  { href: "/gems", label: "Gemovi", more: true },
  { href: "/leaderboard", label: "Ljestvica", more: true },
];

// desktop: glavne poveznice u redu, ostale u "Više"; mobitel (all): sve
function Links({ onClick, all = false }: { onClick?: () => void; all?: boolean }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
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
            className={`relative whitespace-nowrap rounded-lg px-2 py-2 font-display text-[15px] font-bold transition 2xl:px-3 2xl:text-[16px] ${
              active ? "text-fg" : "text-muted hover:bg-white/[.05] hover:text-fg"
            }`}
          >
            {n.label}
            {active && <span className="absolute inset-x-3 -bottom-[14px] h-[2px] rounded-full bg-[linear-gradient(90deg,#ff2b4e,#ffb547)] shadow-[0_0_12px_#ff5a3c]" />}
          </Link>
        );
      })}
      {!all && (
        <div className="relative" onMouseLeave={() => setMore(false)}>
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
            <div className="card absolute left-0 top-full z-[55] mt-1 w-44 p-1.5 shadow-2xl">
              {extra.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setMore(false)} className={`block rounded px-3 py-2 font-display text-[15px] font-bold hover:bg-white/5 ${path.startsWith(n.href) ? "text-fg" : "text-muted"}`}>
                  {n.label}
                </Link>
              ))}
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
        <Link key={n.href} href={n.href} className="px-2 py-2 font-display text-[15px] font-bold text-muted">
          {n.label}
        </Link>
      ))}
    </>
  );
}

function UserBox() {
  const { user, profile, isAdmin, loading, signOut } = useAuth();
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
      <Link href="/gems" className="hidden items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[.06] px-3 py-1.5 font-display text-base font-bold text-emerald-300 transition hover:border-emerald-400/50 sm:flex" title="Gemovi">
        <span className="gem" /> <CountUp value={profile?.gems ?? 0} />
      </Link>
      <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-accent/40 bg-accent/10 px-2.5 py-1.5 font-display text-sm font-bold tabular-nums text-accent shadow-[0_0_24px_-8px_#ffb547] sm:px-3 sm:text-base" title="Stanje (virtualni coini)">
        <span className="coin" /> <CountUp value={profile?.balance ?? 0} />
      </div>
      <button onClick={() => setOpen((o) => !o)} className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1 hover:bg-white/5 sm:px-2" aria-label="Korisnički izbornik">
        <span className={`grid h-9 min-w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#5ce1ff,#8b5cf6)] px-1.5 font-display font-black tabular-nums text-ink shadow-[0_0_18px_-4px_#5ce1ff] ${(profile?.level ?? 1) >= 100 ? "text-sm" : "text-lg"}`} title="Level">
          {profile?.level ?? 1}
        </span>
        <span className="hidden flex-col items-start 2xl:flex">
          <span className="text-sm font-semibold leading-none">{profile?.username}</span>
          <span className="mt-1 h-1.5 w-20 overflow-hidden rounded bg-white/10">
            <span className="block h-full bg-accent transition-[width] duration-700" style={{ width: `${lp.pct}%` }} />
          </span>
        </span>
      </button>
      {open && (
        <div className="card absolute right-0 top-12 z-[55] w-[min(14rem,calc(100vw-1.5rem))] p-1.5 shadow-2xl" onMouseLeave={() => setOpen(false)}>
          <Link href="/profile" onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm hover:bg-white/5">Profil i povijest</Link>
          <Link href="/rewards" onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm hover:bg-white/5">Nagrade i level</Link>
          <Link href="/affiliate" onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm hover:bg-white/5">Pozovi prijatelje</Link>
          <Link href="/nova-lozinka" onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm hover:bg-white/5">Promijeni lozinku</Link>
          {isAdmin && <Link href="/admin" onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm font-semibold text-accent2 hover:bg-white/5">Admin panel</Link>}
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
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-4">
        <button className="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg xl:hidden" onClick={() => setMobile((m) => !m)} aria-label="Izbornik" aria-expanded={mobile}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="GARAŽA.gg naslovna">
          <span className="relative grid h-8 w-8 place-items-center">
            <span className="absolute inset-0 rounded-lg bg-[linear-gradient(135deg,#ff2b4e,#ffb547)] shadow-[0_0_20px_-2px_#ff2b4e]" />
            <span className="relative h-1 w-5 rounded-full bg-white/90 shadow-[0_0_8px_#fff]" />
          </span>
          <span className="hidden font-display text-2xl font-extrabold min-[430px]:inline">garaža<span className="text-muted">.gg</span></span>
        </Link>
        <nav className="hidden min-w-0 flex-1 items-center gap-0.5 xl:flex">
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
