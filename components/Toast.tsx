"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Kind = "info" | "success" | "error" | "gold";
type T = { id: number; text: string; kind: Kind };
const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const push = useCallback((text: string, kind: Kind = "info") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, kind }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 4200);
  }, []);
  const tone: Record<Kind, string> = {
    info: "border-line bg-panel",
    success: "border-emerald-500/60 bg-emerald-950/90",
    error: "border-red-500/60 bg-red-950/90",
    gold: "border-accent/70 bg-yellow-950/90",
  };
  return (
    <Ctx value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {list.map((t) => (
          <div key={t.id} className={`toast-in rounded-lg border px-4 py-3 text-sm shadow-xl ${tone[t.kind]}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx>
  );
}

export const useToast = () => useContext(Ctx);
