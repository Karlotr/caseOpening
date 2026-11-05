"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { getCases, getItems, randomFromCase } from "@/lib/data";
import { TEAM_COLORS, jackpotWeight, loadBattle, modeDesc, modeLabel, type Battle, type BattleDrop, type BattlePlayer } from "@/lib/battles";
import type { CaseWithItems, Item } from "@/lib/types";
import { coins } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { sfx } from "@/lib/sound";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { CaseArt } from "@/components/CaseCard";
import { ItemCard } from "@/components/ItemCard";
import { Reel } from "@/components/Reel";
import { NameReel, type Entry } from "@/components/NameReel";
import { CountUp } from "@/components/CountUp";
import { useChat } from "@/components/Chat";
import { goldThreshold } from "@/lib/gold";
import { StakePicker } from "@/components/StakePicker";
import { Price } from "@/components/Price";

const WIN = 32;
const ROUND_PAUSE = 2300; // koliko izvučeni auti ostaju u traci prije sljedeće runde
const FAST_SPIN = 700; // brzi mod: kratka vrtnja; zlatni (rijetki) dropovi i dalje imaju punu animaciju
const FAST_PAUSE = 450;
type Phase = "idle" | "rounds" | "roulette" | "done";

export function BattleView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, profile, refresh, holdWallet, deferCredit } = useAuth();
  const rpc = useRpc();
  const toast = useToast();
  const { shareBattle } = useChat();
  const [battle, setBattle] = useState<Battle | null>(null);
  const [players, setPlayers] = useState<BattlePlayer[]>([]);
  const [drops, setDrops] = useState<BattleDrop[]>([]);
  const [cases, setCases] = useState<Map<number, CaseWithItems>>(new Map());
  const [items, setItems] = useState<Map<number, Item>>(new Map());
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stake, setStake] = useState(1);

  const [phase, setPhase] = useState<Phase>("idle");
  const [revealed, setRevealed] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [strips, setStrips] = useState<Item[][]>([]);
  const [spinKey, setSpinKey] = useState(0);
  const [rouletteKey, setRouletteKey] = useState(0);
  const rouletteBox = useRef<HTMLDivElement>(null);
  // kad krene jackpot rulet, dovedi ga na vrh ekrana (sticky ga dalje drži gore dok se skrola)
  useEffect(() => {
    if (!rouletteKey) return;
    const el = rouletteBox.current;
    if (el && el.getBoundingClientRect().top > 80) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [rouletteKey]);
  const [announce, setAnnounce] = useState(false);
  const decided = useRef(false);

  const reload = useCallback(async () => {
    const r = await loadBattle(id);
    if (!r.battle) return setNotFound(true);
    setBattle(r.battle);
    setPlayers(r.players);
    setDrops(r.drops);
  }, [id]);

  useEffect(() => {
    getCases().then((c) => setCases(new Map(c.map((x) => [x.id, x]))));
    getItems().then((i) => setItems(new Map(i.map((x) => [x.id, x]))));
    reload();
    const sb = createClient();
    const ch = sb
      .channel(`battle-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "battles", filter: `id=eq.${id}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_players", filter: `battle_id=eq.${id}` }, () => reload())
      .subscribe();
    const t = setInterval(() => {
      if (!decided.current) reload();
    }, 4000);
    return () => {
      sb.removeChannel(ch);
      clearInterval(t);
    };
  }, [id, reload]);

  const rounds = battle?.case_ids.length ?? 0;
  const isJackpot = !!battle?.jackpot;
  const isCrazy = !!battle?.crazy;

  const reelsDone = useRef(0);

  const heldRef = useRef(false);
  // reprodukcija: brzina (1× / 2×), preskakanje i ponovno pokretanje
  const [speed, setSpeed] = useState(1);
  // kontrole (2×, Preskoči, Ispočetka) samo kod ponovnog gledanja završenog battlea, ne uživo
  const [replay, setReplay] = useState(false);
  const speedRef = useRef(1);
  const playId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => {
    const id = playId.current;
    timers.current.push(setTimeout(() => id === playId.current && fn(), ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const caseStrip = useRef<HTMLDivElement>(null);
  const spinRound = useCallback(
    (r: number) => {
      if (!battle) return;
      const c = cases.get(battle.case_ids[r]);
      if (!c) return;
      setStrips(
        Array.from({ length: battle.seats }, (_, seat) => {
          const strip = Array.from({ length: 40 }, () => randomFromCase(c));
          const d = drops.find((x) => x.round === r + 1 && x.seat === seat);
          if (d && items.get(d.item_id)) strip[WIN] = items.get(d.item_id)!;
          return strip;
        })
      );
      reelsDone.current = 0;
      setSpinning(true);
      setSpinKey((k) => k + 1);
    },
    [battle, cases, drops, items]
  );

  const startPlayback = useCallback(() => {
    playId.current += 1;
    clearTimers();
    // makni trake prošle reprodukcije da se ne zavrti stara runda prije prve
    setStrips([]);
    setSpinning(false);
    setAnnounce(false);
    setRevealed(0);
    setPhase("rounds");
    // mobitel: zaglavlje je visoko — skrolaj do trake kutija kad reprodukcija krene
    if (typeof window !== "undefined" && window.innerWidth < 768) caseStrip.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    later(() => spinRound(0), 500);
     
  }, [spinRound]);

  const skipToEnd = () => {
    playId.current += 1;
    clearTimers();
    setStrips([]);
    setSpinning(false);
    setRevealed(rounds);
    setPhase("done");
    setAnnounce(true);
  };
  const toggleSpeed = () => {
    const v = speedRef.current === 1 ? 2 : 1;
    speedRef.current = v;
    setSpeed(v);
  };

  // kad battle završi: animiraj ako je svjež, inače odmah pokaži rezultat
  useEffect(() => {
    if (decided.current || !battle || battle.status !== "finished" || !drops.length || !cases.size || !items.size) return;
    decided.current = true;
    const age = Date.now() - new Date(battle.finished_at ?? battle.created_at).getTime();
    if (age < 90_000) {
      sfx.lightsOut();
      const me = user ? players.find((p) => p.user_id === user.id) : undefined;
      if (me) {
        // isplata je već na računu — sakrij je dok se battle ne odvrti (ista formula kao na serveru)
        const winners = players.filter((p) => p.team === battle.winner_team).length;
        const payout = me.team === battle.winner_team ? Math.round(((battle.total_value ?? 0) / Math.max(1, winners)) * me.stake * 100) / 100 : 0;
        heldRef.current = true;
        deferCredit(payout);
      }
      startPlayback();
    } else {
      setRevealed(rounds);
      setPhase("done");
    }
  }, [battle, drops, cases, items, rounds, startPlayback, user, players, deferCredit]);

  // kad animacija završi (ili napustiš stranicu) pokaži pravo stanje
  useEffect(() => {
    if (phase === "done" && heldRef.current) {
      heldRef.current = false;
      holdWallet(null);
    }
  }, [phase, holdWallet]);
  useEffect(() => () => {
    if (heldRef.current) holdWallet(null);
  }, [holdWallet]);

  const onRoundDone = useCallback(() => {
    setSpinning(false);
    setRevealed((r) => {
      const next = r + 1;
      // u brzom modu kratka pauza, osim ako je u rundi pao zlatni (rijetki) auto
      const gm = goldThreshold(cases.get(battle?.case_ids[next - 1] ?? -1));
      const gold = drops.some((d) => d.round === next && (items.get(d.item_id)?.value ?? 0) >= gm);
      const pause = (battle?.fast && !gold ? FAST_PAUSE : ROUND_PAUSE) / speedRef.current;
      later(() => {
        if (next < rounds) spinRound(next);
        else if (battle?.jackpot) {
          setPhase("roulette");
          setRouletteKey((k) => k + 1);
        } else {
          setPhase("done");
          setAnnounce(true);
        }
      }, pause);
      return next;
    });
     
  }, [rounds, spinRound, battle, drops, items, cases]);

  // traka kutija na vrhu prati trenutnu rundu
  useEffect(() => {
    const box = caseStrip.current;
    const el = box?.querySelector<HTMLElement>(`[data-case="${Math.min(revealed, rounds - 1)}"]`);
    if (!box || !el) return;
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [revealed, rounds]);

  // sljedeća runda tek kad su SVE trake stale (i one sa zlatnom drugom vrtnjom)
  const onReelDone = useCallback(() => {
    reelsDone.current += 1;
    if (reelsDone.current === (battle?.seats ?? 1)) onRoundDone();
  }, [battle?.seats, onRoundDone]);

  const onRouletteDone = useCallback(() => {
    setTimeout(() => {
      setPhase("done");
      setAnnounce(true);
    }, 600);
  }, []);

  const totals = useMemo(() => {
    const t = new Map<number, number>();
    drops.filter((d) => d.round <= revealed).forEach((d) => t.set(d.seat, (t.get(d.seat) ?? 0) + (items.get(d.item_id)?.value ?? 0)));
    return t;
  }, [drops, revealed, items]);

  const teams = useMemo(
    () => (battle ? Array.from({ length: battle.seats / battle.team_size }, (_, t) => Array.from({ length: battle.team_size }, (_, i) => t * battle.team_size + i)) : []),
    [battle]
  );
  const teamTotal = useCallback((ti: number) => teams[ti]?.reduce((s, seat) => s + (totals.get(seat) ?? 0), 0) ?? 0, [teams, totals]);
  const grand = teams.reduce((s, _, ti) => s + teamTotal(ti), 0);
  const teamName = useCallback(
    (ti: number) => teams[ti]?.map((s) => players.find((p) => p.seat === s)?.name ?? "?").join(" & ") ?? "",
    [teams, players]
  );

  // šansa u Jackpot modu (u Crazy Jackpotu obrnuto proporcionalna vrijednosti)
  const weights = teams.map((_, ti) => jackpotWeight(teamTotal(ti), isCrazy));
  const wSum = weights.reduce((a, b) => a + b, 0);
  const chanceOf = (ti: number) => (wSum && grand > 0 ? (weights[ti] / wSum) * 100 : 0);
  const chanceKey = weights.map((w) => w.toFixed(4)).join("|");
  const entries: Entry[] = useMemo(
    () =>
      teams.map((_, ti) => {
        const w = jackpotWeight(teamTotal(ti), isCrazy);
        const sum = teams.reduce((a, __, k) => a + jackpotWeight(teamTotal(k), isCrazy), 0);
        const team = (battle?.team_size ?? 1) > 1;
        return {
          label: team ? `Tim ${ti + 1}` : teamName(ti),
          names: team ? teamName(ti) : undefined,
          sub: grand ? `${((w / sum) * 100).toFixed(1).replace(".", ",")}% šanse` : "",
          color: TEAM_COLORS[ti % TEAM_COLORS.length],
          weight: w,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teams, teamName, chanceKey, grand, isCrazy, battle?.team_size]
  );

  // pobjeda / poraz obavijest
  useEffect(() => {
    if (!announce || !battle) return;
    setAnnounce(false);
    refresh();
    const me = players.find((p) => p.user_id === user?.id);
    if (!me) return;
    const winners = players.filter((p) => p.team === battle.winner_team);
    if (me.team === battle.winner_team) {
      // pravedno: ukupna vrijednost / broj mjesta u pobjedničkom timu × vlastiti udio ulaza
      const pot = drops.reduce((sum, d) => sum + (items.get(d.item_id)?.value ?? 0), 0);
      const full = pot / Math.max(1, winners.length);
      const val = Math.round(full * me.stake * 100) / 100;
      // bez velikog popupa u battleu — samo zvuk i kratka obavijest
      sfx.win(val >= battle.cost * 3 ? 3 : val >= battle.cost * 1.5 ? 2 : 1);
      toast(`Pobjeda! +${coins(val)} na račun`, "gold");
    } else {
      sfx.lose();
      toast(`Battle je dobio ${teamName(battle.winner_team ?? 0)}. Probaj ponovno.`, "error");
    }
  }, [announce, battle, players, user, drops, items, toast, teamName, isJackpot, isCrazy, refresh]);

  if (notFound) return <div className="card p-8 text-center">Ovaj battle ne postoji. <Link href="/battles" className="text-accent2">Natrag na battles</Link></div>;
  if (!battle) return <div className="card h-96 animate-pulse" />;

  const done = phase === "done";
  const meIn = players.some((p) => p.user_id === user?.id);
  const isCreator = user?.id === battle.creator_id;
  const myWin = done && players.find((p) => p.user_id === user?.id)?.team === battle.winner_team;
  const teamMode = battle.team_size > 1;
  // dio nagrade po igraču (ista formula kao na serveru): ukupno / broj mjesta u pobjedničkom timu × udio ulaza
  const winnerSeats = players.filter((p) => p.team === battle.winner_team).length;
  const shareOf = (p?: BattlePlayer) =>
    p && p.team === battle.winner_team ? Math.round(((battle.total_value ?? 0) / Math.max(1, winnerSeats)) * p.stake * 100) / 100 : 0;
  const myPlayer = players.find((p) => p.user_id === user?.id);
  const myPayout = shareOf(myPlayer);
  // auti koji su već izašli iz trake (trenutna runda se još prikazuje u traci)
  const shownInReel = phase === "rounds" ? (spinning ? revealed + 1 : revealed) : -1;
  const mineOf = (seat: number) =>
    drops.filter((d) => d.seat === seat && d.round <= revealed && d.round !== shownInReel).sort((a, b) => b.round - a.round);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Link battlea je kopiran.", "success");
    } catch {
      toast("Kopiranje nije uspjelo, kopiraj adresu iz preglednika.", "error");
    }
  };

  // ulazak: ako si zadnji i battle odmah krene, stanje se prikazuje kao "minus ulaz" dok se ne odvrti
  const join = async (seat: number) => {
    if (!battle || !profile) return;
    const paid = battle.sponsored ? 0 : Math.round(battle.cost * stake * 100) / 100;
    const gemBattle = battle.currency === "gems";
    const before = { balance: gemBattle ? profile.balance : Math.max(0, profile.balance - paid) };
    setBusy(true);
    const r = await rpc<{ ok: boolean; started: boolean }>("join_battle", { p_id: battle.id, p_seat: seat, p_stake: battle.sponsored ? 1 : stake }, { silentRefresh: true });
    setBusy(false);
    if (r) {
      toast(battle.sponsored ? "Ušao si u battle!" : `Ušao si u battle! −${coins(paid)} ${gemBattle ? "gemova" : "coina"}`, "success");
      if (r.started) {
        heldRef.current = true;
        holdWallet(before);
      }
      refresh();
    }
    await reload();
  };

  // isti battle ponovno: isti mod, kutije, prekidači i tvoj udio ulaza
  const myStake = players.find((p) => p.user_id === user?.id)?.stake ?? 1;
  const recreatePrice = battle.cost * myStake + (battle.sponsored ? battle.cost * (battle.seats - 1) : 0);
  const recreate = async () => {
    setBusy(true);
    const newId = await rpc<string>("create_battle", {
      p_mode: battle.mode,
      p_case_ids: battle.case_ids,
      p_crazy: battle.crazy,
      p_jackpot: battle.jackpot,
      p_stake: myStake,
      p_sponsored: battle.sponsored,
      p_private: battle.private,
      p_fast: battle.fast,
    });
    setBusy(false);
    if (newId) router.push(`/battles/${newId}`);
  };

  const act = async (fn: string, args: Record<string, unknown>, msg?: string, silentRefresh = false) => {
    setBusy(true);
    const r = await rpc(fn, args, { silentRefresh });
    setBusy(false);
    if (r && msg) toast(msg, "success");
    await reload();
  };

  // najbolji drop u zadnjoj otkrivenoj rundi

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div>
          <Link href="/battles" className="text-sm text-muted hover:text-fg">Battles</Link>
          <h1 className="h1 flex items-center gap-3">
            {battle.mode}
            <span className={`rounded px-2 py-0.5 font-display text-base font-bold ${isJackpot ? "bg-emerald-400/20 text-emerald-300" : isCrazy ? "bg-fuchsia-500/20 text-fuchsia-300" : "bg-accent2/15 text-accent2"}`}>
              {modeLabel(battle)}
            </span>
            {battle.sponsored && <span className="rounded bg-amber-400/20 px-2 py-0.5 font-display text-base font-bold text-amber-300">Sponzorirano</span>}
            {battle.private && <span className="rounded bg-panel2 px-2 py-0.5 font-display text-base font-bold text-muted">Privatni</span>}
            {battle.fast && <span className="rounded bg-emerald-400/15 px-2 py-0.5 font-display text-base font-bold text-emerald-300">Brzo</span>}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {modeDesc(battle)}
            {battle.sponsored && " Ulaz je besplatan, sve je platio kreator."}
            {battle.private && " Battle je privatan: ulazi se samo preko linka."}
          </p>
          <button className="btn-ghost mt-2 px-3 py-1.5 text-sm" onClick={copyLink}>Kopiraj link battlea</button>
        </div>
        <div className="ml-auto flex gap-5 text-right">
          <div>
            <div className="text-sm text-muted">Ulaz</div>
            <div className="font-display text-2xl font-bold text-accent">{battle.sponsored ? <span className="text-amber-300">Besplatno</span> : <Price amount={battle.cost} gems={battle.currency === "gems"} />}</div>
          </div>
          <div>
            <div className="text-sm text-muted">Na stolu</div>
            <div className="font-display text-2xl font-bold"><CountUp value={grand} /></div>
          </div>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-2 sm:flex-nowrap">
      <div ref={caseStrip} className="relative flex min-w-0 flex-1 basis-full scroll-mt-20 items-center gap-1.5 overflow-x-auto scroll-smooth sm:basis-auto">
        {battle.case_ids.map((cid, i) => {
          const c = cases.get(cid);
          const current = spinning && i === revealed;
          const past = i < revealed;
          return c ? (
            <div key={i} data-case={i} className={`relative shrink-0 rounded-lg p-0.5 transition ${current ? "ring-2 ring-accent" : past ? "opacity-40" : ""}`}>
              <CaseArt c={c} className="h-14 w-24" />
              <span className="absolute bottom-1 right-1.5 font-display text-sm font-bold text-white/80">{i + 1}</span>
            </div>
          ) : null;
        })}
      </div>
        {replay && (phase === "rounds" || phase === "roulette") && (
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={toggleSpeed} aria-pressed={speed === 2} title="Ubrzaj reprodukciju" className={`rounded-lg border px-2.5 py-1.5 text-sm font-bold ${speed === 2 ? "border-accent2 bg-accent2/15 text-accent2" : "border-line text-muted hover:text-fg"}`}>{speed}×</button>
            <button type="button" onClick={skipToEnd} title="Preskoči na rezultat" className="rounded-lg border border-line px-2.5 py-1.5 text-sm font-bold text-muted hover:text-fg">Preskoči</button>
            {(revealed > 0 || phase === "roulette") && <button type="button" onClick={startPlayback} title="Vrati na početak" className="rounded-lg border border-line px-2.5 py-1.5 text-sm font-bold text-muted hover:text-fg">Ispočetka</button>}
          </div>
        )}
        <div className="ml-auto shrink-0 self-center whitespace-nowrap px-3 font-display text-xl font-bold">
          Runda {Math.min(revealed + (spinning ? 1 : 0), rounds)}<span className="text-muted">/{rounds}</span>
        </div>
      </div>

      {battle.status === "waiting" && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <span className="text-muted">Čekamo igrače: <b className="text-fg">{players.length}/{battle.seats}</b>. Battle kreće čim se sva mjesta popune.</span>
          {user && <button className="btn-ghost" onClick={() => shareBattle(battle.id)}>Podijeli u chat</button>}
          {isCreator && (
            <div className="ml-auto flex gap-2">
              <button className="btn-primary" disabled={busy} onClick={() => act("fill_battle_bots", { p_id: battle.id }, undefined, true)}>Popuni botovima i kreni</button>
              {players.length === 1 && <button className="btn-ghost" disabled={busy} onClick={() => act("cancel_battle", { p_id: battle.id }, "Battle otkazan, coini su vraćeni.")}>Otkaži battle</button>}
            </div>
          )}
        </div>
      )}
      {battle.status === "waiting" && user && !meIn && !battle.sponsored && <StakePicker cost={battle.cost} value={stake} onChange={setStake} gems={battle.currency === "gems"} />}
      {battle.status === "cancelled" && <div className="card p-4 text-muted">Ovaj battle je otkazan.</div>}

      {(phase === "roulette" || (done && battle.jackpot)) && (
        <div
          ref={rouletteBox}
          className={`pop scroll-mt-20 space-y-2 ${
            phase === "roulette"
              ? "sticky top-[4.5rem] z-40 -mx-2 rounded-2xl bg-[#090a14]/90 p-2 shadow-[0_20px_40px_-12px_rgba(0,0,0,.8)] ring-1 ring-emerald-400/30 backdrop-blur-xl"
              : ""
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Jackpot rulet</h2>
            <span className="text-sm text-muted">{isCrazy ? "Crazy: manja vrijednost znači veću šansu" : `Šansa = vrijednost / ${coins(grand)}`}</span>
          </div>
          <NameReel entries={entries} winner={battle.winner_team ?? 0} spinKey={rouletteKey} ticket={battle.jackpot_ticket} pot={grand} onDone={onRouletteDone} />
        </div>
      )}

      {done && (
        <div className={`pop flex flex-wrap items-center gap-4 rounded-xl border p-4 ${myWin ? "border-accent bg-accent/10" : "border-line bg-panel"}`}>
          <span className="checker h-10 w-10 rounded" />
          <div>
            <div className="text-sm text-muted">Pobjednik</div>
            <div className="break-words font-display text-3xl font-black leading-none">{myWin ? "Ti!" : teamName(battle.winner_team ?? 0)}</div>
            <div className="mt-1 text-sm text-muted">
              Ukupno {coins(battle.total_value ?? 0)}
              {battle.team_size > 1 && <> · svaki pobjednik dobiva {coins((battle.total_value ?? 0) / battle.team_size)}</>}
            </div>
          </div>
          {myPlayer && (
            <div className={`pop rounded-xl px-4 py-2 text-right ${myWin ? "bg-accent/15 ring-1 ring-accent/60 shadow-[0_0_40px_-10px_#ffb547]" : "bg-white/[.04]"}`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">{myWin ? "Osvojio si" : "Ovaj put"}</div>
              {myWin ? (
                <div className="flex items-center justify-end gap-1.5 font-display text-4xl font-black leading-none text-accent tabular-nums">
                  +<span className="coin" /><CountUp value={myPayout} from={0} duration={1400} />
                </div>
              ) : (
                <div className="font-display text-2xl font-bold leading-none text-muted">bez dobitka</div>
              )}
              {myWin && myPlayer.stake < 1 && <div className="mt-0.5 text-xs text-muted">{Math.round(myPlayer.stake * 100)}% udio ulaza</div>}
            </div>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            {user && (
              <button className="btn-primary" disabled={busy} onClick={recreate} title="Kreira novi, identičan battle">
                Kreiraj isti · <Price amount={recreatePrice} gems={battle.currency === "gems"} />
              </button>
            )}
            <button className="btn-ghost" onClick={() => { setReplay(true); startPlayback(); }}>Pogledaj ponovno</button>
            {user && <button className="btn-ghost" onClick={() => shareBattle(battle.id)}>Podijeli u chat</button>}
          </div>
        </div>
      )}

      {/* mobitel: mreža mjesta (2 ili 3 stupca) / timovi jedan ispod drugog; desktop: timovi u redu */}
      <div className="pb-2 md:overflow-x-auto">
        <div className={`grid gap-2 md:flex md:min-w-0 ${battle.team_size > 1 ? "grid-cols-1" : battle.seats % 3 === 0 ? "grid-cols-3" : "grid-cols-2"}`}>
          {teams.map((seats, ti) => {
            const won = done && battle.winner_team === ti;
            const tc = TEAM_COLORS[ti % TEAM_COLORS.length];
            return (
              <Fragment key={ti}>
                {ti > 0 && <div className="hidden w-10 shrink-0 place-items-center font-display text-2xl font-black text-muted md:grid">VS</div>}
                <div className={`flex min-w-0 flex-1 flex-col gap-2 rounded-xl p-1 transition md:p-1.5 ${won ? "bg-accent/10 ring-2 ring-accent" : done ? "opacity-60" : ""}`}>
                  {battle.team_size > 1 && (
                    <div className="flex items-center justify-between px-1 font-display text-lg font-bold">
                      <span style={{ color: tc }}>Tim {ti + 1}</span>
                      <span className="flex items-center gap-2">
                        {isJackpot && grand > 0 && <span className="text-sm text-emerald-300">{chanceOf(ti).toFixed(1)}%</span>}
                        <CountUp value={teamTotal(ti)} />
                      </span>
                    </div>
                  )}
                  <div className="flex gap-1.5 md:gap-2">
                    {seats.map((seat) => {
                      const p = players.find((x) => x.seat === seat);
                      const mine = mineOf(seat);
                      const isMe = p?.user_id && p.user_id === user?.id;
                      return (
                        <div key={seat} className="min-w-0 flex-1 space-y-2 md:min-w-36">
                          <div className="card flex items-center gap-2 p-1.5 md:p-2" style={{ boxShadow: `inset 3px 0 0 ${tc}` }}>
                            <span className={`hidden h-9 w-9 shrink-0 place-items-center rounded-md font-display text-base font-black min-[440px]:grid md:grid ${p ? (p.is_bot ? "bg-panel2 text-accent2" : "bg-accent text-ink") : "border border-dashed border-line text-muted"}`}>
                              {p ? (p.is_bot ? "AI" : p.name.slice(0, 2).toUpperCase()) : "?"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-sm font-semibold md:text-base">{p?.name ?? "Slobodno mjesto"}{isMe && <span className="text-accent2"> (ti)</span>}</span>
                                {p && p.stake < 1 && <span className="shrink-0 rounded bg-amber-400/20 px-1 text-xs font-bold text-amber-300" title="Posudio dio ulaza — dobiva toliki dio nagrade">{Math.round(p.stake * 100)}%</span>}
                              </div>
                              <div className="flex items-center gap-2 font-display text-lg font-bold leading-none text-accent">
                                <CountUp value={totals.get(seat) ?? 0} />
                                {isJackpot && battle.team_size === 1 && grand > 0 && (
                                  <span className="text-sm text-emerald-300">{chanceOf(ti).toFixed(1)}%</span>
                                )}
                              </div>
                              {done && p && (
                                <div className={`mt-1 text-xs font-semibold tabular-nums ${won ? "text-emerald-300" : "text-muted"}`} title="Dio nagrade iz ovog battlea">
                                  {won ? <>Dio pobjede: +{coins(shareOf(p))}</> : "Dio pobjede: 0"}
                                </div>
                              )}
                            </div>
                          </div>
                          {battle.status === "waiting" ? (
                            <div className="card grid h-[260px] place-items-center p-2 text-center md:h-[336px] md:p-3">
                              {p ? (
                                <span className="font-display text-xl font-bold text-emerald-300">Spreman</span>
                              ) : user && !meIn ? (
                                <button className="btn-primary" disabled={busy} onClick={() => join(seat)}>
                                  {battle.sponsored ? "Uđi besplatno" : `Uđi za ${coins(battle.cost * stake)}${battle.currency === "gems" ? " gemova" : ""}`}
                                </button>
                              ) : !user ? (
                                <Link href="/login" className="btn-ghost">Prijavi se</Link>
                              ) : (
                                <span className="text-muted">Čeka igrača…</span>
                              )}
                            </div>
                          ) : phase === "rounds" && strips[seat] ? (
                            <div className="relative">
                              <Reel vertical items={strips[seat]} pool={cases.get(battle.case_ids[Math.min(revealed, rounds - 1)])?.items} goldMin={goldThreshold(cases.get(battle.case_ids[Math.min(revealed, rounds - 1)]))} winnerIndex={WIN} spinKey={spinKey} duration={(battle.fast ? FAST_SPIN : 3600) / speed} sound={seat === 0} goldSound onDone={onReelDone} />
                            </div>
                          ) : phase === "rounds" ? (
                            <div className="h-[260px] rounded-2xl border border-line md:h-[336px] bg-[linear-gradient(180deg,#0c0c1c,#07070f)]" />
                          ) : null}
                          <DropList className={teamMode ? "hidden md:block" : ""} drops={mine} items={items} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* mobitel, timski battle (2v2, 3v3…): osvojeni auti na dnu, da ne razdvajaju timove */}
      {teamMode && drops.some((d) => d.round <= revealed) && (
        <div className="space-y-3 md:hidden">
          <h2 className="font-display text-xl font-bold">Osvojeno</h2>
          {teams.map((seats, ti) => (
            <div key={ti} className="space-y-1.5">
              <div className="px-1 font-display text-base font-bold" style={{ color: TEAM_COLORS[ti % TEAM_COLORS.length] }}>Tim {ti + 1}</div>
              <div className="flex gap-1.5">
                {seats.map((seat) => (
                  <DropList key={seat} className="min-w-0 flex-1" drops={mineOf(seat)} items={items} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DropList({ drops, items, className = "" }: { drops: BattleDrop[]; items: Map<number, Item>; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {drops.map((d) => {
        const it = items.get(d.item_id);
        return it ? (
          <div key={d.round} className="drop-in relative">
            <ItemCard item={it} size="sm" />
          </div>
        ) : null;
      })}
    </div>
  );
}
