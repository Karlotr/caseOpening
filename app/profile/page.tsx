"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { loadInventory, type InvRow } from "@/lib/inventory";
import { coins, levelProgress } from "@/lib/format";
import { useAuth } from "@/components/AuthProvider";
import { RequireAuth } from "@/components/RequireAuth";
import { ItemCard } from "@/components/ItemCard";

type Log = { id: number; game: string; wager: number; payout: number; created_at: string };
const GAME: Record<string, string> = { case: "Kutija", battle: "Battle", upgrader: "Upgrader", crash: "Crash", crossroad: "Crossroad", rulet: "Rulet", slide: "Crash", trinity: "Rulet", jackpot: "Jackpot", daily: "Dnevna kutija", reward: "Nagrada", affiliate: "Affiliate", admin: "Admin" };

export default function ProfilePage() {
  return (
    <RequireAuth what="vidjeti profil">
      <Profile />
    </RequireAuth>
  );
}

function Profile() {
  const { profile } = useAuth();
  const [drops, setDrops] = useState<InvRow[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [sort, setSort] = useState<"new" | "value">("new");

  useEffect(() => {
    loadInventory("all", 48).then(setDrops);
    createClient().from("game_log").select("id, game, wager, payout, created_at").order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => setLogs((data ?? []) as Log[]));
  }, []);

  const list = useMemo(() => (sort === "value" ? [...drops].sort((a, b) => b.item.value - a.item.value) : drops), [drops, sort]);
  const best = drops.reduce<InvRow | null>((a, r) => (!a || r.item.value > a.item.value ? r : a), null);

  if (!profile) return null;
  const lp = levelProgress(profile.xp, profile.level);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Vozač" value={profile.username} />
        <Stat label="Level" value={`${profile.level} · ${lp.pct.toFixed(0)}%`} />
        <Stat label="Stanje" value={coins(profile.balance)} accent />
        <Stat label="Najbolji nedavni drop" value={best ? `${best.item.model} · ${coins(best.item.value)}` : "—"} accent />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="h1 mr-auto">Zadnji dropovi</h1>
          <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as "new" | "value")} aria-label="Poredak">
            <option value="new">Najnovije</option>
            <option value="value">Najvrjednije</option>
          </select>
        </div>
        <p className="mb-3 text-sm text-muted">Vrijednost svakog auta ide odmah na tvoj račun.</p>
        {drops.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">Još nemaš dropova. Otvori kutiju ili preuzmi dnevnu nagradu!</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {list.map((r) => <ItemCard key={r.id} item={r.item} size="sm" />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg font-semibold">Povijest</h2>
        <div className="card divide-y divide-line">
          {logs.length === 0 && <div className="p-4 text-sm text-muted">Još nema igara.</div>}
          {logs.map((l) => {
            const net = Number(l.payout) - Number(l.wager);
            return (
              <div key={l.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-28 font-semibold">{GAME[l.game] ?? l.game}</span>
                <span className="flex-1 text-xs text-muted">{new Date(l.created_at).toLocaleString("hr-HR")}</span>
                <span className="w-24 text-right text-muted">−{coins(l.wager)}</span>
                <span className={`w-24 text-right font-display ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>{net >= 0 ? "+" : ""}{coins(net)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`truncate font-display text-xl ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}
