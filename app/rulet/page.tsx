"use client";

import { useEffect, useRef, useState } from "react";
import { coins } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { BetInput } from "@/components/BetInput";
import { useLimits } from "@/lib/useLimits";
import { RequireAuth } from "@/components/RequireAuth";
import { useCelebrate } from "@/components/WinOverlay";
import { sfx } from "@/lib/sound";

type Color = "red" | "black" | "gold";
type Res = { slot: number; color: Color; won: boolean; payout: number };

// mora odgovarati play_rulet u SQL-u
const colorOf = (slot: number): Color => (slot === 0 || slot === 15 ? "gold" : slot % 2 === 1 ? "red" : "black");
const SLOTS = 30;
const REPS = 8;
const SPIN_MS = 5200;
const EASE = "cubic-bezier(0.1,0.65,0.1,1)";
const NEAR_EASE = "cubic-bezier(0.08,0.62,0.03,1)"; // dulji, mekši rep kad stane tik do ruba
const FAKE_NEAR = 0.18; // povremeno stane tik do ruba i kad to nije "stvarno" (ishod je uvijek isti)
const STYLE: Record<Color, { tile: string; chip: string; label: string; mult: number; btn: string; glow: string }> = {
  red: { tile: "bg-[linear-gradient(180deg,#ff4d6a,#c8102e)]", chip: "bg-[#e11d48]", label: "Crvena", mult: 2, btn: "from-[#ff4d6a] to-[#b80f2a]", glow: "#ff2b4e" },
  black: { tile: "bg-[linear-gradient(180deg,#3a3a52,#16161f)]", chip: "bg-[#2a2a3a]", label: "Crna", mult: 2, btn: "from-[#4a4a66] to-[#1b1b28]", glow: "#8b8bb0" },
  gold: { tile: "bg-[linear-gradient(180deg,#fff3a6,#facc15_45%,#d97706)]", chip: "bg-[#facc15]", label: "Zlatna", mult: 14, btn: "from-[#fff3a6] via-[#facc15] to-[#d97706]", glow: "#facc15" },
};

const nowMs = () => performance.now();
// gdje unutar pločice stati (samo prikaz — boja je već izvučena na serveru):
// obično negdje u sredini, a ponekad tik do ruba (radije prema zlatnoj, ako je susjed zlatni) — mali near-miss
function landingPoint(slot: number, color: Color, tile: number) {
  const leftN = colorOf((slot + SLOTS - 1) % SLOTS);
  const rightN = colorOf((slot + 1) % SLOTS);
  const goldNext = color !== "gold" && (leftN === "gold" || rightN === "gold");
  if (Math.random() < FAKE_NEAR || (goldNext && Math.random() < 0.35)) {
    const toRight = rightN === "gold" ? true : leftN === "gold" ? false : Math.random() < 0.6;
    const px = 3 + Math.random() * 6;
    return { within: toRight ? 1 - px / tile : px / tile, near: true };
  }
  return { within: 0.15 + Math.random() * 0.7, near: false };
}

export default function RuletPage() {
  return (
    <RequireAuth what="igrati Rulet">
      <Rulet />
    </RequireAuth>
  );
}

function Rulet() {
  const rpc = useRpc();
  const toast = useToast();
  const { refresh } = useAuth();
  const limits = useLimits();
  const celebrate = useCelebrate();
  const [bet, setBet] = useState(1);
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const [tr, setTr] = useState("none");
  const [tile, setTile] = useState(100);
  const [landed, setLanded] = useState<number | null>(null); // indeks pobjedničke pločice
  const [pick, setPick] = useState<Color | null>(null);
  const [history, setHistory] = useState<Color[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const strip = Array.from({ length: SLOTS * REPS }, (_, i) => i % SLOTS);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      const t = el.clientWidth < 640 ? 76 : 100;
      setTile(t);
      if (!busy) setOffset(SLOTS * 2 * t - el.clientWidth / 2 + t / 2);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = async (c: Color) => {
    if (busy) return;
    setBusy(true);
    setPick(c);
    setLanded(null);
    const res = await rpc<Res>("play_rulet", { p_bet: bet, p_color: c }, { silentRefresh: true });
    if (!res) {
      setPick(null);
      return setBusy(false);
    }
    const w = box.current?.clientWidth ?? 800;
    const idx = SLOTS * (REPS - 2) + res.slot;

    const { within, near } = landingPoint(res.slot, res.color, tile);
    // pokret od početka (2. krug) do cilja — jedna glatka vrtnja
    setTr("none");
    setOffset(SLOTS * 2 * tile - w / 2 + tile / 2);
    const ms = near ? SPIN_MS + 700 : SPIN_MS;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setTr(`transform ${ms}ms ${near ? NEAR_EASE : EASE}`);
        setOffset(idx * tile + within * tile - w / 2);
        sfx.spin();
      })
    );
    // tick pri svakoj pločici
    let last = -1;
    let raf = 0;
    const t0 = nowMs();
    const watch = () => {
      if (!track.current) return;
      const m = new DOMMatrixReadOnly(getComputedStyle(track.current).transform);
      const i = Math.floor((-m.m41 + w / 2) / tile);
      if (i !== last) {
        if (last !== -1) sfx.tick();
        last = i;
      }
      if (nowMs() - t0 < ms + 100) raf = requestAnimationFrame(watch);
    };
    raf = requestAnimationFrame(watch);

    setTimeout(async () => {
      cancelAnimationFrame(raf);
      setLanded(idx);
      setHistory((h) => [res.color, ...h].slice(0, 30));
      if (res.won && res.color === "gold") celebrate({ title: "Zlatna 14×!", subtitle: "Rulet", amount: Number(res.payout), tier: 3 });
      else if (res.won) {
        sfx.win(1);
        toast(`${STYLE[res.color].label}! Dobitak ${coins(res.payout)}`, "success");
      } else {
        sfx.lose();
        toast(`Pala je ${STYLE[res.color].label.toLowerCase()}.`, "error");
      }
      await refresh();
      setBusy(false);
    }, ms + 150);
  };

  const counts = history.reduce((a, c) => ({ ...a, [c]: a[c] + 1 }), { red: 0, black: 0, gold: 0 } as Record<Color, number>);
  const lastColor = landed != null ? colorOf(strip[landed]) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="h1">Rulet</h1>
        <p className="text-sm text-muted">Crvena i crna 2×, zlatna 14× · 30 polja (14 crvenih, 14 crnih, 2 zlatna)</p>
      </div>

      {/* KOTAČ */}
      <div
        ref={box}
        className="card relative h-48 overflow-hidden p-0 sm:h-60"
        style={{ boxShadow: lastColor ? `0 0 70px -18px ${STYLE[lastColor].glow}` : undefined, borderColor: lastColor ? `${STYLE[lastColor].glow}88` : undefined, transition: "box-shadow .4s, border-color .4s" }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_50%,#ffffff0c,transparent_70%)]" />
        <div ref={track} className="flex h-full items-center will-change-transform" style={{ transform: `translateX(${-offset}px)`, transition: tr }}>
          {strip.map((s, i) => {
            const c = colorOf(s);
            const win = landed === i;
            return (
              <div key={i} className="shrink-0 px-1" style={{ width: tile }}>
                <div
                  className={`relative grid h-32 place-items-center overflow-hidden rounded-2xl font-display text-2xl font-black transition duration-500 sm:h-44 sm:text-3xl ${STYLE[c].tile} ${c === "gold" ? "text-amber-900" : "text-white/85"} ${landed != null && !win ? "opacity-35" : ""} ${win ? "rl-win" : ""}`}
                  style={{ boxShadow: `inset 0 2px 0 #ffffff40, inset 0 -6px 12px #00000055${win ? `, 0 0 40px ${STYLE[c].glow}` : ""}` }}
                >
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(180deg,#ffffff26,transparent)]" />
                  {c === "gold" ? <span className="rl-star relative">★</span> : <span className="relative">{s}</span>}
                </div>
              </div>
            );
          })}
        </div>
        {/* pokazivač */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_14px_#fff]" />
        <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-0 w-0 -translate-x-1/2 border-x-[11px] border-t-[14px] border-x-transparent border-t-white drop-shadow-[0_0_8px_#fff]" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 h-0 w-0 -translate-x-1/2 border-x-[11px] border-b-[14px] border-x-transparent border-b-white drop-shadow-[0_0_8px_#fff]" />
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(90deg,var(--color-ink),transparent_16%,transparent_84%,var(--color-ink))]" />
      </div>

      {/* povijest + statistika */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
          {history.map((c, i) => (
            <span key={history.length - i} className={`drop-in h-7 w-7 shrink-0 rounded-lg ${STYLE[c].chip} ${i === 0 ? "ring-2 ring-white/70" : ""}`} />
          ))}
          {history.length === 0 && <span className="text-sm text-muted">Još nema vrtnji.</span>}
        </div>
        {history.length > 0 && (
          <div className="flex gap-3 text-sm font-semibold tabular-nums">
            {(["red", "black", "gold"] as Color[]).map((c) => (
              <span key={c} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${STYLE[c].chip}`} />{counts[c]}</span>
            ))}
          </div>
        )}
      </div>

      {/* ULOG */}
      <div className="card grid gap-4 p-4 md:grid-cols-[minmax(0,320px)_1fr] md:items-end">
        <BetInput value={bet} onChange={setBet} disabled={busy} min={limits.rulet_min_bet ?? 0.1} max={limits.rulet_max_bet ?? 10000} />
        <div className="grid grid-cols-3 gap-2">
          {(["red", "gold", "black"] as Color[]).map((c) => (
            <button
              key={c}
              disabled={busy || bet <= 0}
              onClick={() => play(c)}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-b px-3 py-3 text-left transition hover:-translate-y-0.5 hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${STYLE[c].btn} ${pick === c && busy ? "ring-2 ring-white" : ""}`}
              style={{ boxShadow: `0 10px 30px -12px ${STYLE[c].glow}` }}
            >
              <div className={`font-display text-lg font-black leading-none sm:text-xl ${c === "gold" ? "text-amber-950" : "text-white"}`}>{STYLE[c].label}</div>
              <div className={`mt-1 text-xs font-bold tabular-nums ${c === "gold" ? "text-amber-900" : "text-white/75"}`}>
                {STYLE[c].mult}× · +{coins(bet * STYLE[c].mult)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
