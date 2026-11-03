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
  { href: "/gems", label: "Gem Stash" },
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
            className={`relative px-3 py-2 font-display text-[17px] font-semibold tracking-wide transition ${
              active ? "text-fg" : "text-muted hover:text-fg"
            }`}
          >
            {n.label}
            {active && <span className="livery-band absolute inset-x-3 -bottom-[13px] h-[3px]" />}
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
        <Link key={n.href} href={n.href} className="px-3 py-2 font-display text-[17px] font-semibold tracking-wide text-muted">
          {n.label}
        </Link>
      ))}
    </>
  );
}

function UserBox() {
  const { user, profile, loading, signOut } = useAuth();
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
      <Link href="/gems" className="hidden items-center gap-1.5 rounded-md border border-line bg-ink/60 px-3 py-1.5 font-display text-base font-bold text-emerald-300 sm:flex" title="Gemovi">
        <span className="gem" /> <CountUp value={profile?.gems ?? 0} />
      </Link>
      <div className="flex items-center gap-1.5 rounded-md border border-accent/50 bg-accent/10 px-3 py-1.5 font-display text-base font-bold text-accent" title="Stanje (virtualni coini)">
        <span className="coin" /> <CountUp value={profile?.balance ?? 0} />
      </div>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/5">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-accent2 font-display text-lg font-black text-ink" title="Level">
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
        <div className="absolute right-0 top-12 z-40 w-52 rounded-lg border border-line bg-panel2 p-1 shadow-2xl" onMouseLeave={() => setOpen(false)}>
          <Link href="/profile" onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm hover:bg-white/5">Garaža (inventar)</Link>
          <Link href="/rewards" onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm hover:bg-white/5">Nagrade i level</Link>
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
      className="grid h-9 w-9 place-items-center rounded-md border border-line text-muted hover:text-fg"
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
    <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
      <div className="livery-band h-[3px]" />
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <button className="lg:hidden" onClick={() => setMobile((m) => !m)} aria-label="Izbornik">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
        <Link href="/" className="flex items-center gap-2">
          <span className="checker h-7 w-7 rounded-sm" />
          <span className="font-display text-2xl font-black tracking-tight">GARAŽA<span className="text-accent2">.gg</span></span>
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
