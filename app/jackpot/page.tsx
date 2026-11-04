"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { coins, errMsg } from "@/lib/format";
import { sfx } from "@/lib/sound";
import { fmtLeft, useNow } from "@/lib/useNow";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { BetInput } from "@/components/BetInput";
import { CountUp } from "@/components/CountUp";
import { NameReel, type Entry } from "@/components/NameReel";
import { useCelebrate } from "@/components/WinOverlay";
import { TEAM_COLORS } from "@/lib/battles";

type Player = { user_id: string; username: string; level: number; bet: number };
type Last = { ticket?: number | null; id: number; status: "paid" | "refunded"; pot: number; payout: number | null; players: Player[]; winner_id: string | null; winner: string | null };
type State = { id: number; ends_at: string; now: string; pot: number; min_bet?: number; max_bet?: number; fee_pct?: number; round_sec?: number; players: Player[]; last: Last | null; history: { id: number; pot: number; payout: number; winner: string; n: number }[] };

const color = (i: number) => TEAM_COLORS[i % TEAM_COLORS.length];

export default function JackpotPage() {
  const { user, refresh, isAdmin } = useAuth();
  const toast = useToast();
  const celebrate = useCelebrate();
  const now = useNow(250);
  const [st, setSt] = useState<State | null>(null);
  const [skew, setSkew] = useState(0);
  const [bet, setBet] = useState(5);
  const [busy, setBusy] = useState(false);
  const [draw, setDraw] = useState<{ last: Last; key: number } | null>(null);
  const seenLast = useRef<number | null | undefined>(undefined);
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  const load = useCallback(async () => {
    const { data } = await createClient().rpc("jackpot_state");
    if (!data) return;
    const s = data as State;
    s.pot = Number(s.pot);
    s.players = s.players.map((p) => ({ ...p, bet: Number(p.bet) }));
    setSkew(new Date(s.now).getTime() - Date.now());
    setSt(s);
    const lastId = s.last?.id ?? null;
    if (seenLast.current === undefined) {
      seenLast.current = lastId; // prvo učitavanje: ne vrti stari rezultat
    } else if (lastId !== seenLast.current && s.last) {
      seenLast.current = lastId;
      const last = { ...s.last, players: s.last.players.map((p) => ({ ...p, bet: Number(p.bet) })) };
      if (last.status === "paid") setDraw({ last, key: Date.now() });
      else if (last.players.some((p) => p.user_id === user?.id)) {
        toast("U rundi nije bilo drugih igrača, ulog ti je vraćen.", "info");
        refresh();
      }
    }
  }, [toast, refresh, user]);

  useEffect(() => {
    load();
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [load]);

  const place = async () => {
    setBusy(true);
    const { error } = await createClient().rpc("jackpot_bet", { p_amount: bet });
    setBusy(false);
    if (error) return toast(errMsg(error), "error");
    sfx.coin();
    refresh();
    load();
  };

  const withdraw = async () => {
    setBusy(true);
    const { error } = await createClient().rpc("jackpot_withdraw");
    setBusy(false);
    if (error) return toast(errMsg(error), "error");
    toast("Ulog je povučen i vraćen na račun.", "success");
    refresh();
    load();
  };

  const drawNow = async () => {
    if (!window.confirm("Završiti rundu i izvući pobjednika odmah?")) return;
    setBusy(true);
    const { error } = await createClient().rpc("admin_jackpot_draw_now");
    setBusy(false);
    if (error) return toast(errMsg(error), "error");
    load();
  };

  const onDrawDone = useCallback(() => {
    const d = drawRef.current;
    if (!d) return;
    const me = d.last.players.find((p) => p.user_id === user?.id);
    if (d.last.winner_id && d.last.winner_id === user?.id) {
      celebrate({ title: "Jackpot!", subtitle: `Šansa je bila ${(((me?.bet ?? 0) / d.last.pot) * 100).toFixed(1).replace(".", ",")}%`, amount: Number(d.last.payout ?? 0), tier: (me?.bet ?? 0) / d.last.pot < 0.25 ? 3 : 2 });
    } else if (me) {
      sfx.lose();
      toast(`Jackpot je osvojio ${d.last.winner}.`, "error");
    }
    refresh();
  }, [user, celebrate, toast, refresh]);

  const drawEntries: Entry[] = useMemo(() => {
    if (!draw) return [];
    const pot = draw.last.pot;
    return draw.last.players.map((p, i) => ({ label: p.username, sub: `${((p.bet / pot) * 100).toFixed(1).replace(".", ",")}%`, color: color(i), weight: p.bet }));
  }, [draw]);
  const drawWinner = draw ? Math.max(0, draw.last.players.findIndex((p) => p.user_id === draw.last.winner_id)) : 0;

  if (!st || now === null) return <div className="card h-96 animate-pulse" />;
  const left = Math.max(0, new Date(st.ends_at).getTime() - (now + skew));
  const roundMs = Number(st.round_sec ?? 60) * 1000;
  const progress = Math.max(0, 1 - left / roundMs);
  const me = st.players.find((p) => p.user_id === user?.id);
  const myChance = me && st.pot ? (me.bet / st.pot) * 100 : 0;
  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Jackpot</h1>
        <p className="mt-2 max-w-2xl text-muted">Runde traju {Number(st.round_sec ?? 60)} s i igraju ih samo pravi igrači. Veći ulog znači veću šansu, a pobjednik uzima cijeli pot (−{Number(st.fee_pct ?? 5)}%). Ako u rundi bude samo jedan igrač, ulog mu se vraća.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="card relative overflow-hidden p-5">
          <div className="flex flex-wrap items-center gap-6">
            <div className="relative h-36 w-36 shrink-0">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-line)" strokeWidth="8" />
                <circle cx="60" cy="60" r={R} fill="none" stroke={left < 10_000 ? "#ef4444" : "#f5821f"} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${progress * C} ${C}`} />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className={`font-display text-4xl font-black leading-none ${left < 10_000 ? "text-red-400" : ""}`}>{Math.ceil(left / 1000)}</div>
                  <div className="text-xs text-muted">sekundi</div>
                </div>
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-sm text-muted">Trenutni pot · runda #{st.id}</div>
              <div className="font-display text-6xl font-black leading-none text-accent">
                <CountUp value={st.pot} />
              </div>
              <div className="mt-1 text-sm text-muted">
                {st.players.length} {st.players.length === 1 ? "igrač" : "igrača"} · izvlačenje za {fmtLeft(left)}
                {me && <> · tvoja šansa <b className="text-emerald-300">{myChance.toFixed(1).replace(".", ",")}%</b></>}
              </div>
            </div>
          </div>

          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-line">
            {st.players.map((p, i) => <div key={p.user_id} className="transition-[width] duration-500" style={{ width: `${(p.bet / Math.max(st.pot, 0.01)) * 100}%`, background: color(i) }} title={p.username} />)}
          </div>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {st.players.length === 0 && <li className="text-sm text-muted">Još nitko nije uložio u ovu rundu. Budi prvi.</li>}
            {st.players.map((p, i) => (
              <li key={p.user_id} className={`drop-in flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm ${p.user_id === user?.id ? "border-accent2/60 bg-accent2/10" : "border-line"}`}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color(i) }} />
                <span className="grid h-5 min-w-5 place-items-center rounded bg-panel2 px-1 font-display text-xs font-bold">{p.level}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{p.username}</span>
                <span className="font-display font-bold text-accent">{coins(p.bet)}</span>
                <span className="w-14 text-right text-xs text-muted">{((p.bet / Math.max(st.pot, 0.01)) * 100).toFixed(1).replace(".", ",")}%</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card space-y-3 p-5">
          <h2 className="font-display text-2xl font-extrabold">Uloži u ovu rundu</h2>
          {user ? (
            <>
              <BetInput value={bet} onChange={setBet} disabled={busy} min={Number(st.min_bet ?? 1)} max={Number(st.max_bet ?? 10000)} />
              <button className="btn-primary w-full py-3 text-lg" disabled={busy || bet < Number(st.min_bet ?? 1) || bet > Number(st.max_bet ?? 10000) || left < 2000} onClick={place}>
                {left < 2000 ? "Izvlačenje…" : me ? `Dodaj ${coins(bet)}` : `Uloži ${coins(bet)}`}
              </button>
              <p className="text-xs text-muted">Ulog {coins(Number(st.min_bet ?? 1))} – {coins(Number(st.max_bet ?? 10000))}. Možeš ulagati više puta u istoj rundi. Ulozi se zatvaraju 2 sekunde prije izvlačenja.</p>
              {me && left >= 3000 && (
                <button className="w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted hover:border-red-400/50 hover:text-red-300" disabled={busy} onClick={withdraw}>
                  Povuci svoj ulog ({coins(me.bet)})
                </button>
              )}
              {isAdmin && (
                <button className="w-full rounded-lg border border-accent2/40 px-3 py-2 text-sm font-semibold text-accent2 hover:bg-accent2/10" disabled={busy} onClick={drawNow}>
                  Admin: izvuci sada
                </button>
              )}
            </>
          ) : (
            <p className="text-muted">Prijavi se da bi uložio.</p>
          )}
          {st.history.length > 0 && (
            <div className="border-t border-line pt-3">
              <div className="mb-1 font-display text-lg font-bold">Zadnji dobitnici</div>
              <ul className="space-y-1 text-sm">
                {st.history.map((h) => (
                  <li key={h.id} className="flex justify-between gap-2">
                    <span className="truncate">{h.winner} <span className="text-muted">· {h.n} igrača</span></span>
                    <span className="font-display font-bold text-accent">{coins(h.payout)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {draw && (
        <div className="pop space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">Izvlačenje runde #{draw.last.id}</h2>
            <span className="text-sm text-muted">Pot {coins(draw.last.pot)}</span>
          </div>
          <NameReel entries={drawEntries} winner={drawWinner} spinKey={draw.key} duration={6000} ticket={draw.last.ticket == null ? null : Number(draw.last.ticket)} pot={Number(draw.last.pot)} onDone={onDrawDone} />
        </div>
      )}
    </div>
  );
}
