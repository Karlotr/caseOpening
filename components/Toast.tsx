"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { sfx } from "@/lib/sound";

type Kind = "info" | "success" | "error" | "gold";
type T = { id: number; text: string; kind: Kind };
const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {});

const STYLE: Record<Kind, { bar: string; icon: string }> = {
  info: { bar: "#8fcbeb", icon: "ℹ" },
  success: { bar: "#34d399", icon: "✓" },
  error: { bar: "#f87171", icon: "✕" },
  gold: { bar: "#f5821f", icon: "★" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const push = useCallback((text: string, kind: Kind = "info") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l.slice(-3), { id, text, kind }]);
    if (kind === "success" || kind === "gold") sfx.coin();
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <Ctx value={push}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {list.map((t) => (
          <div key={t.id} className="toast-in flex items-center gap-3 overflow-hidden rounded-lg border border-line bg-panel2/95 py-3 pl-0 pr-4 text-[15px] shadow-2xl backdrop-blur">
            <span className="grid h-full w-10 shrink-0 place-items-center self-stretch text-lg font-bold text-ink" style={{ background: STYLE[t.kind].bar }}>
              {STYLE[t.kind].icon}
            </span>
            <span className="font-medium">{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx>
  );
}

export const useToast = () => useContext(Ctx);
