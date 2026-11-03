"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { getCases, randomFromCase } from "@/lib/data";
import type { CaseWithItems, Item } from "@/lib/types";
import { coins, levelProgress, xpForLevel } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { fmtLeft, useNow } from "@/lib/useNow";
import { useAuth } from "@/components/AuthProvider";
import { RequireAuth } from "@/components/RequireAuth";
import { CaseArt } from "@/components/CaseCard";
import { Reel } from "@/components/Reel";
import { ItemCard } from "@/components/ItemCard";
import { useCelebrate } from "@/components/WinOverlay";
import { useChat } from "@/components/Chat";

export default function RewardsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Nagrade i level</h1>
        <p className="text-sm text-muted">Besplatna dnevna kutija sa streakom, kiša coina u chatu i level kutije.</p>
      </div>
      <RequireAuth what="preuzimati nagrade">
        <Rewards />
      </RequireAuth>
    </div>
  );
}

const DAY = 86400_000;
const WIN = 50;

function Rewards() {
  const { profile, refresh } = useAuth();
  const celebrate = useCelebrate();
  const { setOpen: openChat } = useChat();
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const rpc = useRpc();
  const now = useNow();
  const [cases, setCases] = useState<CaseWithItems[]>([]);
  const [claims, setClaims] = useState<Record<number, string>>({});
  const [strip, setStrip] = useState<Item[]>([]);
  const [spinKey, setSpinKey] = useState(0);
  const [dailyWon, setDailyWon] = useState<Item | null>(null);
  const [spinning, setSpinning] = useState(false);

  const loadClaims = useCallback(async () => {
    const { data } = await createClient().from("level_case_claims").select("case_id, claimed_at");
    setClaims(Object.fromEntries((data ?? []).map((r) => [r.case_id, r.claimed_at])));
  }, []);
  useEffect(() => {
    getCases().then(setCases);
    loadClaims();
    createClient().rpc("get_settings").then(({ data }) => data && setSettings(data as Record<string, boolean>));
  }, [loadClaims]);

  if (!profile) return null;
  const daily = cases.filter((c) => c.case_type === "daily").sort((a, b) => (a.streak_min ?? 0) - (b.streak_min ?? 0));
  const levelCases = cases.filter((c) => c.case_type === "level").sort((a, b) => a.min_level - b.min_level);

  // dnevna (Europe/Zagreb kalendarski dan)
  const zgDate = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Europe/Zagreb" });
  const claimedToday = !!(now && profile.last_daily_at && zgDate(new Date(profile.last_daily_at).getTime()) === zgDate(now));
  const yesterday = now ? zgDate(now - DAY) : "";
  const streakAlive = profile.last_daily_at && (claimedToday || zgDate(new Date(profile.last_daily_at).getTime()) === yesterday);
  const nextStreak = claimedToday ? profile.daily_streak : streakAlive ? profile.daily_streak + 1 : 1;
  const currentDaily = [...daily].reverse().find((c) => (c.streak_min ?? 0) <= nextStreak) ?? daily[0];

  const claimDaily = async () => {
    const res = await rpc<{ streak: number; item: Item }>("claim_daily", {}, { silentRefresh: true });
    if (!res || !currentDaily) return;
    const it = { ...res.item, value: Number(res.item.value) };
    const s = Array.from({ length: 60 }, () => randomFromCase(currentDaily));
    s[WIN] = it;
    setStrip(s);
    setDailyWon(null);
    setSpinning(true);
    setSpinKey((k) => k + 1);
    setTimeout(() => setDailyWon(it), 0);
  };

  const claim = async (kind: "weekly" | "monthly") => {
    const res = await rpc<{ amount: number }>("claim_reward", { p_kind: kind });
    if (!res) return;
    celebrate({ title: kind === "weekly" ? "Tjedni drop" : "Mjesečni drop", subtitle: "Coini su na računu", amount: Number(res.amount), tier: kind === "monthly" ? 2 : 1 });
  };

  const left = (last: string | null, days: number) => (now && last ? new Date(last).getTime() + days * DAY - now : 0);
  const weeklyLeft = left(profile.last_weekly_at, 7);
  const monthlyLeft = left(profile.last_monthly_at, 30);
  const lp = levelProgress(profile.xp, profile.level);

  return (
    <div className="space-y-5">
      {/* LEVEL */}
      <section className="card flex flex-wrap items-center gap-5 p-5">
        <div className="grid h-20 w-20 place-items-center rounded-xl bg-accent2 font-display text-5xl font-black text-ink">{profile.level}</div>
        <div className="min-w-60 flex-1">
          <div className="flex justify-between text-sm">
            <span className="font-display font-semibold">Level {profile.level}</span>
            <span className="text-muted">{coins(profile.xp)} / {coins(lp.next)} XP</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-accent2 to-accent" style={{ width: `${lp.pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            1 odigrani coin = 1 XP. Svaki level-up donosi bonus (level × 10 coina), a novi leveli otključavaju level kutije, kišu coina (lvl 2+) i veće tjedne/mjesečne dropove.
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* DNEVNA */}
        <section className="card min-w-0 space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Besplatna dnevna kutija</h2>
            <span className="text-sm text-muted">Streak: <b className="text-accent">{claimedToday ? profile.daily_streak : streakAlive ? profile.daily_streak : 0} 🔥</b></span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => i + 1).map((d) => {
              const got = (claimedToday ? profile.daily_streak : streakAlive ? profile.daily_streak : 0) >= d;
              const tier = d >= 6 ? "Zlato" : d >= 3 ? "Srebro" : "Bronca";
              return (
                <div key={d} className={`rounded-md border p-2 text-center text-[11px] ${got ? "border-accent bg-accent/15 text-accent" : d === nextStreak && !claimedToday ? "border-white/40" : "border-line text-muted"}`}>
                  <div className="font-display text-sm font-bold">Dan {d}</div>
                  {tier}
                </div>
              );
            })}
          </div>
          {strip.length > 0 && <Reel items={strip} winnerIndex={WIN} spinKey={spinKey} duration={4500} onDone={() => { setSpinning(false); refresh(); if (dailyWon) celebrate({ title: "Dnevni drop!", subtitle: `Streak ${nextStreak} ${nextStreak === 1 ? "dan" : "dana"}`, items: [dailyWon], amount: dailyWon.value }); }} />}
          {dailyWon && !spinning && (
            <div className="pop flex items-center gap-3">
              <div className="w-40"><ItemCard item={dailyWon} size="sm" /></div>
              <div className="text-sm">Osvojio si <b>{dailyWon.brand} {dailyWon.model}</b>! <Link href="/profile" className="text-accent2 underline">Otvori garažu</Link></div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {currentDaily && <CaseArt c={currentDaily} className="h-16 w-28 [&_svg]:h-10 [&_svg]:w-24" />}
            <div className="flex-1 text-sm text-muted">
              Danas: <b className="text-fg">{currentDaily?.name}</b>. Propusti dan i streak kreće ispočetka.
            </div>
            <button className="btn-primary" disabled={claimedToday || spinning} onClick={claimDaily}>
              {claimedToday ? `Sutra opet (${now ? fmtLeft(new Date(zgDate(now + DAY) + "T00:00:00+01:00").getTime() - now) : "—"})` : "Otvori besplatno"}
            </button>
          </div>
        </section>

        {/* DROPOVI */}
        <section className="min-w-0 space-y-3">
          {settings.coin_rain !== false && (
            <RewardRow title="Kiša coina" desc="Pada iznenada u chatu. Kad počne, imaš par minuta da se pridružiš dok ima mjesta i podijeliš pot s ostalima (level 2+). Bakšišem povećavaš pot." btn="Otvori chat" onClick={() => openChat(true)} />
          )}
          {settings.instant_drops && <RewardRow title="Instant dropovi" desc="Svako otvaranje kutije ima 4% šanse za bonus od 10–40% cijene kutije." btn="Automatski" disabled />}
          {settings.weekly_drop && (
            <RewardRow title="Tjedni drop" desc={`${coins(25 + profile.level * 10)} coina · min. 100 XP`} disabled={weeklyLeft > 0 || profile.xp < 100}
              btn={profile.xp < 100 ? "Treba 100 XP" : weeklyLeft > 0 ? fmtLeft(weeklyLeft) : "Preuzmi"} onClick={() => claim("weekly")} />
          )}
          {settings.monthly_drop && (
            <RewardRow title="Mjesečni drop" desc={`${coins(100 + profile.level * 40)} coina · min. 500 XP`} disabled={monthlyLeft > 0 || profile.xp < 500}
              btn={profile.xp < 500 ? "Treba 500 XP" : monthlyLeft > 0 ? fmtLeft(monthlyLeft) : "Preuzmi"} onClick={() => claim("monthly")} />
          )}
        </section>
      </div>

      {/* LEVEL KUTIJE */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Level kutije <span className="text-sm font-normal text-muted">— besplatno svaka 24h</span></h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {levelCases.map((c) => {
            const locked = profile.level < c.min_level;
            const last = claims[c.id];
            const wait = now && last ? new Date(last).getTime() + DAY - now : 0;
            return (
              <Link key={c.id} href={`/cases/${c.slug}`} className={`card p-3 transition hover:border-white/25 ${locked ? "opacity-50" : ""}`}>
                <CaseArt c={c} className="h-24" />
                <div className="mt-2 font-display text-sm font-semibold">{c.name}</div>
                <div className="text-xs text-muted">{locked ? `🔒 Level ${c.min_level} (još ${coins(xpForLevel(c.min_level) - profile.xp)} XP)` : wait > 0 ? `Za ${fmtLeft(wait)}` : <span className="text-emerald-400">Dostupno!</span>}</div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function RewardRow({ title, desc, btn, disabled, onClick }: { title: string; desc: string; btn: string; disabled?: boolean; onClick?: () => void }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="font-display font-semibold">{title}</div>
        <div className="text-xs text-muted">{desc}</div>
      </div>
      <button className="btn-primary shrink-0" disabled={disabled} onClick={onClick}>{btn}</button>
    </div>
  );
}
