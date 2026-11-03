"use client";

import { useEffect } from "react";

// Pozadina cijele stranice: noćno nebo, rijetki svjetlosni tragovi, zrnatost filma.
// Također postavlja --mx/--my na .spot elementima (svjetlo prati kursor).
export function BackgroundFX() {
  useEffect(() => {
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = (e.target as HTMLElement | null)?.closest?.(".spot") as HTMLElement | null;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_80%_-10%,#3b1d6e55,transparent_60%),radial-gradient(900px_600px_at_-10%_10%,#0e3b5c55,transparent_60%),radial-gradient(1000px_500px_at_50%_120%,#5a1230,transparent_60%),linear-gradient(180deg,#0a0b17,#090a14_40%,#0c0a18)]" />
      {/* horizont s gradskim sjajem */}
      <div className="absolute inset-x-0 bottom-0 h-[40vh] bg-[linear-gradient(0deg,#ff2b4e14,transparent)]" />
      {/* rijetki tragovi svjetla daleko u pozadini */}
      <div className="absolute inset-x-0 top-[62%] opacity-40">
        <span className="trail" style={{ width: "28vw", top: 0, ["--c" as string]: "#ff2b4e", ["--d" as string]: "9s", ["--delay" as string]: "1s" }} />
        <span className="trail trail-rev" style={{ width: "20vw", top: 26, ["--c" as string]: "#ffe1a8", ["--d" as string]: "11s", ["--delay" as string]: "4s" }} />
        <span className="trail" style={{ width: "34vw", top: 54, ["--c" as string]: "#ffb547", ["--d" as string]: "13s", ["--delay" as string]: "7s" }} />
      </div>
      <div className="grain absolute inset-0" />
    </div>
  );
}
