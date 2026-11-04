"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { sfx } from "@/lib/sound";

type Kind = "info" | "success" | "error" | "gold";
type T = { id: number; text: string; kind: Kind; ms: number };
const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {});

const STYLE: Record<Kind, { color: string; title: string; path: string }> = {
  info: { color: "#5ce1ff", title: "Obavijest", path: "M12 8h.01M11 12h1v5h1" },
  success: { color: "#34d399", title: "Gotovo", path: "M5 12.5l4.5 4.5L19 7.5" },
  error: { color: "#ff5a6e", title: "Nije uspjelo", path: "M7 7l10 10M17 7L7 17" },
  gold: { color: "#ffb547", title: "Dobitak", path: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" },
};

// Obavijesti: gore u sredini ispod navigacije, s trakom preostalog vremena; klik zatvara
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const close = (id: number) => setList((l) => l.filter((x) => x.id !== id));
  const push = useCallback((text: string, kind: Kind = "info") => {
    const id = Date.now() + Math.random();
    const ms = kind === "error" ? 5500 : 4200;
    setList((l) => [...l.slice(-2), { id, text, kind, ms }]);
    if (kind === "success" || kind === "gold") sfx.coin();
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), ms);
  }, []);
  return (
    <Ctx value={push}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed left-1/2 top-[76px] z-[70] flex w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2">
        {list.map((t) => {
          const st = STYLE[t.kind];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => close(t.id)}
              className="toast-drop pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border bg-[#12122acc] px-3.5 py-3 text-left shadow-[0_18px_50px_-12px_rgba(0,0,0,.7)] backdrop-blur-xl"
              style={{ borderColor: st.color + "55", boxShadow: `0 18px 50px -12px rgba(0,0,0,.7), 0 0 28px -10px ${st.color}` }}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: st.color + "22", color: st.color }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill={t.kind === "gold" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {t.kind === "info" && <circle cx="12" cy="12" r="9" fill="none" />}
                  <path d={st.path} />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[13px] font-bold" style={{ color: st.color }}>{st.title}</span>
                <span className="block text-[15px] font-medium leading-snug text-fg">{t.text}</span>
              </span>
              <span className="toast-timer absolute bottom-0 left-0 h-[3px] w-full origin-left" style={{ background: st.color, animationDuration: `${t.ms}ms` }} />
            </button>
          );
        })}
      </div>
    </Ctx>
  );
}

export const useToast = () => useContext(Ctx);
