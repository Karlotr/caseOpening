"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { coins, errMsg } from "@/lib/format";
import { sfx } from "@/lib/sound";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { BetInput } from "@/components/BetInput";
import { RequireAuth } from "@/components/RequireAuth";
import { useCelebrate } from "@/components/WinOverlay";

// Crossroad: prijeđi autocestu traku po traku. Svaka traka diže multiplikator, a svaki korak je rizik.
// Ishod svakog koraka odlučuje server (crossroad_* u SQL-u).
type Diff = "easy" | "medium" | "hard" | "hardcore";
type Game = { id: number; bet: number; difficulty: Diff; lane: number; status: "active" | "cashed" | "crashed"; payout: number; lanes: number; mult: number; next_mult: number };
type Table = { p: string; lanes: number; mults: number[] };
type Hist = { difficulty: Diff; lane: number; status: "cashed" | "crashed"; bet: number; payout: number };
type State = { game: Game | null; min_bet: number; max_bet: number; tables: Record<Diff, Table>; history: Hist[] };
// prikaz na cesti (ostaje i nakon kraja igre dok ne kreneš novu)
type View = { difficulty: Diff; lane: number; status: "idle" | "active" | "cashed" | "crashed"; bet: number; hitLane?: number };

const DIFFS: { k: Diff; l: string; c: string }[] = [
  { k: "easy", l: "Lako", c: "#34d399" },
  { k: "medium", l: "Srednje", c: "#5ce1ff" },
  { k: "hard", l: "Teško", c: "#ffb547" },
  { k: "hardcore", l: "Hardcore", c: "#ff2b4e" },
];
const TRAFFIC = ["#ff2b4e", "#5ce1ff", "#ffb547", "#a78bfa", "#f472b6", "#e2e8f0", "#34d399", "#fb923c"];
const CURB = 92;
const fmtM = (m: number) => `${Number(m).toFixed(2)}×`;
// stabilni "nasumični" brojevi po traci (promet izgleda isto pri svakom renderu)
const rnd = (i: number, s: number) => {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export default function CrossroadPage() {
  return (
    <RequireAuth what="igrati Crossroad">
      <Crossroad />
    </RequireAuth>
  );
}

function Crossroad() {
  const { refresh } = useAuth();
  const toast = useToast();
  const celebrate = useCelebrate();
  const [st, setSt] = useState<State | null>(null);
  const [bet, setBet] = useState(1);
  const [diff, setDiff] = useState<Diff>("medium");
  const [view, setView] = useState<View>({ difficulty: "medium", lane: 0, status: "idle", bet: 1 });
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false); // auto kreće u sljedeću traku odmah na klik (ne čeka server)
  const [shake, setShake] = useState(0);
  const [boost, setBoost] = useState<{ key: number; lane: number; text: string } | null>(null); // efekt prijeđene trake
  const road = useRef<HTMLDivElement>(null);
  const [roadW, setRoadW] = useState(800);
  const [laneW, setLaneW] = useState(100);

  const parse = (d: unknown): State => {
    const s = d as State;
    if (s.game) s.game = { ...s.game, bet: Number(s.game.bet), mult: Number(s.game.mult), next_mult: Number(s.game.next_mult), payout: Number(s.game.payout) };
    for (const k of Object.keys(s.tables) as Diff[]) s.tables[k].mults = s.tables[k].mults.map(Number);
    s.history = s.history.map((h) => ({ ...h, bet: Number(h.bet), payout: Number(h.payout) }));
    return s;
  };

  useEffect(() => {
    createClient()
      .rpc("crossroad_state")
      .then(({ data, error }) => {
        if (error || !data) return;
        const s = parse(data);
        setSt(s);
        // nastavi nedovršenu igru
        if (s.game) {
          setDiff(s.game.difficulty);
          setBet(s.game.bet);
          setView({ difficulty: s.game.difficulty, lane: s.game.lane, status: "active", bet: s.game.bet });
        }
      });
  }, []);

  useLayoutEffect(() => {
    const el = road.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setRoadW(el.clientWidth);
      setLaneW(el.clientWidth < 520 ? 84 : 100);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [st]);

  const active = view.status === "active";
  const table = st?.tables[active ? view.difficulty : diff];
  const lanes = table?.lanes ?? 20;
  const mults = table?.mults ?? [];
  const curMult = view.lane > 0 ? mults[view.lane - 1] ?? 1 : 1;
  const nextMult = mults[view.lane] ?? curMult;

  const start = async () => {
    if (busy) return;
    setBusy(true);
    const { data, error } = await createClient().rpc("crossroad_start", { p_bet: bet, p_difficulty: diff });
    setBusy(false);
    if (error) return toast(errMsg(error), "error");
    setSt(parse(data));
    setView({ difficulty: diff, lane: 0, status: "active", bet });
    sfx.light();
    refresh();
  };

  const step = useCallback(async () => {
    if (busy || view.status !== "active") return;
    setBusy(true);
    setMoving(true);
    const { data, error } = await createClient().rpc("crossroad_step");
    if (error) {
      setMoving(false);
      setBusy(false);
      return toast(errMsg(error), "error");
    }
    const d = data as { ok: boolean; result: Game };
    const s = parse(data);
    const r = { ...d.result, bet: Number(d.result.bet), payout: Number(d.result.payout), mult: Number(d.result.mult) };
    if (d.ok) {
      sfx.tick();
      sfx.coin();
      setBoost({ key: Date.now(), lane: r.lane, text: `${fmtM(r.mult)}` });
      setView((v) => ({ ...v, lane: r.lane, status: r.status === "cashed" ? "cashed" : "active" }));
      setMoving(false);
      setSt(s);
      if (r.status === "cashed") {
        setTimeout(() => celebrate({ title: fmtM(r.mult), subtitle: "Prešao si cijelu autocestu!", amount: r.payout, tier: 3 }), 400);
        refresh();
      }
      setBusy(false);
    } else {
      // auto je već krenuo u traku — kamion ga odmah pokupi
      setView((v) => ({ ...v, lane: v.lane + 1, status: "active", hitLane: v.lane + 1 }));
      setMoving(false);
      setTimeout(() => {
        setView((v) => ({ ...v, status: "crashed" }));
        setShake((x) => x + 1);
        sfx.lose();
        toast(`Udarac na traci ${r.lane + 1}! Izgubio si ${coins(r.bet)}.`, "error");
        setSt(s);
        setBusy(false);
        refresh();
      }, 200);
    }
  }, [busy, view.status, toast, celebrate, refresh]);

  const cashout = async () => {
    if (busy || view.status !== "active" || view.lane < 1) return;
    setBusy(true);
    const { data, error } = await createClient().rpc("crossroad_cashout");
    setBusy(false);
    if (error) return toast(errMsg(error), "error");
    const d = data as { result: Game };
    const pay = Number(d.result.payout);
    const m = Number(d.result.mult);
    setSt(parse(data));
    setView((v) => ({ ...v, status: "cashed" }));
    if (m >= 10) celebrate({ title: fmtM(m), subtitle: `Izašao na traci ${view.lane}`, amount: pay, tier: m >= 100 ? 3 : 2 });
    else {
      sfx.win(m >= 3 ? 2 : 1);
      toast(`Cashout ${fmtM(m)} · +${coins(pay)}`, "success");
    }
    refresh();
  };

  // tipkovnica: razmak / → = naprijed
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "ArrowRight") && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        step();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  if (!st) return <div className="card h-[520px] animate-pulse" />;

  const total = CURB * 2 + lanes * laneW;
  // auto drži na ~35% širine ceste
  const carLane = view.lane + (moving ? 1 : 0);
  const carX = carLane === 0 ? CURB / 2 : CURB + (carLane - 0.5) * laneW;
  const offset = Math.max(0, Math.min(total - roadW, carX - roadW * 0.35));
  const crashed = view.status === "crashed";
  const won = view.status === "cashed";
  const shownMult = crashed ? 0 : curMult;
  const dcol = DIFFS.find((d) => d.k === (active ? view.difficulty : diff))!.c;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Crossroad</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">Prijeđi autocestu traku po traku. Svaka traka diže multiplikator, a promet postaje sve opasniji. Izađi kad hoćeš, ili riskiraj do kraja.</p>
      </div>

      {st.history.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {st.history.map((h, i) => (
            <span key={i} className={`shrink-0 rounded-md px-2 py-1 font-display text-xs font-bold tabular-nums ${h.status === "cashed" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/10 text-red-300/80"}`}>
              {h.status === "cashed" ? fmtM(h.payout / h.bet) : `✕ ${h.lane + 1}`}
            </span>
          ))}
        </div>
      )}

      {/* CESTA */}
      <div
        key={`r${shake}`}
        ref={road}
        className={`card relative h-[260px] overflow-hidden p-0 sm:h-[320px] ${crashed ? "crash-shake" : ""}`}
        style={{ borderColor: crashed ? "#ff3b5c66" : won ? "#34d39966" : undefined, boxShadow: crashed ? "0 0 60px -20px #ff3b5c" : won ? "0 0 60px -20px #34d399" : undefined }}
      >
        <div className="absolute inset-y-0 left-0 flex transition-transform duration-500 ease-out" style={{ width: total, transform: `translateX(${-offset}px)` }}>
          {/* početni pločnik */}
          <div className="relative h-full shrink-0 bg-[repeating-linear-gradient(0deg,#2a2b3d_0_22px,#24253a_22px_44px)]" style={{ width: CURB }}>
            <span className="absolute inset-x-3 bottom-3 text-center text-[11px] font-bold uppercase tracking-widest text-muted">Start</span>
          </div>
          {Array.from({ length: lanes }, (_, i) => {
            const n = i + 1;
            const passed = n <= view.lane && !(crashed && n === view.hitLane);
            const isHit = crashed && n === view.hitLane;
            const ahead = n > view.lane;
            const dur = 1.1 + rnd(n, 1) * 1.6;
            const delay = -rnd(n, 2) * 3;
            const tc = TRAFFIC[Math.floor(rnd(n, 3) * TRAFFIC.length)];
            const up = rnd(n, 4) > 0.5;
            return (
              <div key={n} className={`cr-lane relative h-full shrink-0 overflow-hidden ${passed ? "cr-lane-safe" : ""}`} style={{ width: laneW }}>
                {/* ulična svjetla */}
                <span className="cr-lamp top-1" />
                <span className="cr-lamp bottom-1" />
                {/* bljesak kad je traka upravo prijeđena */}
                {boost && boost.lane === n && <span key={boost.key} className="cr-sweep" />}
                {/* promet (samo ispred tebe) */}
                {ahead && !crashed && n <= view.lane + 7 && (
                  <span className={`cr-traffic ${up ? "cr-up" : ""}`} style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s`, ["--tc" as string]: tc }}>
                    <TopCar color={tc} />
                  </span>
                )}
                {isHit && (
                  <span className="cr-truck">
                    <TopCar color="#ff3b5c" truck />
                  </span>
                )}
                {/* rampa na prijeđenim trakama */}
                {passed && <span className="absolute inset-x-2 top-3 h-2 rounded-full bg-[repeating-linear-gradient(90deg,#ffb547_0_10px,#1b1b28_10px_20px)] opacity-80" />}
                {/* multiplikator */}
                <div className="absolute inset-x-0 top-1/2 grid -translate-y-1/2 place-items-center">
                  <span
                    className={`grid h-14 w-14 place-items-center rounded-full border-2 font-display text-[13px] font-extrabold tabular-nums transition sm:h-16 sm:w-16 sm:text-sm ${
                      isHit
                        ? "border-red-500 bg-red-500/25 text-red-200"
                        : passed
                          ? `border-emerald-400/70 bg-emerald-500/15 text-emerald-200 ${boost && boost.lane === n ? "cr-pop" : ""}`
                          : n === view.lane + 1 && active
                            ? "cr-next scale-110 border-amber-300 bg-amber-300/15 text-amber-100"
                            : "border-white/15 bg-black/30 text-white/60"
                    }`}
                  >
                    {fmtM(mults[i] ?? 1)}
                  </span>
                  {boost && boost.lane === n && (
                    <span key={`c${boost.key}`} className="pointer-events-none absolute inset-0">
                      {Array.from({ length: 8 }, (_, k) => {
                        const a = (k / 8) * Math.PI * 2;
                        return <span key={k} className="cr-coin coin" style={{ ["--cx" as string]: `${Math.cos(a) * 46}px`, ["--cy" as string]: `${Math.sin(a) * 46}px` }} />;
                      })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {/* cilj */}
          <div className="relative h-full shrink-0 bg-[repeating-conic-gradient(#e5e7eb_0_25%,#111827_0_50%)] bg-[length:22px_22px] opacity-90" style={{ width: CURB }}>
            <span className="absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-md bg-black/80 py-1 text-center font-display text-xs font-black uppercase tracking-widest text-amber-300">Cilj</span>
          </div>

          {/* tvoj auto */}
          <div className="absolute left-0 top-1/2 z-20 transition-transform duration-300 ease-out will-change-transform" style={{ transform: `translateX(${carX - 29}px)`, marginTop: 40 }}>
            <div className={crashed ? "cr-hit" : ""}>
            {!crashed && view.status !== "idle" && <span className="cr-headlights" />}
            <TopCar color={crashed ? "#64748b" : "#ffffff"} me />
            {boost && !crashed && (
              <span key={`t${boost.key}`} className="cr-float pointer-events-none absolute -top-9 left-1/2 whitespace-nowrap font-display text-lg font-black tabular-nums text-emerald-300">
                {boost.text}
              </span>
            )}
            </div>
          </div>
        </div>

        {/* gornji info */}
        <div className="pointer-events-none absolute left-3 top-3 z-30 flex items-center gap-2">
          <span className="rounded-lg bg-black/60 px-2.5 py-1 font-display text-sm font-bold " style={{ color: dcol }}>
            {DIFFS.find((d) => d.k === (active ? view.difficulty : diff))!.l}
          </span>
          {view.status !== "idle" && (
            <span className="rounded-lg bg-black/60 px-2.5 py-1 font-display text-sm font-bold tabular-nums ">
              Traka {Math.min(view.lane, lanes)}/{lanes}
            </span>
          )}
        </div>
        {active && view.lane > 0 && (
          <div key={`m${view.lane}`} className="cr-pop pointer-events-none absolute right-3 top-3 z-30 rounded-xl bg-black/60 px-3 py-1.5 text-right font-display tabular-nums ">
            <div className="text-2xl font-black leading-none text-emerald-300">{fmtM(curMult)}</div>
            <div className="text-xs font-bold text-white/80">+{coins(view.bet * curMult)}</div>
          </div>
        )}
        {/* napredak */}
        {view.status !== "idle" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-1.5 bg-black/40">
            <div className={`h-full transition-[width] duration-300 ${crashed ? "bg-red-500" : "bg-[linear-gradient(90deg,#34d399,#facc15)]"}`} style={{ width: `${(Math.min(view.lane, lanes) / lanes) * 100}%` }} />
          </div>
        )}
        {(crashed || won) && (
          <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
            <div className={`pop rounded-2xl px-6 py-3 text-center ${crashed ? "bg-red-950/70 ring-1 ring-red-500/50" : "bg-emerald-950/70 ring-1 ring-emerald-400/50"}`}>
              <div className={`font-display text-3xl font-black uppercase tracking-widest ${crashed ? "text-red-400" : "text-emerald-300"}`}>{crashed ? "Bum!" : "Isplaćeno"}</div>
              <div className="font-display text-lg font-bold tabular-nums">{crashed ? `−${coins(view.bet)}` : `+${coins(view.bet * curMult)} · ${fmtM(curMult)}`}</div>
            </div>
          </div>
        )}
      </div>

      {/* KONTROLE */}
      <div className="card grid gap-4 p-4 lg:grid-cols-[1fr_1.2fr_1fr] lg:items-end">
        <BetInput value={bet} onChange={setBet} disabled={busy || active} min={Number(st.min_bet)} max={Number(st.max_bet)} />
        <div>
          <span className="label">Težina</span>
          <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-line" role="radiogroup" aria-label="Težina">
            {DIFFS.map((d) => {
              const t = st.tables[d.k];
              const on = (active ? view.difficulty : diff) === d.k;
              return (
                <button
                  key={d.k}
                  role="radio"
                  aria-checked={on}
                  disabled={active || busy}
                  onClick={() => setDiff(d.k)}
                  className={`px-1 py-2 text-center transition disabled:cursor-not-allowed ${on ? "text-ink" : "bg-panel hover:bg-panel2"}`}
                  style={on ? { background: d.c } : undefined}
                >
                  <span className="block font-display text-sm font-bold leading-tight">{d.l}</span>
                  <span className={`block text-[11px] tabular-nums ${on ? "text-ink/70" : "text-muted"}`}>do {fmtM(t.mults[t.mults.length - 1])}</span>
                </button>
              );
            })}
          </div>
        </div>
        {active ? (
          <div className="grid grid-cols-2 gap-2">
            <button className={`btn-ghost h-14 flex-col gap-0 text-base ${view.lane >= 1 ? "cr-cash border-emerald-400/60" : ""}`} disabled={busy || view.lane < 1} onClick={cashout}>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Cashout</span>
              <span className="font-display font-black tabular-nums text-emerald-300">{view.lane < 1 ? "—" : `+${coins(view.bet * curMult)}`}</span>
            </button>
            <button className="btn-primary h-14 flex-col gap-0 text-base" disabled={busy} onClick={step}>
              <span className="text-xs font-semibold uppercase tracking-wide">Naprijed →</span>
              <span className="font-display font-black tabular-nums">{fmtM(nextMult)}</span>
            </button>
          </div>
        ) : (
          <button className="btn-primary h-14 text-lg" disabled={busy || bet < Number(st.min_bet) || bet > Number(st.max_bet)} onClick={start}>
            {crashed || won ? "Nova vožnja" : "Kreni"} · {coins(bet)}
          </button>
        )}
      </div>
      <p className="text-xs text-muted">
        {active
          ? `Trenutno ${fmtM(shownMult)} · sljedeća traka ${fmtM(nextMult)} · šansa da prođeš traku ${Math.round(Number(table?.p ?? 0) * 100)}%. Razmak ili → za naprijed.`
          : `Šansa po traci: Lako 90%, Srednje 80%, Teško 65%, Hardcore 45%. Na zadnjoj traci isplata ide sama.`}
      </p>
    </div>
  );
}

// auto odozgo (gleda udesno za igrača, dolje/gore za promet)
function TopCar({ color, me = false, truck = false }: { color: string; me?: boolean; truck?: boolean }) {
  if (me)
    return (
      <svg width="58" height="34" viewBox="0 0 44 26" className="drop-shadow-[0_0_14px_rgba(255,255,255,.45)]" aria-label="Tvoj auto">
        <rect x="1" y="2" width="42" height="22" rx="7" fill={color} />
        <rect x="24" y="5" width="9" height="16" rx="3" fill="#0b0b18" opacity=".85" />
        <rect x="8" y="5" width="7" height="16" rx="3" fill="#0b0b18" opacity=".6" />
        <rect x="39" y="4" width="4" height="5" rx="1.5" fill="#fff7c2" />
        <rect x="39" y="17" width="4" height="5" rx="1.5" fill="#fff7c2" />
        <rect x="1" y="4" width="2.5" height="5" rx="1" fill="#ff2b4e" />
        <rect x="1" y="17" width="2.5" height="5" rx="1" fill="#ff2b4e" />
      </svg>
    );
  const h = truck ? 92 : 54;
  return (
    <svg width="34" height={h} viewBox={`0 0 34 ${h}`} aria-hidden>
      <rect x="2" y="1" width="30" height={h - 2} rx="7" fill={color} />
      <rect x="6" y={h - 22} width="22" height="11" rx="3" fill="#0b0b18" opacity=".85" />
      {truck ? <rect x="5" y="6" width="24" height={h - 34} rx="2" fill="#0b0b18" opacity=".25" /> : <rect x="6" y="8" width="22" height="8" rx="3" fill="#0b0b18" opacity=".55" />}
      <rect x="4" y={h - 6} width="7" height="3" rx="1" fill="#fff7c2" />
      <rect x="23" y={h - 6} width="7" height="3" rx="1" fill="#fff7c2" />
    </svg>
  );
}
