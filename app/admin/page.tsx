"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { getItems, resetDataCache } from "@/lib/data";
import { photoQuery, photoSource, photosEnabled } from "@/lib/carPhoto";
import { CarImage } from "@/components/CarImage";
import { ItemCard } from "@/components/ItemCard";
import type { Item } from "@/lib/types";
import { coins, errMsg } from "@/lib/format";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { useNow } from "@/lib/useNow";
import { loadLimitRows, type LimitRow } from "@/lib/limits";
import { CHAT_COLORS, CHAT_EFFECTS, ChatName, type ChatStyle } from "@/components/ChatName";

type U = {
  id: string; username: string; email: string | null; balance: number; gems: number; level: number; xp: number;
  role: string; luck: number; banned: boolean; note: string | null; aff_code: string | null; aff_rate: number | null;
  aff_earned: number | null; referrals: number; referred_by: string | null; created_at: string; last_game: string | null;
};
type Stats = {
  users: number; new_24h: number; active_24h: number; wagered_24h: number; payout_24h: number; rewards_24h: number;
  total_balance: number; open_battles: number; banned: number; by_game: { game: string; rounds: number; wager: number; payout: number }[];
};
type Detail = {
  inventory_count: number; inventory_value: number; wagered: number; payout: number;
  chat: { color: string | null; effect: string; badge: string | null; role: string } | null;
  logs: { game: string; wager: number; payout: number; created_at: string }[];
  admin_log: { action: string; details: Record<string, unknown> | null; created_at: string; admin: string }[];
};
type LogRow = { action: string; details: Record<string, unknown> | null; created_at: string; admin: string; target: string };

const sb = () => createClient();
const dt = (s: string | null) => (s ? new Date(s).toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" }) : "—");


type Tab = "stats" | "users" | "settings" | "photos" | "log";
const TABS: { k: Tab; l: string; d: string; icon: string }[] = [
  { k: "stats", l: "Pregled", d: "Brojke zadnja 24 h", icon: "M4 19V9m6 10V5m6 14v-7m4 7H2" },
  { k: "users", l: "Korisnici", d: "Stanje, kontrole, chat", icon: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm11.5 9v-1a4 4 0 0 0-3-3.87M16 3.13a3.5 3.5 0 0 1 0 6.75" },
  { k: "settings", l: "Postavke", d: "Značajke, limiti, kiša", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" },
  { k: "photos", l: "Slike", d: "Fotografije auta", icon: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15.5 9.5h.01" },
  { k: "log", l: "Admin log", d: "Tko je što mijenjao", icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
];

const ACTION: Record<string, string> = {
  adjust: "Promjena stanja", set_balance: "Postavljeno stanje", controls: "Kontrole", level: "Level", affiliate: "Affiliate",
  give_item: "Dodan auto", reset_cooldowns: "Reset nagrada", chat_style: "Izgled u chatu", chat_delete: "Obrisana poruka",
  chat_clear: "Očišćen chat", setting: "Postavka", limit: "Limit", trigger_rain: "Kiša pokrenuta", jackpot_draw_now: "Jackpot izvučen ranije",
  item_photo: "Fotografija auta",
};
const KEY: Record<string, string> = {
  balance: "stanje", balance_old: "prije", gems: "gemovi", gems_old: "gemovi prije", reason: "razlog", luck: "sreća", banned: "blokiran",
  role: "uloga", note: "bilješka", level: "level", code: "kod", rate: "provizija", key: "ključ", value: "vrijednost", old: "prije",
  enabled: "uključeno", pot: "pot", slots: "mjesta", minutes: "min", body: "poruka", username: "korisnik", deleted: "obrisano",
  round: "runda", color: "boja", effect: "efekt", badge: "oznaka", item: "auto", photo: "fotografija",
};
const MONEY = new Set(["balance", "balance_old", "gems", "gems_old", "pot"]);
function fmtDetails(d: Record<string, unknown> | null) {
  if (!d) return "";
  return Object.entries(d)
    .filter(([, v]) => v !== null && v !== "" && v !== undefined)
    .map(([k, v]) => `${KEY[k] ?? k}: ${typeof v === "number" ? (MONEY.has(k) ? coins(v) : String(v)) : typeof v === "boolean" ? (v ? "da" : "ne") : String(v)}`)
    .join(" · ");
}
const initials = (n: string) => n.slice(0, 2).toUpperCase();
const hue = (n: string) => [...n].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

function Icon({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("users");
  // osvježavanje: gumb + automatski svakih 10 s
  const [tick, setTick] = useState(0);
  const [auto, setAuto] = useState(true);
  const [at, setAt] = useState<Date | null>(null);
  useEffect(() => {
    setAt(new Date());
  }, [tick]);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setTick((x) => x + 1), 10_000);
    return () => clearInterval(t);
  }, [auto]);
  if (loading) return <div className="card h-40 animate-pulse" />;
  if (!isAdmin)
    return (
      <div className="card p-10 text-center">
        <div className="font-display text-3xl font-black">Nemaš pristup</div>
        <p className="mt-2 text-muted">Admin panel je dostupan samo administratorima.</p>
      </div>
    );
  const cur = TABS.find((t) => t.k === tab)!;
  return (
    <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-3 hidden lg:block">
          <div className="font-display text-3xl font-extrabold">Admin</div>
          <div className="text-sm text-muted">Upravljanje stranicom</div>
        </div>
        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible" role="tablist" aria-label="Admin sekcije">
          {TABS.map((t) => (
            <button
              key={t.k}
              role="tab"
              aria-selected={tab === t.k}
              onClick={() => setTab(t.k)}
              className={`group flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-2 text-left transition lg:gap-3 lg:px-3 lg:py-2.5 ${tab === t.k ? "bg-accent/15 text-fg ring-1 ring-accent/50" : "text-muted hover:bg-white/[.04] hover:text-fg"}`}
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg lg:h-8 lg:w-8 ${tab === t.k ? "bg-accent text-ink" : "bg-white/[.05]"}`}>
                <Icon d={t.icon} />
              </span>
              <span>
                <span className="block font-display text-[15px] font-bold leading-tight">{t.l}</span>
                <span className="hidden text-xs text-muted lg:block">{t.d}</span>
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="mr-auto font-display text-2xl font-extrabold sm:text-4xl">{cur.l}</h1>
          <span className="hidden text-xs text-muted tabular-nums sm:inline">{at ? `Osvježeno ${at.toLocaleTimeString("hr-HR")}` : ""}</span>
          <button role="switch" aria-checked={auto} onClick={() => setAuto(!auto)} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm text-muted hover:text-fg">
            <span className={`flex h-4 w-7 items-center rounded-full p-0.5 transition ${auto ? "bg-emerald-400" : "bg-line"}`}>
              <span className={`h-3 w-3 rounded-full bg-white transition ${auto ? "translate-x-3" : ""}`} />
            </span>
            Auto 10 s
          </button>
          <button className="btn-ghost py-1.5" onClick={() => setTick((x) => x + 1)}>
            <Icon d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /> Osvježi
          </button>
        </div>
        {tab === "stats" && <StatsTab tick={tick} />}
        {tab === "users" && <UsersTab tick={tick} />}
        {tab === "settings" && <SettingsTab />}
        {tab === "photos" && <PhotosTab />}
        {tab === "log" && <LogTab tick={tick} />}
      </div>
    </div>
  );
}

/* ---------------- PREGLED ---------------- */

function StatsTab({ tick }: { tick: number }) {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    sb().rpc("admin_stats").then(({ data }) => setS(data as Stats));
  }, [tick]);
  if (!s) return <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="card h-28 animate-pulse" />)}</div>;
  const house = Number(s.wagered_24h) - Number(s.payout_24h);
  const maxW = Math.max(1, ...s.by_game.map((g) => Number(g.wager)));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <Kpi l="Korisnika" v={String(s.users)} sub={`+${s.new_24h} novih u 24 h`} icon={TABS[1].icon} />
        <Kpi l="Aktivni u 24 h" v={String(s.active_24h)} sub={`${s.open_battles} otvorenih battleova · ${s.banned} blokiranih`} icon="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
        <Kpi l="Odigrano u 24 h" v={coins(s.wagered_24h)} sub={`isplaćeno ${coins(s.payout_24h)}`} icon="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        <Kpi l="Kuća u 24 h" v={`${house >= 0 ? "+" : ""}${coins(house)}`} sub={`nagrade ${coins(s.rewards_24h)} · kod igrača ${coins(s.total_balance)}`} tone={house >= 0 ? "good" : "bad"} icon="M3 10.5 12 3l9 7.5V21H3z" />
      </div>
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="card p-4">
          <h2 className="mb-3 font-display text-lg font-bold">Igre u zadnja 24 h</h2>
          {s.by_game.length === 0 && <p className="text-sm text-muted">Još nema igara danas.</p>}
          <div className="space-y-2.5">
            {s.by_game.map((g) => {
              const rtp = Number(g.wager) > 0 ? (Number(g.payout) / Number(g.wager)) * 100 : null;
              return (
                <div key={g.game} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 text-sm sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:gap-3">
                  <span className="truncate font-semibold capitalize">{g.game}</span>
                  <div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[.06]">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,#ff2b4e,#ffb547)]" style={{ width: `${(Number(g.wager) / maxW) * 100}%` }} />
                    </div>
                    <div className="mt-1 text-xs text-muted tabular-nums">{g.rounds} rundi · uloženo {coins(g.wager)} · isplaćeno {coins(g.payout)}</div>
                  </div>
                  <span className={`w-14 text-right font-display font-bold tabular-nums sm:w-16 ${rtp === null ? "text-muted" : rtp > 100 ? "text-red-300" : "text-emerald-300"}`} title="Povrat igračima">{rtp === null ? "—" : `${rtp.toFixed(1)}%`}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="space-y-4">
          <RainTrigger />
          <JackpotNow />
        </div>
      </div>
    </div>
  );
}

function Kpi({ l, v, sub, tone, icon }: { l: string; v: string; sub?: string; tone?: "good" | "bad"; icon: string }) {
  return (
    <div className="card relative min-w-0 overflow-hidden p-3 sm:p-4">
      <div className="flex items-center gap-2 text-xs text-muted sm:text-sm">
        <span className="hidden h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[.05] sm:grid"><Icon d={icon} className="h-4 w-4" /></span>
        {l}
      </div>
      <div title={v} className={`mt-1.5 truncate font-display text-xl font-extrabold tabular-nums sm:mt-2 sm:text-2xl 2xl:text-3xl ${tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : ""}`}>{v}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function JackpotNow() {
  const toast = useToast();
  const drawNow = async () => {
    if (!window.confirm("Završiti trenutnu jackpot rundu i izvući pobjednika odmah?")) return;
    const { error } = await sb().rpc("admin_jackpot_draw_now");
    if (error) return toast(errMsg(error), "error");
    toast("Jackpot runda je izvučena.", "success");
  };
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-lg font-bold">Jackpot</h3>
        <p className="text-sm text-muted">Završi trenutnu rundu i izvuci pobjednika odmah.</p>
      </div>
      <button className="btn-ghost shrink-0" onClick={drawNow}>Izvuci sada</button>
    </div>
  );
}

function RainTrigger() {
  const toast = useToast();
  const [pot, setPot] = useState("200");
  const [slots, setSlots] = useState("20");
  const [mins, setMins] = useState("3");
  const go = async () => {
    const { error } = await sb().rpc("admin_trigger_rain", { p_pot: Number(pot), p_slots: Number(slots), p_minutes: Number(mins) });
    if (error) return toast(errMsg(error), "error");
    toast("Kiša je pokrenuta i objavljena u chatu.", "success");
  };
  return (
    <div className="card p-4">
      <h3 className="font-display text-lg font-bold">Pokreni kišu coina</h3>
      <p className="mb-3 text-sm text-muted">Pot plaća kuća i dijeli se jednako među igračima koji se pridruže.</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-muted">Pot<input className="input mt-1" type="number" min={1} value={pot} onChange={(e) => setPot(e.target.value)} /></label>
        <label className="text-xs text-muted">Mjesta<input className="input mt-1" type="number" min={1} max={500} value={slots} onChange={(e) => setSlots(e.target.value)} /></label>
        <label className="text-xs text-muted">Minuta<input className="input mt-1" type="number" min={1} max={30} value={mins} onChange={(e) => setMins(e.target.value)} /></label>
      </div>
      <button className="btn-primary mt-3 w-full" onClick={go}>Pokreni kišu</button>
    </div>
  );
}

/* ---------------- POSTAVKE ---------------- */

const SETTING_LABELS: Record<string, [string, string]> = {
  coin_rain: ["Kiša coina u chatu", "Nasumične kiše s potom za igrače u chatu"],
  instant_drops: ["Instant dropovi", "4 % šanse za bonus coine kod otvaranja kutija"],
  weekly_drop: ["Tjedni drop", "Nagrada jednom tjedno na stranici Nagrade"],
  monthly_drop: ["Mjesečni drop", "Nagrada jednom mjesečno na stranici Nagrade"],
};
const LIMIT_GROUPS: [string, string[]][] = [
  ["Kutije i battle", ["case_max_open", "battle_max_cases"]],
  ["Jackpot", ["jackpot_round_sec", "jackpot_min_bet", "jackpot_max_bet", "jackpot_fee_pct"]],
  ["Rulet i Crash", ["rulet_min_bet", "rulet_max_bet", "crash_min_bet", "crash_max_bet", "crash_bet_sec"]],
];

function SettingsTab() {
  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <LimitsBox />
      <div className="space-y-4">
        <SettingsBox />
        <RainTrigger />
      </div>
    </div>
  );
}

function SettingsBox() {
  const toast = useToast();
  const [st, setSt] = useState<Record<string, boolean>>({});
  useEffect(() => {
    sb().rpc("get_settings").then(({ data }) => data && setSt(data as Record<string, boolean>));
  }, []);
  const toggle = async (k: string) => {
    const v = !(st[k] ?? true);
    const { error } = await sb().rpc("admin_set_setting", { p_key: k, p_enabled: v });
    if (error) return toast(errMsg(error), "error");
    setSt((x) => ({ ...x, [k]: v }));
    toast(`${SETTING_LABELS[k]?.[0] ?? k}: ${v ? "uključeno" : "isključeno"}`, "success");
  };
  return (
    <div className="card p-4">
      <h2 className="mb-2 font-display text-lg font-bold">Značajke</h2>
      <div className="divide-y divide-line/70">
        {Object.keys(SETTING_LABELS).map((k) => {
          const on = st[k] ?? true;
          return (
            <button key={k} role="switch" aria-checked={on} onClick={() => toggle(k)} className="flex w-full items-center gap-3 py-2.5 text-left">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{SETTING_LABELS[k][0]}</span>
                <span className="block text-xs text-muted">{SETTING_LABELS[k][1]}</span>
              </span>
              <span className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${on ? "bg-emerald-400" : "bg-line"}`}>
                <span className={`h-5 w-5 rounded-full bg-white shadow transition ${on ? "translate-x-5" : ""}`} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LimitsBox() {
  const toast = useToast();
  const [rows, setRows] = useState<LimitRow[]>([]);
  const [edit, setEdit] = useState<Record<string, string>>({});
  useEffect(() => {
    loadLimitRows().then((r) => {
      setRows(r);
      setEdit(Object.fromEntries(r.map((x) => [x.key, String(x.value)])));
    });
  }, []);
  const save = async (k: string) => {
    const v = Number(edit[k]);
    const { error } = await sb().rpc("admin_set_limit", { p_key: k, p_value: v });
    if (error) return toast(errMsg(error), "error");
    setRows((rs) => rs.map((r) => (r.key === k ? { ...r, value: v } : r)));
    toast("Limit je spremljen.", "success");
  };
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const grouped = LIMIT_GROUPS.map(([g, keys]) => [g, keys.map((k) => byKey.get(k)).filter(Boolean) as LimitRow[]] as const);
  const known = new Set(LIMIT_GROUPS.flatMap(([, k]) => k));
  const other = rows.filter((r) => !known.has(r.key));
  if (other.length) grouped.push(["Ostalo", other] as const);
  return (
    <div className="@container card p-4">
      <h2 className="font-display text-lg font-bold">Limiti</h2>
      <p className="mb-3 text-sm text-muted">Vrijede odmah, i na serveru i na stranici.</p>
      <div className="space-y-4">
        {grouped.map(([g, list]) =>
          list.length ? (
            <div key={g}>
              <div className="mb-1.5 text-xs font-semibold text-muted">{g}</div>
              <div className="grid gap-2 @2xl:grid-cols-2">
                {list.map((r) => {
                  const changed = edit[r.key] !== undefined && Number(edit[r.key]) !== r.value;
                  return (
                    <div key={r.key} className={`flex flex-wrap items-center gap-2 rounded-xl border p-2.5 transition min-[420px]:flex-nowrap ${changed ? "border-accent/60 bg-accent/[.05]" : "border-line"}`}>
                      <label htmlFor={`lim-${r.key}`} className="min-w-0 basis-full text-sm min-[420px]:basis-0 min-[420px]:flex-1">
                        {r.label}
                        <span className="block text-xs text-muted">{r.min_value} – {r.max_value}</span>
                      </label>
                      <input id={`lim-${r.key}`} type="number" className="input min-w-0 flex-1 py-1.5 text-right tabular-nums min-[420px]:w-24 min-[420px]:flex-none" min={r.min_value} max={r.max_value} value={edit[r.key] ?? ""} onChange={(e) => setEdit((x) => ({ ...x, [r.key]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && changed && save(r.key)} />
                      <button className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold transition ${changed ? "bg-accent text-ink" : "pointer-events-none text-muted/50"}`} disabled={!changed} onClick={() => save(r.key)}>Spremi</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

/* ---------------- KORISNICI ---------------- */

type Filter = "all" | "admin" | "banned" | "active";
type Sort = "new" | "balance" | "level" | "last";

function UsersTab({ tick }: { tick: number }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<U[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("new");
  const now = useNow(60_000) ?? 0;
  const load = useCallback(async () => {
    const { data, error } = await sb().rpc("admin_users", { p_search: q, p_limit: 200 });
    if (error) return toast(errMsg(error), "error");
    setUsers((data ?? []) as U[]);
  }, [q, toast]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load, tick]);

  const list = useMemo(() => {
    const day = now - 86_400_000;
    const f = users.filter((u) =>
      filter === "admin" ? u.role === "admin" : filter === "banned" ? u.banned : filter === "active" ? !!u.last_game && new Date(u.last_game).getTime() > day : true
    );
    const val = (u: U) => (sort === "balance" ? Number(u.balance) : sort === "level" ? u.level : sort === "last" ? (u.last_game ? new Date(u.last_game).getTime() : 0) : new Date(u.created_at).getTime());
    return [...f].sort((a, b) => val(b) - val(a));
  }, [users, filter, sort, now]);
  const current = users.find((u) => u.id === sel) ?? null;
  // ladica na mobitelu/tabletu: stranica ispod se ne skrola
  const drawerOpen = !!current;
  useEffect(() => {
    if (!drawerOpen || window.matchMedia("(min-width: 1536px)").matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);
  const counts = { all: users.length, admin: users.filter((u) => u.role === "admin").length, banned: users.filter((u) => u.banned).length };

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_460px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-52 flex-1">
            <Icon d="m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-10" placeholder="Traži po imenu ili emailu" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Traži korisnike" />
          </div>
          <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Poredak">
            <option value="new">Najnoviji</option>
            <option value="balance">Najveće stanje</option>
            <option value="level">Najviši level</option>
            <option value="last">Zadnja igra</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([["all", `Svi (${counts.all})`], ["active", "Aktivni 24 h"], ["admin", `Admini (${counts.admin})`], ["banned", `Blokirani (${counts.banned})`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${filter === k ? "border-accent bg-accent/15 text-accent" : "border-line text-muted hover:text-fg"}`}>{l}</button>
          ))}
        </div>
        <div className="@container card divide-y divide-line/70 overflow-hidden">
          {list.map((u) => (
            <button
              key={u.id}
              onClick={() => setSel(u.id)}
              className={`grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left transition @xl:grid-cols-[2.5rem_minmax(0,1fr)_7rem_6rem_4.5rem] ${sel === u.id ? "bg-accent/10" : "hover:bg-white/[.03]"}`}
            >
              <span className="grid h-10 w-10 place-items-center rounded-full font-display text-sm font-extrabold text-ink" style={{ background: `hsl(${hue(u.username)} 80% 70%)` }}>{initials(u.username)}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">{u.username}</span>
                  {u.role === "admin" && <span className="rounded bg-accent2/20 px-1.5 text-[11px] font-bold text-accent2">admin</span>}
                  {u.banned && <span className="rounded bg-red-500/20 px-1.5 text-[11px] font-bold text-red-300">blokiran</span>}
                  {Number(u.luck) !== 1 && <span className={`rounded px-1.5 text-[11px] font-bold ${Number(u.luck) > 1 ? "bg-emerald-400/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{Number(u.luck).toFixed(2)}×</span>}
                </span>
                <span className="block truncate text-xs text-muted">{u.email} · lvl {u.level}</span>
              </span>
              <span className="text-right font-display font-bold tabular-nums text-accent">{coins(u.balance)}</span>
              <span className="hidden text-right text-sm tabular-nums text-emerald-300 @xl:block">{coins(u.gems)}</span>
              <span className="hidden text-right text-xs text-muted @xl:block">{u.last_game ? new Date(u.last_game).toLocaleDateString("hr-HR", { day: "numeric", month: "numeric" }) : "—"}</span>
            </button>
          ))}
          {list.length === 0 && <div className="p-8 text-center text-sm text-muted">Nema korisnika za ovu pretragu.</div>}
        </div>
      </div>
      {current ? (
        <>
          {/* uži ekrani: uređivanje u bočnoj ladici; široki: stupac desno */}
          <button aria-label="Zatvori" onClick={() => setSel(null)} className="fixed inset-0 z-[64] bg-black/60 backdrop-blur-sm 2xl:hidden" />
          <div className="fixed inset-y-0 right-0 z-[65] w-full max-w-[480px] overflow-y-auto overscroll-contain bg-ink p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_0_80px_rgba(0,0,0,.8)] 2xl:static 2xl:z-auto 2xl:max-w-none 2xl:overflow-visible 2xl:bg-transparent 2xl:p-0 2xl:shadow-none">
            <UserEditor key={current.id} u={current} onChanged={load} tick={tick} onClose={() => setSel(null)} />
          </div>
        </>
      ) : (
        <div className="card hidden h-64 flex-col items-center justify-center gap-2 p-6 text-center text-muted 2xl:flex">
          <Icon d={TABS[1].icon} className="h-8 w-8" />
          Odaberi korisnika s popisa.
        </div>
      )}
    </div>
  );
}

type EdTab = "money" | "controls" | "chat" | "aff" | "activity";

function UserEditor({ u, onChanged, tick, onClose }: { u: U; onChanged: () => void; tick: number; onClose: () => void }) {
  const toast = useToast();
  const { user, refresh } = useAuth();
  const [d, setD] = useState<Detail | null>(null);
  const [t, setT] = useState<EdTab>("money");
  const [luck, setLuck] = useState(Number(u.luck));
  const [banned, setBanned] = useState(u.banned);
  const [role, setRole] = useState(u.role);
  const [note, setNote] = useState(u.note ?? "");
  const [level, setLevel] = useState(String(u.level));
  const [affCode, setAffCode] = useState(u.aff_code ?? "");
  const [affRate, setAffRate] = useState(String(((u.aff_rate ?? 0.05) * 100).toFixed(1)));

  const loadDetail = useCallback(async () => {
    const { data } = await sb().rpc("admin_user_detail", { p_user: u.id });
    setD(data as Detail);
  }, [u.id]);
  useEffect(() => {
    loadDetail();
  }, [loadDetail, tick]);

  const call = async (fn: string, args: Record<string, unknown>, ok: string) => {
    const { error } = await sb().rpc(fn, args);
    if (error) {
      toast(errMsg(error), "error");
      return false;
    }
    toast(ok, "success");
    onChanged();
    loadDetail();
    if (u.id === user?.id) refresh();
    return true;
  };

  const luckLabel = luck === 1 ? "normalno" : luck > 1 ? "više sreće" : "manje sreće";
  const net = d ? Number(d.payout) - Number(d.wagered) : 0;
  const TABS_ED: [EdTab, string][] = [["money", "Novac"], ["controls", "Kontrole"], ["chat", "Chat"], ["aff", "Affiliate"], ["activity", "Aktivnost"]];

  return (
    <div className="card self-start overflow-hidden 2xl:sticky 2xl:top-24">
      <div className="relative border-b border-line bg-[radial-gradient(120%_120%_at_0%_0%,#ffb5471a,transparent_60%)] p-4">
        <button onClick={onClose} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-fg" aria-label="Zatvori">✕</button>
        <div className="flex items-center gap-3 pr-8">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-lg font-extrabold text-ink" style={{ background: `hsl(${hue(u.username)} 80% 70%)` }}>{initials(u.username)}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-display text-xl font-extrabold sm:text-2xl">{u.username}</span>
              {u.role === "admin" && <span className="rounded bg-accent2/20 px-1.5 text-xs font-bold text-accent2">admin</span>}
              {u.banned && <span className="rounded bg-red-500/20 px-1.5 text-xs font-bold text-red-300">blokiran</span>}
            </div>
            <div className="truncate text-xs text-muted">{u.email} · od {dt(u.created_at)}</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat l="Stanje" v={coins(u.balance)} cls="text-accent" />
          <Stat l="Gemovi" v={coins(u.gems)} cls="text-emerald-300" />
          <Stat l="Level" v={String(u.level)} />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line px-2 pt-2" role="tablist">
        {TABS_ED.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={t === k} onClick={() => setT(k)} className={`shrink-0 rounded-t-lg border-b-2 px-3 py-2 text-sm font-semibold transition ${t === k ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}>{l}</button>
        ))}
      </div>

      <div className="space-y-4 p-4 2xl:max-h-[calc(100dvh-20rem)] 2xl:overflow-y-auto">
        {t === "money" && <MoneyEditor u={u} call={call} />}

        {t === "controls" && (
          <>
            <Block title="Sreća" hint="Utječe na kutije, battle dropove, dnevnu kutiju i upgrader. Korisnik je ne vidi.">
              <div className="flex items-center gap-3">
                <input id="luck" type="range" min={0.25} max={5} step={0.05} value={luck} onChange={(e) => setLuck(Number(e.target.value))} className="flex-1 accent-orange-500" aria-label="Sreća" />
                <span className={`w-24 text-right text-xs font-semibold tabular-nums sm:w-28 sm:text-sm ${luck > 1 ? "text-emerald-300" : luck < 1 ? "text-red-300" : "text-muted"}`}>{luck.toFixed(2)}× {luckLabel}</span>
              </div>
              <div className="flex gap-1.5">
                {[0.5, 1, 1.5, 2].map((v) => (
                  <button key={v} onClick={() => setLuck(v)} className={`rounded-md border px-2 py-0.5 text-xs ${luck === v ? "border-accent text-accent" : "border-line text-muted"}`}>{v}×</button>
                ))}
              </div>
            </Block>
            <Block title="Status i uloga">
              <div className="grid grid-cols-2 gap-2">
                <button role="switch" aria-checked={banned} onClick={() => setBanned(!banned)} className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${banned ? "border-red-400/60 bg-red-500/10 text-red-300" : "border-line text-muted"}`}>
                  {banned ? "Blokiran" : "Nije blokiran"}
                </button>
                <select className="input" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Uloga">
                  <option value="user">Korisnik</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <textarea className="input min-h-16" placeholder="Interna bilješka (vide je samo admini)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Bilješka" />
              <button className="btn-primary w-full" onClick={() => call("admin_set_controls", { p_user: u.id, p_luck: luck, p_banned: banned, p_role: role, p_note: note || null }, "Postavke su spremljene.")}>Spremi kontrole</button>
            </Block>
            <Block title="Level i nagrade">
              <div className="flex flex-wrap gap-2">
                <input className="input w-24" type="number" min={1} max={500} value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level" />
                <button className="btn-ghost" onClick={() => call("admin_set_level", { p_user: u.id, p_level: Number(level) }, "Level je postavljen.")}>Postavi</button>
                <button className="btn-ghost ml-auto" onClick={() => call("admin_reset_cooldowns", { p_user: u.id }, "Nagrade su ponovno dostupne.")}>Resetiraj nagrade</button>
              </div>
            </Block>
          </>
        )}

        {t === "chat" && (d ? <ChatStyleEditor key={u.id} u={u} init={d.chat} save={(args, ok) => call("admin_set_chat_style", { p_user: u.id, ...args }, ok)} /> : <div className="h-40 animate-pulse rounded-xl bg-panel2" />)}

        {t === "aff" && (
          <Block title="Affiliate" hint={`Zaradio ukupno ${coins(u.aff_earned ?? 0)} · ${u.referrals} pozvanih${u.referred_by ? ` · pozvao ga je ${u.referred_by}` : ""}`}>
            <div className="flex gap-2">
              <input className="input" value={affCode} onChange={(e) => setAffCode(e.target.value.toLowerCase())} aria-label="Affiliate kod" />
              <div className="relative w-28 shrink-0">
                <input className="input pr-7" type="number" step="0.5" min={0} max={50} value={affRate} onChange={(e) => setAffRate(e.target.value)} aria-label="Provizija u postocima" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
              </div>
            </div>
            <button className="btn-primary w-full" onClick={() => call("admin_set_affiliate", { p_user: u.id, p_code: affCode, p_rate: Number(affRate) / 100 }, "Affiliate je spremljen.")}>Spremi affiliate</button>
          </Block>
        )}

        {t === "activity" && (
          <>
            {d && (
              <div className="grid grid-cols-3 gap-2">
                <Stat l="Odigrao" v={coins(d.wagered)} />
                <Stat l="Dobio" v={coins(d.payout)} />
                <Stat l="Neto" v={`${net >= 0 ? "+" : ""}${coins(net)}`} cls={net >= 0 ? "text-emerald-300" : "text-red-300"} />
              </div>
            )}
            <Block title="Zadnje igre">
              {d ? (
                <ul className="divide-y divide-line/60 text-sm">
                  {d.logs.map((l, i) => {
                    const n = Number(l.payout) - Number(l.wager);
                    return (
                      <li key={i} className="flex items-center gap-2 py-1.5">
                        <span className="w-20 font-semibold capitalize">{l.game}</span>
                        <span className="flex-1 text-xs text-muted">{dt(l.created_at)}</span>
                        <span className={`font-display font-bold tabular-nums ${n >= 0 ? "text-emerald-300" : "text-red-300"}`}>{n >= 0 ? "+" : ""}{coins(n)}</span>
                      </li>
                    );
                  })}
                  {d.logs.length === 0 && <li className="py-2 text-muted">Nema igara.</li>}
                </ul>
              ) : (
                <div className="h-24 animate-pulse rounded-xl bg-panel2" />
              )}
            </Block>
            <Block title="Zadnji dropovi">
              <UserGarage userId={u.id} tick={tick} />
            </Block>
            {d && d.admin_log.length > 0 && (
              <Block title="Admin promjene">
                <ul className="space-y-1.5 text-xs">
                  {d.admin_log.map((l, i) => (
                    <li key={i} className="rounded-lg bg-white/[.03] px-2.5 py-1.5">
                      <span className="font-semibold">{ACTION[l.action] ?? l.action}</span> <span className="text-muted">· {l.admin} · {dt(l.created_at)}</span>
                      <div className="text-muted">{fmtDetails(l.details)}</div>
                    </li>
                  ))}
                </ul>
              </Block>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Novac: dodaj/oduzmi ili postavi točan iznos (coini i gemovi)
function MoneyEditor({ u, call }: { u: U; call: (fn: string, args: Record<string, unknown>, ok: string) => Promise<boolean> }) {
  const [mode, setMode] = useState<"add" | "set">("add");
  const [cur, setCur] = useState<"balance" | "gems">("balance");
  const [val, setVal] = useState("");
  const [reason, setReason] = useState("");
  const now = Number(cur === "balance" ? u.balance : u.gems);
  const n = Number(val.replace(",", "."));
  const valid = val.trim() !== "" && Number.isFinite(n) && (mode === "set" ? n >= 0 : n !== 0);
  const after = mode === "set" ? n : Math.max(0, now + n);
  const apply = async () => {
    if (!valid) return;
    const ok =
      mode === "set"
        ? await call("admin_set_balance", { p_user: u.id, p_balance: cur === "balance" ? n : null, p_gems: cur === "gems" ? n : null, p_reason: reason || null }, cur === "balance" ? "Stanje je postavljeno." : "Gemovi su postavljeni.")
        : await call("admin_adjust", { p_user: u.id, p_balance: cur === "balance" ? n : 0, p_gems: cur === "gems" ? n : 0, p_reason: reason || null }, "Stanje je promijenjeno.");
    if (ok) setVal("");
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(["balance", "gems"] as const).map((c) => (
          <button key={c} onClick={() => setCur(c)} className={`rounded-xl border p-3 text-left transition ${cur === c ? (c === "gems" ? "border-emerald-400/60 bg-emerald-400/10" : "border-accent/60 bg-accent/10") : "border-line hover:border-white/20"}`}>
            <div className="text-xs text-muted">{c === "gems" ? "Gemovi" : "Coini"}</div>
            <div className={`font-display text-xl font-extrabold tabular-nums ${c === "gems" ? "text-emerald-300" : "text-accent"}`}>
              <span className={c === "gems" ? "gem" : "coin"} /> {coins(c === "gems" ? u.gems : u.balance)}
            </div>
          </button>
        ))}
      </div>
      <div className="flex rounded-xl border border-line p-1" role="radiogroup" aria-label="Način">
        {([["add", "Dodaj / oduzmi"], ["set", "Postavi točno"]] as const).map(([k, l]) => (
          <button key={k} role="radio" aria-checked={mode === k} onClick={() => { setMode(k); setVal(k === "set" ? String(now) : ""); }} className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition ${mode === k ? "bg-white/10 text-fg" : "text-muted"}`}>{l}</button>
        ))}
      </div>
      <div>
        <input className="input text-lg tabular-nums" inputMode="decimal" placeholder={mode === "add" ? "npr. 500 ili -200" : "Novi iznos"} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && apply()} aria-label="Iznos" />
        {mode === "add" && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[100, 1000, 10000, -100, -1000].map((v) => (
              <button key={v} onClick={() => setVal(String((Number(val) || 0) + v))} className={`rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums ${v > 0 ? "border-emerald-400/30 text-emerald-300" : "border-red-400/30 text-red-300"}`}>{v > 0 ? "+" : ""}{coins(v)}</button>
            ))}
          </div>
        )}
        {mode === "set" && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[0, 1000, 10000, 100000].map((v) => (
              <button key={v} onClick={() => setVal(String(v))} className="rounded-md border border-line px-2 py-0.5 text-xs font-semibold tabular-nums text-muted hover:text-fg">{coins(v)}</button>
            ))}
          </div>
        )}
      </div>
      <input className="input" placeholder="Razlog (vidi se u admin logu)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Razlog" />
      <div className="flex items-center justify-between rounded-xl bg-white/[.03] px-3 py-2 text-sm">
        <span className="text-muted">Novo stanje</span>
        <span className="font-display font-bold tabular-nums">{valid ? coins(after) : "—"}</span>
      </div>
      <button className="btn-primary w-full" disabled={!valid} onClick={apply}>{mode === "set" ? "Postavi" : n < 0 ? "Oduzmi" : "Dodaj"}</button>
    </div>
  );
}

function Stat({ l, v, cls = "" }: { l: string; v: string; cls?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-ink/60 px-2.5 py-2">
      <div className="text-[11px] text-muted">{l}</div>
      <div className={`truncate font-display font-bold tabular-nums ${cls}`}>{v}</div>
    </div>
  );
}

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="font-display text-base font-bold">{title}</h3>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function UserGarage({ userId, tick }: { userId: string; tick: number }) {
  const [list, setList] = useState<(Item & { inventory_id: number; source: string; created_at: string })[] | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    sb().rpc("admin_user_garage", { p_user: userId }).then(({ data }) => setList(((data as Item[]) ?? []).map((i) => ({ ...i, value: Number(i.value) })) as never));
  }, [userId, tick]);
  if (!list) return <div className="h-24 animate-pulse rounded-lg bg-panel2" />;
  if (!list.length) return <p className="text-sm text-muted">Još nema dropova.</p>;
  const shown = all ? list : list.slice(0, 12);
  return (
    <div>
      <div className="grid max-h-[420px] grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
        {shown.map((i) => (
          <div key={i.inventory_id} title={`${i.source} · ${dt(i.created_at)}`}>
            <ItemCard item={i} size="sm" />
          </div>
        ))}
      </div>
      {list.length > 12 && (
        <button className="mt-2 text-sm text-accent2" onClick={() => setAll(!all)}>{all ? "Prikaži manje" : `Prikaži sve (${list.length})`}</button>
      )}
    </div>
  );
}

function ChatStyleEditor({ u, init, save }: { u: U; init: Detail["chat"]; save: (args: Record<string, unknown>, ok: string) => void }) {
  const [color, setColor] = useState(init?.color ?? "");
  const [effect, setEffect] = useState(init?.effect ?? "none");
  // null = zadano (admin dobiva oznaku "Admin"), "" = bez oznake
  const [badge, setBadge] = useState<string | null>(init?.badge ?? null);
  const isAdminRole = (init?.role ?? u.role) === "admin";
  const shownBadge = badge === null ? (isAdminRole ? "Admin" : "") : badge;
  const preview: ChatStyle = { color: color || undefined, effect: effect === "none" ? undefined : (effect as NonNullable<ChatStyle>["effect"]), badge: shownBadge || undefined };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-line bg-ink/60 px-3 py-2 text-sm">
        <span className="grid h-5 min-w-5 place-items-center rounded bg-emerald-400 px-1 font-display text-xs font-black text-ink">{u.level}</span>
        <ChatName name={u.username} style={preview} />
        <span className="ml-auto text-xs text-muted">pregled</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Boja imena">
        <button type="button" onClick={() => setColor("")} className={`h-7 rounded-md border px-2 text-xs ${!color ? "border-fg" : "border-line text-muted"}`}>Zadana</button>
        {CHAT_COLORS.map((c) => (
          <button key={c.hex} type="button" title={c.name} aria-label={c.name} onClick={() => setColor(c.hex)}
            className={`h-7 w-7 rounded-md border-2 transition ${color.toLowerCase() === c.hex ? "border-fg scale-110" : "border-transparent"}`} style={{ background: c.hex }} />
        ))}
        <input type="color" aria-label="Vlastita boja" value={color || "#ffc53d"} onChange={(e) => setColor(e.target.value)} className="h-7 w-9 cursor-pointer rounded-md border border-line bg-transparent" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CHAT_EFFECTS.map((f) => (
          <button key={f.id} type="button" onClick={() => setEffect(f.id)}
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${effect === f.id ? "border-accent bg-accent/15 text-accent" : "border-line text-muted hover:text-fg"}`}>{f.name}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input className="input" maxLength={14} placeholder={isAdminRole ? "Oznaka (zadano: Admin)" : "Oznaka (npr. VIP)"} value={badge ?? ""} onChange={(e) => setBadge(e.target.value || null)} aria-label="Oznaka uz ime" />
        <button type="button" className="btn-ghost shrink-0 text-xs" onClick={() => setBadge("")}>Bez oznake</button>
      </div>
      <button className="btn-primary" onClick={() => save({ p_color: color || null, p_effect: effect, p_badge: badge === null ? null : badge.trim() }, "Izgled u chatu je spremljen.")}>Spremi izgled</button>
      <p className="text-xs text-muted">Promjena se odmah vidi i na porukama iz zadnjih 6 sati.</p>
    </div>
  );
}

/* ---------------- ADMIN LOG ---------------- */

function LogTab({ tick }: { tick: number }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    sb().rpc("admin_recent_log", { p_limit: 100 }).then(({ data }) => setRows((data ?? []) as LogRow[]));
  }, [tick]);
  const shown = rows.filter((r) => !q || [r.admin, r.target, ACTION[r.action] ?? r.action, fmtDetails(r.details)].join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <input className="input max-w-md" placeholder="Filtriraj po adminu, korisniku ili akciji" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtar loga" />
      <div className="card divide-y divide-line/70">
        {shown.map((r, i) => (
          <div key={i} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
            <span className="text-xs text-muted tabular-nums">{dt(r.created_at)}</span>
            <div className="min-w-0">
              <div className="text-sm">
                <span className="font-semibold">{ACTION[r.action] ?? r.action}</span>
                <span className="text-muted"> · {r.admin}{r.target ? <> → <span className="text-fg">{r.target}</span></> : null}</span>
              </div>
              {r.details && <div className="truncate text-xs text-muted" title={fmtDetails(r.details)}>{fmtDetails(r.details)}</div>}
            </div>
          </div>
        ))}
        {shown.length === 0 && <div className="p-8 text-center text-sm text-muted">Nema zapisa.</div>}
      </div>
    </div>
  );
}

/* ---------------- SLIKE ---------------- */

function PhotosTab() {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<"all" | "on" | "off">("all");
  useEffect(() => {
    resetDataCache();
    getItems().then(setItems);
  }, []);
  const toggle = async (it: Item) => {
    const next = it.photo === false;
    const { error } = await sb().rpc("admin_set_item_photo", { p_item: it.id, p_photo: next });
    if (error) return toast(errMsg(error), "error");
    setItems((l) => l.map((x) => (x.id === it.id ? { ...x, photo: next } : x)));
    resetDataCache();
  };
  const list = items.filter((i) => (filter === "all" ? true : filter === "on" ? i.photo !== false : i.photo === false));
  return (
    <div className="space-y-4">
      {!photosEnabled && (
        <div className="card border-accent/50 p-4 text-sm">
          Još nema fotografija. Na svom računalu u mapi projekta pokreni <code className="rounded bg-ink px-1">npm run car-photos</code>, commitaj <code className="rounded bg-ink px-1">public/cars</code> i <code className="rounded bg-ink px-1">lib/car-photos.json</code> i deployaj. Do tada se prikazuju crteži.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <p className="max-w-2xl text-sm text-muted">
          Pogrešnu fotografiju isključi ovdje (prikazat će se crtež) ili je zamijeni: upiši točnu datoteku s Commonsa pod tim id-om u scripts/car-photo-sources.json i pokreni npm run car-photos -- --only=ID --force.
        </p>
        <select className="input ml-auto w-auto" value={filter} onChange={(e) => setFilter(e.target.value as "all" | "on" | "off")} aria-label="Filtar">
          <option value="all">Svi ({items.length})</option>
          <option value="on">S fotografijom</option>
          <option value="off">Isključeni</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {list.map((it) => {
          const q = photoQuery(it);
          return (
            <div key={it.id} className={`card p-2 ${it.photo === false ? "opacity-60" : ""}`}>
              <div className="grid h-24 place-items-center rounded-md bg-ink/60">
                <CarImage item={it} className="h-20 w-full" />
              </div>
              <div className="mt-1 truncate text-sm font-semibold">{it.brand} {it.model}</div>
              <div className="truncate text-xs text-muted">{photoSource(it)}{photoSource(it) === "CarImages API" ? `: ${q.make} ${q.model} ${q.year}` : ""} · id {it.id}</div>
              <button className={`mt-2 w-full rounded-md border px-2 py-1 text-xs font-semibold ${it.photo === false ? "border-line" : "border-emerald-400/60 text-emerald-300"}`} onClick={() => toggle(it)}>
                {it.photo === false ? "Uključi fotografiju" : "Fotografija uključena"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
