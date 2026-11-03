"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "./AuthProvider";
import { coins, levelProgress } from "@/lib/format";

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
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              active ? "bg-accent/15 text-accent" : "text-muted hover:bg-white/5 hover:text-fg"
            }`}
          >
            {n.label}
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
        <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm font-medium text-muted">
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
      <div className="hidden items-center gap-1.5 rounded-md border border-line bg-black/30 px-3 py-1.5 text-sm sm:flex" title="Gemovi">
        <span className="gem" /> {coins(profile?.gems)}
      </div>
      <div className="flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 font-display text-sm text-accent">
        <span className="coin" /> {coins(profile?.balance)}
      </div>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/5">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-accent font-display text-sm font-bold text-black">
          {profile?.level ?? 1}
        </span>
        <span className="hidden flex-col items-start md:flex">
          <span className="text-sm font-semibold leading-none">{profile?.username}</span>
          <span className="mt-1 h-1 w-20 overflow-hidden rounded bg-white/10">
            <span className="block h-full bg-accent" style={{ width: `${lp.pct}%` }} />
          </span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-48 rounded-lg border border-line bg-panel p-1 shadow-2xl" onMouseLeave={() => setOpen(false)}>
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

export function Navbar() {
  const [mobile, setMobile] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <button className="lg:hidden" onClick={() => setMobile((m) => !m)} aria-label="Izbornik">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
        <Link href="/" className="flex items-center gap-2">
          <span className="checker h-7 w-7 rounded-sm" />
          <span className="font-display text-xl font-bold tracking-wider">GARAŽA<span className="text-accent">.gg</span></span>
        </Link>
        <nav className="hidden flex-1 items-center gap-0.5 lg:flex">
          <Suspense fallback={<StaticLinks />}>
            <Links />
          </Suspense>
        </nav>
        <div className="ml-auto">
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
