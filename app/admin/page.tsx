"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { getItems, resetDataCache } from "@/lib/data";
import { photoQuery, photoSource, photosEnabled } from "@/lib/carPhoto";
import { CarImage } from "@/components/CarImage";
import type { Item } from "@/lib/types";
import { carName, coins, errMsg } from "@/lib/format";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
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

export default function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const [tab, setTab] = useState<"stats" | "users" | "photos" | "log">("users");
  if (loading) return <div className="card h-40 animate-pulse" />;
  if (!isAdmin)
    return (
      <div className="card p-10 text-center">
        <div className="font-display text-3xl font-black">Nemaš pristup</div>
        <p className="mt-2 text-muted">Admin panel je dostupan samo administratorima.</p>
      </div>
    );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="h1">Admin</h1>
        <div className="flex gap-1" role="tablist">
          {([["stats", "Pregled"], ["users", "Korisnici"], ["photos", "Slike"], ["log", "Admin log"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-md border px-4 py-2 font-display text-lg font-bold ${tab === k ? "border-accent bg-accent text-ink" : "border-line hover:border-white/30"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {tab === "stats" && <StatsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "photos" && <PhotosTab />}
      {tab === "log" && <LogTab />}
    </div>
  );
}

function StatsTab() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    sb().rpc("admin_stats").then(({ data }) => setS(data as Stats));
  }, []);
  if (!s) return <div className="card h-40 animate-pulse" />;
  const house = Number(s.wagered_24h) - Number(s.payout_24h);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Box l="Korisnika" v={String(s.users)} sub={`+${s.new_24h} u 24h · ${s.banned} blokiranih`} />
        <Box l="Aktivnih u 24h" v={String(s.active_24h)} sub={`${s.open_battles} otvorenih battleova`} />
        <Box l="Odigrano u 24h" v={coins(s.wagered_24h)} sub={`isplaćeno ${coins(s.payout_24h)}`} />
        <Box l="Kuća u 24h" v={`${house >= 0 ? "+" : ""}${coins(house)}`} sub={`nagrade ${coins(s.rewards_24h)}`} tone={house >= 0 ? "good" : "bad"} />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr><th className="p-3">Igra (24h)</th><th className="p-3 text-right">Rundi</th><th className="p-3 text-right">Uloženo</th><th className="p-3 text-right">Isplaćeno</th><th className="p-3 text-right">RTP</th></tr>
          </thead>
          <tbody>
            {s.by_game.map((g) => (
              <tr key={g.game} className="border-t border-line">
                <td className="p-3 font-semibold">{g.game}</td>
                <td className="p-3 text-right tabular-nums">{g.rounds}</td>
                <td className="p-3 text-right tabular-nums">{coins(g.wager)}</td>
                <td className="p-3 text-right tabular-nums">{coins(g.payout)}</td>
                <td className="p-3 text-right tabular-nums">{Number(g.wager) > 0 ? `${((Number(g.payout) / Number(g.wager)) * 100).toFixed(1)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">Ukupno coina kod korisnika: {coins(s.total_balance)}</p>
      <SettingsBox />
      <RainTrigger />
    </div>
  );
}

const SETTING_LABELS: Record<string, string> = {
  coin_rain: "Kiša coina u chatu",
  instant_drops: "Instant dropovi kod otvaranja kutija",
  weekly_drop: "Tjedni drop",
  monthly_drop: "Mjesečni drop",
};

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
      <h3 className="font-display text-xl font-bold">Pokreni kišu coina</h3>
      <p className="mb-3 text-sm text-muted">Kiša odmah kreće u chatu. Pot plaća kuća, a dijeli se jednako među igračima koji se pridruže (do broja mjesta).</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Pot<input className="input mt-1 w-32" type="number" min={1} value={pot} onChange={(e) => setPot(e.target.value)} /></label>
        <label className="text-sm">Mjesta<input className="input mt-1 w-24" type="number" min={1} max={500} value={slots} onChange={(e) => setSlots(e.target.value)} /></label>
        <label className="text-sm">Trajanje (min)<input className="input mt-1 w-24" type="number" min={1} max={30} value={mins} onChange={(e) => setMins(e.target.value)} /></label>
        <button className="btn-primary" onClick={go}>Pokreni kišu</button>
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
    toast(`${SETTING_LABELS[k] ?? k}: ${v ? "uključeno" : "isključeno"}`, "success");
  };
  return (
    <div className="card p-4">
      <h3 className="mb-2 font-display text-xl font-bold">Nagrade i značajke</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.keys(SETTING_LABELS).map((k) => (
          <button key={k} role="switch" aria-checked={st[k] ?? true} onClick={() => toggle(k)} className="flex items-center gap-3 rounded-md border border-line p-2 text-left hover:border-white/30">
            <span className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 ${st[k] ?? true ? "bg-emerald-400" : "bg-line"}`}>
              <span className={`h-4 w-4 rounded-full bg-white transition ${st[k] ?? true ? "translate-x-4" : ""}`} />
            </span>
            <span className="text-sm">{SETTING_LABELS[k]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Box({ l, v, sub, tone }: { l: string; v: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-muted">{l}</div>
      <div className={`font-display text-4xl font-black ${tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : ""}`}>{v}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

function UsersTab() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<U[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await sb().rpc("admin_users", { p_search: q, p_limit: 200 });
    if (error) return toast(errMsg(error), "error");
    setUsers((data ?? []) as U[]);
  }, [q, toast]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  const current = users.find((u) => u.id === sel) ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_440px]">
      <div className="min-w-0 space-y-3">
        <input className="input max-w-md" placeholder="Traži po imenu ili emailu" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Traži korisnike" />
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="p-3">Korisnik</th><th className="p-3 text-right">Stanje</th><th className="p-3 text-right">Gemovi</th>
                <th className="p-3 text-right">Level</th><th className="p-3 text-right">Sreća</th><th className="p-3">Affiliate</th><th className="p-3">Zadnja igra</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} onClick={() => setSel(u.id)} className={`cursor-pointer border-t border-line hover:bg-panel2 ${sel === u.id ? "bg-panel2" : ""}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-2 font-semibold">
                      {u.username}
                      {u.role === "admin" && <span className="rounded bg-accent2/20 px-1.5 text-xs text-accent2">admin</span>}
                      {u.banned && <span className="rounded bg-red-500/20 px-1.5 text-xs text-red-300">blokiran</span>}
                    </div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>
                  <td className="p-3 text-right font-display text-base font-bold tabular-nums text-accent">{coins(u.balance)}</td>
                  <td className="p-3 text-right tabular-nums text-emerald-300">{coins(u.gems)}</td>
                  <td className="p-3 text-right tabular-nums">{u.level}</td>
                  <td className={`p-3 text-right tabular-nums ${Number(u.luck) > 1 ? "text-emerald-300" : Number(u.luck) < 1 ? "text-red-300" : "text-muted"}`}>{Number(u.luck).toFixed(2)}×</td>
                  <td className="p-3 text-xs">
                    <div>{u.aff_code} · {(Number(u.aff_rate ?? 0) * 100).toFixed(1)}%</div>
                    <div className="text-muted">{u.referrals} pozvanih{u.referred_by ? ` · od ${u.referred_by}` : ""}</div>
                  </td>
                  <td className="p-3 text-xs text-muted">{dt(u.last_game)}</td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted">Nema korisnika za ovu pretragu.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {current ? <UserEditor key={current.id} u={current} onChanged={load} /> : <div className="card p-6 text-muted">Odaberi korisnika u tablici za uređivanje.</div>}
    </div>
  );
}

function UserEditor({ u, onChanged }: { u: U; onChanged: () => void }) {
  const toast = useToast();
  const { user, refresh } = useAuth();
  const [d, setD] = useState<Detail | null>(null);
  const [amount, setAmount] = useState("");
  const [gems, setGems] = useState("");
  const [reason, setReason] = useState("");
  const [luck, setLuck] = useState(Number(u.luck));
  const [banned, setBanned] = useState(u.banned);
  const [role, setRole] = useState(u.role);
  const [note, setNote] = useState(u.note ?? "");
  const [level, setLevel] = useState(String(u.level));
  const [affCode, setAffCode] = useState(u.aff_code ?? "");
  const [affRate, setAffRate] = useState(String(((u.aff_rate ?? 0.05) * 100).toFixed(1)));
  const [items, setItems] = useState<Item[]>([]);
  const [itemQ, setItemQ] = useState("");
  const [itemId, setItemId] = useState<number | null>(null);

  const loadDetail = useCallback(async () => {
    const { data } = await sb().rpc("admin_user_detail", { p_user: u.id });
    setD(data as Detail);
  }, [u.id]);
  useEffect(() => {
    loadDetail();
    getItems().then(setItems);
  }, [loadDetail]);

  const call = async (fn: string, args: Record<string, unknown>, ok: string) => {
    const { error } = await sb().rpc(fn, args);
    if (error) return toast(errMsg(error), "error");
    toast(ok, "success");
    onChanged();
    loadDetail();
    if (u.id === user?.id) refresh();
  };

  const filtered = useMemo(() => items.filter((i) => !itemQ || carName(i).toLowerCase().includes(itemQ.toLowerCase())).slice(0, 40), [items, itemQ]);
  const luckLabel = luck === 1 ? "normalno" : luck > 1 ? "više sreće" : "manje sreće";

  return (
    <div className="card space-y-5 self-start p-4 xl:sticky xl:top-24">
      <div>
        <div className="font-display text-3xl font-black leading-none">{u.username}</div>
        <div className="text-sm text-muted">{u.email} · registriran {dt(u.created_at)}</div>
        {d && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Mini l="Stanje" v={coins(u.balance)} />
            <Mini l="Garaža" v={`${d.inventory_count} auta · ${coins(d.inventory_value)}`} />
            <Mini l="Odigrao" v={coins(d.wagered)} />
            <Mini l="Dobio" v={coins(d.payout)} />
          </div>
        )}
      </div>

      <Section title="Coini i gemovi">
        <div className="grid grid-cols-2 gap-2">
          <input className="input" type="number" placeholder="Iznos coina (+/−)" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Iznos coina" />
          <input className="input" type="number" placeholder="Gemovi (+/−)" value={gems} onChange={(e) => setGems(e.target.value)} aria-label="Gemovi" />
        </div>
        <input className="input" placeholder="Razlog (vidljiv u logu)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Razlog" />
        <button className="btn-primary" disabled={!Number(amount) && !Number(gems)} onClick={() => call("admin_adjust", { p_user: u.id, p_balance: Number(amount) || 0, p_gems: Number(gems) || 0, p_reason: reason || null }, "Stanje je promijenjeno.").then(() => { setAmount(""); setGems(""); })}>
          Primijeni
        </button>
      </Section>

      <Section title="Sreća, status i uloga">
        <div>
          <div className="flex justify-between text-sm">
            <label htmlFor="luck">Sreća</label>
            <span className={luck > 1 ? "text-emerald-300" : luck < 1 ? "text-red-300" : "text-muted"}>{luck.toFixed(2)}× · {luckLabel}</span>
          </div>
          <input id="luck" type="range" min={0.25} max={5} step={0.05} value={luck} onChange={(e) => setLuck(Number(e.target.value))} className="w-full accent-orange-500" />
          <p className="text-xs text-muted">Utječe na kutije, battle dropove, dnevnu kutiju i šansu upgradera. Korisnik ne vidi ovu vrijednost.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={banned} onChange={(e) => setBanned(e.target.checked)} className="accent-red-500" /> Blokiran</label>
          <label className="flex items-center gap-2 text-sm">Uloga
            <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">Korisnik</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        <textarea className="input min-h-16" placeholder="Interna bilješka" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Bilješka" />
        <button className="btn-primary" onClick={() => call("admin_set_controls", { p_user: u.id, p_luck: luck, p_banned: banned, p_role: role, p_note: note || null }, "Postavke su spremljene.")}>Spremi postavke</button>
      </Section>

      {d && (
        <Section title="Izgled u chatu">
          <ChatStyleEditor key={u.id} u={u} init={d.chat} save={(args, ok) => call("admin_set_chat_style", { p_user: u.id, ...args }, ok)} />
        </Section>
      )}

      <Section title="Level">
        <div className="flex gap-2">
          <input className="input w-28" type="number" min={1} max={100} value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level" />
          <button className="btn-ghost" onClick={() => call("admin_set_level", { p_user: u.id, p_level: Number(level) }, "Level je postavljen.")}>Postavi level</button>
          <button className="btn-ghost" onClick={() => call("admin_reset_cooldowns", { p_user: u.id }, "Nagrade su ponovno dostupne.")}>Resetiraj nagrade</button>
        </div>
      </Section>

      <Section title="Affiliate">
        <div className="flex gap-2">
          <input className="input" value={affCode} onChange={(e) => setAffCode(e.target.value.toLowerCase())} aria-label="Affiliate kod" />
          <div className="relative w-32 shrink-0">
            <input className="input pr-6" type="number" step="0.5" min={0} max={50} value={affRate} onChange={(e) => setAffRate(e.target.value)} aria-label="Provizija u postocima" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
          </div>
          <button className="btn-ghost" onClick={() => call("admin_set_affiliate", { p_user: u.id, p_code: affCode, p_rate: Number(affRate) / 100 }, "Affiliate je spremljen.")}>Spremi</button>
        </div>
        <p className="text-xs text-muted">Zaradio ukupno {coins(u.aff_earned ?? 0)} · {u.referrals} pozvanih</p>
      </Section>

      <Section title="Daj auto">
        <input className="input" placeholder="Traži auto" value={itemQ} onChange={(e) => setItemQ(e.target.value)} aria-label="Traži auto" />
        <select className="input" size={5} value={itemId ?? ""} onChange={(e) => setItemId(Number(e.target.value))} aria-label="Odaberi auto">
          {filtered.map((i) => <option key={i.id} value={i.id}>{carName(i)} ({i.year}) · {coins(i.value)}</option>)}
        </select>
        <button className="btn-ghost" disabled={!itemId} onClick={() => call("admin_give_item", { p_user: u.id, p_item: itemId }, "Auto je dodan u garažu.")}>Dodaj u garažu</button>
      </Section>

      {d && (
        <Section title="Zadnje igre">
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {d.logs.map((l, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>{l.game}</span>
                <span className="text-muted">{dt(l.created_at)}</span>
                <span className={Number(l.payout) - Number(l.wager) >= 0 ? "text-emerald-300" : "text-red-300"}>{coins(Number(l.payout) - Number(l.wager))}</span>
              </li>
            ))}
            {d.logs.length === 0 && <li className="text-muted">Nema igara.</li>}
          </ul>
        </Section>
      )}
      {d && d.admin_log.length > 0 && (
        <Section title="Admin promjene">
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
            {d.admin_log.map((l, i) => (
              <li key={i}><b>{l.admin}</b> · {l.action} · <span className="text-muted">{JSON.stringify(l.details)}</span> · {dt(l.created_at)}</li>
            ))}
          </ul>
        </Section>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-line pt-4">
      <h3 className="font-display text-xl font-bold">{title}</h3>
      {children}
    </section>
  );
}
function Mini({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-md bg-ink/60 p-2">
      <div className="text-xs text-muted">{l}</div>
      <div className="font-semibold">{v}</div>
    </div>
  );
}

function LogTab() {
  const [rows, setRows] = useState<LogRow[]>([]);
  useEffect(() => {
    sb().rpc("admin_recent_log", { p_limit: 100 }).then(({ data }) => setRows((data ?? []) as LogRow[]));
  }, []);
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-muted"><tr><th className="p-3">Vrijeme</th><th className="p-3">Admin</th><th className="p-3">Akcija</th><th className="p-3">Korisnik</th><th className="p-3">Detalji</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              <td className="p-3 text-muted">{dt(r.created_at)}</td>
              <td className="p-3">{r.admin}</td>
              <td className="p-3 font-semibold">{r.action}</td>
              <td className="p-3">{r.target}</td>
              <td className="p-3 text-xs text-muted">{r.details ? JSON.stringify(r.details) : ""}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted">Još nema admin promjena.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

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
