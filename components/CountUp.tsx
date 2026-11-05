"use client";

import { useEffect, useRef, useState } from "react";
import { coins } from "@/lib/format";

// Animirani broj (npr. stanje ili vrijednost dobitka)
export function CountUp({ value, duration = 900, className, from, format = coins }: { value: number; duration?: number; className?: string; from?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(from ?? value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef(from ?? value);
  useEffect(() => {
    const start = prev.current;
    const delta = value - start;
    prev.current = value;
    if (Math.abs(delta) < 0.005) {
      setShown(value);
      return;
    }
    setFlash(delta > 0 ? "up" : "down");
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(start + delta * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else setTimeout(() => setFlash(null), 400);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <span className={`${className ?? ""} transition-colors ${flash === "up" ? "!text-emerald-300" : flash === "down" ? "!text-red-300" : ""}`}>
      {format(shown)}
    </span>
  );
}
