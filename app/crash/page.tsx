"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { coins, errMsg } from "@/lib/format";
import { sfx } from "@/lib/sound";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { BetInput } from "@/components/BetInput";
import { NumberField } from "@/components/NumberField";
import { useCelebrate } from "@/components/WinOverlay";

// Multiplayer Crash (kao jackpot): runde se vrte jedna za drugom za sve igrače.
// Klađenje → let (m = e^(k·t)) → crash. Izlaziš sam (ili auto cashout). Sve odlučuje server (crash_* u SQL-u).
type Bet = { user_id: string; username: string; level: number; amount: number; cashout: number | null; payout: number; auto_cashout?: number | null };
type Phase = "betting" | "flying" | "crashed";
type State = {
  id: number;
  now: string;
  starts_at: string;
  phase: Phase;
  k: number;
  bet_sec: number;
  min_bet: number;
  max_bet: number;
  crash_point: number | null;
  bets: Bet[];
  history: number[];
};

const DISPLAY_LAG = 0.35; // s — prikaz kasni za serverom da ne "pretekne" crash
const CATCH_UP_MS = 160; // dovršetak krivulje do crash točke
const W = 800;
const H = 380;
const PAD = { l: 52, r: 28, t: 28, b: 34 };
const fmtM = (m: number) => `${m.toFixed(2)}×`;
const histCls = (m: number) => (m >= 10 ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40" : m >= 2 ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/10 text-red-300/80");

export default function CrashPage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const celebrate = useCelebrate();
  const [st, setSt] = useState<State | null>(null);
  const [skew, setSkew] = useState(0);
  const [clock, setClock] = useState(0); // lokalno vrijeme za animaciju
  const [bet, setBet] = useState(1);
  const [autoOn, setAutoOn] = useState(false); // auto cashout isključen po defaultu
  const [auto, setAuto] = useState(2);
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(false); // ulog za sljedeću rundu
  const [boom, setBoom] = useState(0);
  const lastPhase = useRef<{ id: number; phase: Phase } | null>(null);
  // kad stigne vijest o crashu: gdje je prikaz tada bio (za glatki dovršetak krivulje)
  const [crashSeen, setCrashSeen] = useState<{ id: number; at: number; from: number } | null>(null);
  const stRef = useRef<State | null>(null);

  const skewRef = useRef<number | null>(null);
  const load = useCallback(async () => {
    const t0 = Date.now();
    const { data, error } = await createClient().rpc("crash_state");
    const t1 = Date.now();
    if (error || !data) return;
    const s = data as State;
    s.bets = s.bets.map((b) => ({ ...b, amount: Number(b.amount), payout: Number(b.payout), cashout: b.cashout == null ? null : Number(b.cashout) }));
    s.history = s.history.map(Number);
    s.crash_point = s.crash_point == null ? null : Number(s.crash_point);
    // razlika sata server–klijent: mjereno na sredini zahtjeva i izglađeno, inače svaki odgovor
    // (s drukčijim kašnjenjem mreže) pomakne sat pa multiplikator i odbrojavanje "trzaju"
    const est = new Date(s.now).getTime() - (t0 + t1) / 2;
    const prevSk = skewRef.current;
    const sk = prevSk == null || Math.abs(est - prevSk) > 400 ? est : prevSk + (est - prevSk) * 0.08;
    skewRef.current = sk;
    const prev = stRef.current;
    if (s.phase === "crashed" && s.crash_point && (!prev || prev.id !== s.id || prev.phase !== "crashed")) {
      // gdje je prikaz bio kad je stigla vijest o crashu (prikaz kasni DISPLAY_LAG za serverom)
      const shownT = (Date.now() + sk - new Date(s.starts_at).getTime()) / 1000 - DISPLAY_LAG;
      const tc = Math.log(s.crash_point) / (Number(s.k) || 0.32);
      setCrashSeen(prev && prev.id === s.id ? { id: s.id, at: Date.now(), from: Math.max(0, Math.min(shownT, tc)) } : null);
    }
    setSkew(sk);
    setSt(s);
    stRef.current = s;
  }, []);

  // poll: brže dok leti (da se vide tuđi cashouti i crash)
  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const loop = async () => {
      await load();
      if (!alive) return;
      const ph = stRef.current?.phase;
      t = setTimeout(loop, ph === "flying" ? 220 : 900);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [load]);

  // animacijski sat
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setClock(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const me = st?.bets.find((b) => b.user_id === user?.id);

  // prijelazi faza: zvuk crasha, poraz, novi ulog iz reda
  useEffect(() => {
    if (!st) return;
    const prev = lastPhase.current;
    lastPhase.current = { id: st.id, phase: st.phase };
    if (!prev) return;
    if (prev.id === st.id && prev.phase !== "crashed" && st.phase === "crashed") {
      setBoom((b) => b + 1);
      sfx.lose();
      if (me && me.cashout == null) toast(`Crash na ${fmtM(st.crash_point ?? 1)} — izgubio si ${coins(me.amount)}.`, "error");
      refresh();
    }
    if (st.phase === "betting" && prev.id !== st.id) sfx.light();
  }, [st, me, toast, refresh]);

  // auto cashout obavijest (server ga je odradio)
  const seenCash = useRef<number | null>(null);
  useEffect(() => {
    if (!st || !me || me.cashout == null || seenCash.current === st.id) return;
    seenCash.current = st.id;
    if (me.auto_cashout != null && me.cashout === me.auto_cashout) {
      sfx.win(me.cashout >= 10 ? 3 : me.cashout >= 3 ? 2 : 1);
      toast(`Auto cashout na ${fmtM(me.cashout)} · +${coins(me.payout)}`, "success");
      refresh();
    }
  }, [st, me, toast, refresh]);

  const place = useCallback(async () => {
    setBusy(true);
    const { error } = await createClient().rpc("crash_bet", { p_amount: bet, p_auto: autoOn ? auto : null });
    setBusy(false);
    if (error) return toast(errMsg(error), "error");
    sfx.coin();
    refresh();
    load();
  }, [bet, autoOn, auto, toast, refresh, load]);

  // ulog u redu: uloži čim krene klađenje nove runde
  useEffect(() => {
    if (!queued || !st || st.phase !== "betting" || me) return;
    setQueued(false);
    place();
  }, [queued, st, me, place]);

  const withdraw = async () => {
    setBusy(true);
    const { error } = await createClient().rpc("crash_withdraw");
    setBusy(false);
    if (error) return toast(errMsg(error), "error");
    refresh();
    load();
  };

  const cashout = async () => {
    setBusy(true);
    const { data, error } = await createClient().rpc("crash_cashout");
    setBusy(false);
    if (error) {
      toast(errMsg(error), "error");
      return load();
    }
    const r = data as { my_cashout: number; my_payout: number };
    seenCash.current = st?.id ?? null;
    const m = Number(r.my_cashout);
    const pay = Number(r.my_payout);
    if (m >= 5) celebrate({ title: fmtM(m), subtitle: "Izašao si na vrijeme!", amount: pay, tier: m >= 20 ? 3 : 2 });
    else {
      sfx.win(m >= 2 ? 2 : 1);
      toast(`Izašao si na ${fmtM(m)} · +${coins(pay)}`, "success");
    }
    refresh();
    load();
  };

  if (!st || !clock) return <div className="card h-[520px] animate-pulse" />;

  // ---- vrijeme i multiplikator ----
  const k = Number(st.k) || 0.32;
  const serverNow = clock + skew;
  const startMs = new Date(st.starts_at).getTime();
  // Prikaz namjerno kasni DISPLAY_LAG iza servera: vijest o crashu stigne prije nego što prikaz prođe crash točku,
  // pa se nikad ne vidi npr. 1,15× kad je crash bio na 1,00×. Kad crash stigne, krivulja se glatko dovrši do točke.
  const serverCrashed = st.phase === "crashed";
  const tRaw = (serverNow - startMs) / 1000 - DISPLAY_LAG;
  const tCrash = serverCrashed && st.crash_point ? Math.log(st.crash_point) / k : null;
  const seen = serverCrashed && crashSeen?.id === st.id ? crashSeen : null;
  const catchUp = seen ? Math.min(1, (clock - seen.at) / CATCH_UP_MS) : 1;
  const crashed = serverCrashed && catchUp >= 1;
  const flying = !crashed && (serverCrashed || tRaw >= 0);
  const t = serverCrashed && tCrash != null ? (seen ? seen.from + (tCrash - seen.from) * (1 - (1 - catchUp) ** 2) : tCrash) : Math.max(0, tRaw);
  const mult = crashed ? st.crash_point ?? 1 : flying ? Math.exp(k * t) : 1;
  const betLeft = Math.max(0, startMs - serverNow);
  const betSec = Number(st.bet_sec) || 8;

  // ---- graf ----
  const maxT = Math.max(6, t * 1.18);
  const maxM = Math.max(2, mult * 1.3);
  const x = (s: number) => PAD.l + (s / maxT) * (W - PAD.l - PAD.r);
  const y = (m: number) => H - PAD.b - ((m - 1) / (maxM - 1)) * (H - PAD.t - PAD.b);
  const N = 80;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const s = (t * i) / N;
    pts.push(`${x(s).toFixed(1)},${y(Math.exp(k * s)).toFixed(1)}`);
  }
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${x(t).toFixed(1)},${y(1)} L${x(0)},${y(1)} Z`;
  const tipX = x(t);
  const tipY = y(mult);
  const col = crashed ? "#ff3b5c" : mult >= 10 ? "#facc15" : mult >= 2 ? "#34d399" : "#5ce1ff";
  const yStep = maxM <= 3 ? 0.5 : maxM <= 6 ? 1 : maxM <= 15 ? 2 : maxM <= 40 ? 5 : maxM <= 120 ? 20 : maxM <= 400 ? 50 : 200;
  const yTicks: number[] = [];
  for (let v = 1; v <= maxM; v += yStep) yTicks.push(Number(v.toFixed(2)));
  const xStep = maxT <= 12 ? 2 : maxT <= 30 ? 5 : 10;
  const xTicks: number[] = [];
  for (let v = 0; v <= maxT; v += xStep) xTicks.push(v);
  // kut vrha krivulje (za "raketu")
  const dt = Math.max(0.05, t * 0.02);
  const ang = (Math.atan2(y(Math.exp(k * t)) - y(Math.exp(k * Math.max(0, t - dt))), x(t) - x(Math.max(0, t - dt))) * 180) / Math.PI;

  const cashed = st.bets.filter((b) => b.cashout != null);
  const pot = st.bets.reduce((s, b) => s + b.amount, 0);
  const canBet = !!user && st.phase === "betting" && betLeft > 400 && !me;
  const myLive = me && me.cashout == null && flying;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Crash</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Svi igraju istu rundu. Uloži dok traje odbrojavanje, pa izađi prije nego što crasha — dobivaš ulog × multiplikator na kojem si izašao. Auto cashout je opcionalan.
        </p>
      </div>

      {/* povijest */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {st.history.map((m, i) => (
          <span key={i} className={`shrink-0 rounded-md px-2 py-1 font-display text-xs font-bold tabular-nums ${histCls(m)}`}>{fmtM(m)}</span>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* GRAF */}
        <div
          key={crashed ? `boom-${boom}` : "fly"}
          className={`card relative overflow-hidden ${crashed ? "crash-shake" : ""}`}
          style={{ borderColor: `${col}55`, boxShadow: `0 0 70px -24px ${col}` }}
        >
          <div className="crash-stars pointer-events-none absolute inset-0" style={{ animationPlayState: flying ? "running" : "paused" }} />
          <svg viewBox={`0 0 ${W} ${H}`} className="relative block h-[280px] w-full sm:h-[400px]" preserveAspectRatio="none">
            <defs>
              <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={col} stopOpacity="0.4" />
                <stop offset="100%" stopColor={col} stopOpacity="0" />
              </linearGradient>
              <filter id="cg" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {yTicks.map((v) => (
              <g key={`y${v}`}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#ffffff0f" />
                <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#ffffff55">{v}×</text>
              </g>
            ))}
            {xTicks.map((v) => (
              <text key={`x${v}`} x={x(v)} y={H - 10} textAnchor="middle" fontSize="12" fill="#ffffff40">{v}s</text>
            ))}
            {me?.auto_cashout != null && me.cashout == null && me.auto_cashout <= maxM && (
              <g>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(me.auto_cashout)} y2={y(me.auto_cashout)} stroke="#34d399" strokeOpacity="0.55" strokeDasharray="6 6" />
                <text x={W - PAD.r} y={y(me.auto_cashout) - 6} textAnchor="end" fontSize="12" fontWeight="700" fill="#34d399">Auto {fmtM(me.auto_cashout)}</text>
              </g>
            )}
            {(flying || crashed) && (
              <>
                <path d={area} fill="url(#cf)" />
                <path d={line} fill="none" stroke={col} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#cg)" vectorEffect="non-scaling-stroke" />
                {/* tko je gdje izašao */}
                {cashed.map((b) => {
                  const ct = Math.log(b.cashout!) / k;
                  if (ct > t) return null;
                  const mine = b.user_id === user?.id;
                  return (
                    <g key={b.user_id}>
                      <circle cx={x(ct)} cy={y(b.cashout!)} r={mine ? 6 : 4.5} fill={mine ? "#facc15" : "#34d399"} stroke="#0b0b18" strokeWidth="2" />
                      <text x={x(ct) - 8} y={y(b.cashout!) - 9} textAnchor="end" fontSize="11" fontWeight="700" fill={mine ? "#facc15" : "#a7f3d0"}>
                        {b.username} {fmtM(b.cashout!)}
                      </text>
                    </g>
                  );
                })}
                {crashed ? (
                  <g>
                    <circle cx={tipX} cy={tipY} r="16" fill="#ff3b5c55" className="crash-boom" />
                    <circle cx={tipX} cy={tipY} r="7" fill="#ff3b5c" />
                  </g>
                ) : (
                  <g transform={`translate(${tipX} ${tipY}) rotate(${ang})`}>
                    <circle r="14" fill={col} opacity="0.25" />
                    {/* mali auto koji "leti" po krivulji */}
                    <g filter="url(#cg)">
                      <path d="M-14 3 L-11 -4 L-3 -7 L7 -7 L13 -2 L15 3 Z" fill="#fff" />
                      <circle cx="-8" cy="4" r="2.6" fill="#0b0b18" stroke="#fff" strokeWidth="1.2" />
                      <circle cx="9" cy="4" r="2.6" fill="#0b0b18" stroke="#fff" strokeWidth="1.2" />
                    </g>
                    <path d="M-15 0 L-34 -3 L-34 3 Z" fill={col} opacity="0.8" className="crash-flame" />
                  </g>
                )}
              </>
            )}
          </svg>

          {/* veliki broj / odbrojavanje */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center">
              {st.phase === "betting" && !flying ? (
                <>
                  <div className="text-sm font-semibold uppercase tracking-widest text-muted">Sljedeća runda za</div>
                  <div className="font-display text-6xl font-black tabular-nums sm:text-7xl">{(betLeft / 1000).toFixed(1).replace(".", ",")}s</div>
                  <div className="mx-auto mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#5ce1ff,#34d399)]" style={{ width: `${Math.min(100, (betLeft / (betSec * 1000)) * 100)}%` }} />
                  </div>
                  <div className="mt-2 text-sm text-muted tabular-nums">{st.bets.length} {st.bets.length === 1 ? "igrač" : "igrača"} · {coins(pot)} uloženo</div>
                </>
              ) : (
                <>
                  <div className="font-display text-7xl font-black tabular-nums drop-shadow-[0_4px_30px_rgba(0,0,0,.7)] sm:text-8xl" style={{ color: crashed ? "#ff3b5c" : "#fff", textShadow: `0 0 40px ${col}88` }}>
                    {fmtM(mult)}
                  </div>
                  {crashed && <div className="pop mt-1 font-display text-2xl font-extrabold uppercase tracking-[.3em] text-red-400">Crash!</div>}
                  {me?.cashout != null && (
                    <div className="pop mt-2 inline-block rounded-full bg-emerald-500/20 px-4 py-1 font-display text-lg font-bold text-emerald-300 ring-1 ring-emerald-400/50">
                      Izašao na {fmtM(me.cashout)} · +{coins(me.payout)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* KONTROLE */}
        <div className="card space-y-3 p-4">
          {!user ? (
            <p className="text-muted">Prijavi se da bi igrao.</p>
          ) : myLive ? (
            <button className="crash-cash w-full rounded-2xl bg-[linear-gradient(135deg,#34d399,#10b981)] px-4 py-5 text-center font-display text-ink shadow-[0_0_40px_-6px_#34d399] transition active:scale-[.98] disabled:opacity-60" disabled={busy} onClick={cashout}>
              <div className="text-sm font-bold uppercase tracking-widest">Izađi sada</div>
              <div className="text-4xl font-black tabular-nums">+{coins(me.amount * mult)}</div>
              <div className="text-sm font-semibold opacity-80">{fmtM(mult)} · ulog {coins(me.amount)}</div>
            </button>
          ) : (
            <>
              <BetInput value={bet} onChange={setBet} disabled={busy || !!me} min={Number(st.min_bet ?? 0.1)} max={Number(st.max_bet ?? 10000)} />
              <div className="rounded-xl border border-line p-3">
                <button type="button" role="switch" aria-checked={autoOn} disabled={!!me} onClick={() => setAutoOn(!autoOn)} className="flex w-full items-center justify-between gap-3 text-left">
                  <span>
                    <span className="block text-sm font-semibold">Auto cashout</span>
                    <span className="block text-xs text-muted">{autoOn ? "Izlaziš automatski na zadanom multiplikatoru" : "Isključeno — izlaziš sam"}</span>
                  </span>
                  <span className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${autoOn ? "bg-emerald-400" : "bg-line"}`}>
                    <span className={`h-5 w-5 rounded-full bg-white shadow transition ${autoOn ? "translate-x-5" : ""}`} />
                  </span>
                </button>
                {autoOn && (
                  <div className="mt-2 flex gap-1">
                    <NumberField className="input min-w-0" value={auto} disabled={!!me} onChange={setAuto} aria-label="Auto cashout multiplikator" />
                    {[1.5, 2, 5, 10].map((v) => (
                      <button key={v} className={`btn-ghost shrink-0 px-2.5 ${auto === v ? "border-emerald-400 text-emerald-300" : ""}`} disabled={!!me} onClick={() => setAuto(v)}>{v}x</button>
                    ))}
                  </div>
                )}
              </div>
              {me ? (
                me.cashout != null ? (
                  <div className="rounded-xl bg-emerald-500/10 p-3 text-center font-semibold text-emerald-300">Izašao si na {fmtM(me.cashout)} · +{coins(me.payout)}</div>
                ) : crashed ? (
                  <div className="rounded-xl bg-red-500/10 p-3 text-center font-semibold text-red-300">Crash — izgubio si {coins(me.amount)}</div>
                ) : (
                  <>
                    <div className="rounded-xl bg-accent2/10 p-3 text-center font-semibold text-accent2">U rundi si s {coins(me.amount)}{me.auto_cashout ? ` · auto ${fmtM(me.auto_cashout)}` : ""}</div>
                    {betLeft > 1000 && (
                      <button className="w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted hover:border-red-400/50 hover:text-red-300" disabled={busy} onClick={withdraw}>Povuci ulog</button>
                    )}
                  </>
                )
              ) : canBet ? (
                <button className="btn-primary w-full py-3 text-lg" disabled={busy || bet < Number(st.min_bet) || bet > Number(st.max_bet) || (autoOn && (auto < 1.01 || auto > 1000))} onClick={place}>
                  Uloži {coins(bet)}
                </button>
              ) : (
                <button className={`w-full rounded-xl border py-3 font-display text-lg font-bold transition ${queued ? "border-accent2 bg-accent2/15 text-accent2" : "border-line text-muted hover:text-fg"}`} onClick={() => setQueued(!queued)}>
                  {queued ? "✓ Ulažeš u sljedeću rundu (odustani)" : `Uloži ${coins(bet)} u sljedeću rundu`}
                </button>
              )}
              <p className="text-xs text-muted">Ulog {coins(Number(st.min_bet))} – {coins(Number(st.max_bet))}. Klađenje traje {betSec} s, a ulog možeš povući dok runda ne krene.</p>
            </>
          )}
        </div>
      </div>

      {/* IGRAČI */}
      <div className="card p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Igrači u rundi #{st.id}</h2>
          <span className="text-sm text-muted tabular-nums">{st.bets.length} · {coins(pot)} uloženo · {cashed.length} izašlo</span>
        </div>
        {st.bets.length === 0 ? (
          <p className="text-sm text-muted">Još nitko nije uložio. Budi prvi.</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {[...st.bets]
              .sort((a, b) => (b.cashout ?? 0) - (a.cashout ?? 0) || b.amount - a.amount)
              .map((b) => {
                const out = b.cashout != null;
                const lost = crashed && !out;
                const mine = b.user_id === user?.id;
                return (
                  <li
                    key={b.user_id}
                    className={`drop-in flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition ${mine ? "border-accent2/60 bg-accent2/10" : out ? "border-emerald-400/40 bg-emerald-500/[.07]" : lost ? "border-red-500/25 bg-red-500/[.05] opacity-70" : "border-line"}`}
                  >
                    <span className="grid h-6 min-w-6 place-items-center rounded bg-panel2 px-1 font-display text-xs font-bold">{b.level}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{b.username}{mine && <span className="text-accent2"> (ti)</span>}</span>
                    <span className="font-display font-bold tabular-nums text-accent">{coins(b.amount)}</span>
                    <span className={`w-28 text-right font-display text-sm font-bold tabular-nums ${out ? "text-emerald-300" : lost ? "text-red-300" : "text-muted"}`}>
                      {out ? <>{fmtM(b.cashout!)} · +{coins(b.payout)}</> : lost ? `−${coins(b.amount)}` : flying ? "leti…" : "čeka"}
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </div>
  );
}
