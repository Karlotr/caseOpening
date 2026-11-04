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
  { href: "/rewards", label: "Nagrade" },
  { href: "/gems", label: "Gemovi" },
  { href: "/leaderboard", label: "Ljestvica" },
];

function Links({ onClick }: { onClick?: () => void }) {
  const path = usePathname();
  return (
    <>
      {NAV.map((n) => {
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
    </>
  );
}

function StaticLinks() {
  return (
    <>
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className="px-3 py-2 font-display text-[16px] font-bold text-muted">
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
    <div className="relative flex items-center gap-2 sm:gap-3">
      <Link href="/gems" className="hidden items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[.06] px-3 py-1.5 font-display text-base font-bold text-emerald-300 transition hover:border-emerald-400/50 sm:flex" title="Gemovi">
        <span className="gem" /> <CountUp value={profile?.gems ?? 0} />
      </Link>
      <div className="flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 font-display text-base font-bold text-accent shadow-[0_0_24px_-8px_#ffb547]" title="Stanje (virtualni coini)">
        <span className="coin" /> <CountUp value={profile?.balance ?? 0} />
      </div>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#5ce1ff,#8b5cf6)] font-display text-lg font-black text-ink shadow-[0_0_18px_-4px_#5ce1ff]" title="Level">
          {profile?.level ?? 1}
        </span>
        <span className="hidden flex-col items-start md:flex">
          <span className="text-sm font-semibold leading-none">{profile?.username}</span>
          <span className="mt-1 h-1.5 w-20 overflow-hidden rounded bg-white/10">
            <span className="block h-full bg-accent transition-[width] duration-700" style={{ width: `${lp.pct}%` }} />
          </span>
        </span>
      </button>
      {open && (
        <div className="card absolute right-0 top-12 z-[55] w-56 p-1.5 shadow-2xl" onMouseLeave={() => setOpen(false)}>
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
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <button className="lg:hidden" onClick={() => setMobile((m) => !m)} aria-label="Izbornik">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
        <Link href="/" className="flex items-center gap-2">
          <span className="relative grid h-8 w-8 place-items-center">
            <span className="absolute inset-0 rounded-lg bg-[linear-gradient(135deg,#ff2b4e,#ffb547)] shadow-[0_0_20px_-2px_#ff2b4e]" />
            <span className="relative h-1 w-5 rounded-full bg-white/90 shadow-[0_0_8px_#fff]" />
          </span>
          <span className="font-display text-2xl font-extrabold">garaža<span className="text-muted">.gg</span></span>
        </Link>
        <nav className="hidden flex-1 items-center gap-0.5 lg:flex">
          <Suspense fallback={<StaticLinks />}>
            <Links />
          </Suspense>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <SoundToggle />
          <UserBox />
        </div>
      </div>
      {mobile && (
        <nav className="grid grid-cols-2 gap-1 border-t border-line p-3 lg:hidden">
          <Suspense fallback={<StaticLinks />}>
            <Links onClick={() => setMobile(false)} />
          </Suspense>
        </nav>
      )}
    </header>
  );
}
