// Ikone igara (navbar, početna) — stroke ikone 24×24
const PATHS: Record<string, React.ReactNode> = {
  "/cases": <><path d="M3 8l9-5 9 5v8l-9 5-9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  "/battles": <path d="M5 5l14 14M19 5L5 19M3 9l6-6M15 21l6-6" />,
  "/upgrader": <path d="M12 20V5M5 12l7-7 7 7M5 21h14" />,
  "/crash": <path d="M3 20h18M4 18c6 0 10-4 13-12M17 6h3v3" />,
  "/rulet": <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" /><path d="M12 3.5v5.5M12 15v5.5M3.5 12H9M15 12h5.5" /></>,
  "/jackpot": <><circle cx="12" cy="12" r="8" /><path d="M12 4v8l6 5" /></>,
  "/rewards": <><rect x="4" y="9" width="16" height="11" rx="2" /><path d="M12 9v11M4 13h16M12 9c-3 0-5-1-5-3s3-2 5 3c2-5 5-5 5-3s-2 3-5 3" /></>,
  "/gems": <path d="M6 3h12l3 6-9 12L3 9zM3 9h18M12 21 8 9l4-6 4 6z" />,
  "/leaderboard": <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />,
};

export function GameIcon({ href, className = "h-4 w-4" }: { href: string; className?: string }) {
  const p = PATHS[href];
  if (!p) return null;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden>
      {p}
    </svg>
  );
}
