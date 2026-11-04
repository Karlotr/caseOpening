"use client";

import { usePathname, useRouter } from "next/navigation";

// "Natrag" na svim stranicama osim naslovne: povijest preglednika, a ako je nema, roditeljska stranica
export function BackButton() {
  const path = usePathname();
  const router = useRouter();
  if (path === "/") return null;
  const parent = path.split("/").slice(0, -1).join("/") || "/";
  const back = () => {
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
    else router.push(parent);
  };
  return (
    <button type="button" onClick={back} className="group mb-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-sm font-semibold text-muted transition hover:bg-white/5 hover:text-fg">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition group-hover:-translate-x-0.5" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Natrag
    </button>
  );
}
