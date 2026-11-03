"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { loadInventory, type InvRow } from "@/lib/inventory";
import { coins, levelProgress } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { RequireAuth } from "@/components/RequireAuth";
import { ItemCard } from "@/components/ItemCard";

type Log = { id: number; game: string; wager: number; payout: number; created_at: string };
const GAME: Record<string, string> = { case: "Kutija", battle: "Battle", upgrader: "Upgrader", slide: "Slide", trinity: "Trinity", jackpot: "Jackpot", daily: "Dnevna kutija", reward: "Nagrada", affiliate: "Affiliate", admin: "Admin" };

export default function ProfilePage() {
  return (
    <RequireAuth what="vidjeti garažu">
      <Profile />
    </RequireAuth>
  );
}

function Profile() {
  const { profile } = useAuth();
  const rpc = useRpc();
  const toast = useToast();
  const [inv, setInv] = useState<InvRow[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [sort, setSort] = useState<"new" | "value">("new");

  const reload = useCallback(async () => {
    setInv(await loadInventory());
    const { data } = await createClient().from("game_log").select("id, game, wager, payout, created_at").order("created_at", { ascending: false }).limit(30);
    setLogs((data ?? []) as Log[]);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const list = useMemo(() => (sort === "value" ? [...inv].sort((a, b) => b.item.value - a.item.value) : inv), [inv, sort]);
  const total = inv.reduce((s, r) => s + r.item.value, 0);
  const selTotal = inv.filter((r) => sel.includes(r.id)).reduce((s, r) => s + r.item.value, 0);

  const sell = async (ids: number[]) => {
    if (!ids.length) return;
    const t = await rpc<number>("sell_items", { p_ids: ids });
    if (t !== null) {
      toast(`Prodano ${ids.length} automobila za ${coins(t)} coina`, "success");
      setSel([]);
      reload();
    }
  };

  if (!profile) return null;
  const lp = levelProgress(profile.xp, profile.level);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Vozač" value={profile.username} />
        <Stat label="Level" value={`${profile.level} · ${lp.pct.toFixed(0)}%`} />
        <Stat label="Stanje" value={coins(profile.balance)} accent />
        <Stat label="Vrijednost garaže" value={coins(total)} accent />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="h1 mr-auto">Moja garaža <span className="text-base font-normal text-muted">({inv.length})</span></h1>
          <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as "new" | "value")}>
            <option value="new">Najnovije</option>
            <option value="value">Najvrjednije</option>
          </select>
          <button className="btn-ghost" disabled={!sel.length} onClick={() => sell(sel)}>Prodaj odabrano ({coins(selTotal)})</button>
          <button className="btn-ghost" disabled={!inv.length} onClick={() => sel.length === inv.length ? setSel([]) : setSel(inv.map((r) => r.id))}>
            {sel.length === inv.length && inv.length ? "Poništi odabir" : "Odaberi sve"}
          </button>
        </div>
        {inv.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">Garaža je prazna. Otvori kutiju ili preuzmi dnevnu nagradu!</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {list.map((r) => (
              <ItemCard key={r.id} item={r.item} size="sm" selected={sel.includes(r.id)} onClick={() => setSel((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))} />
            ))}
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
