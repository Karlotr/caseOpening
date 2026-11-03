"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getItems } from "@/lib/data";
import { loadInventory, type InvRow } from "@/lib/inventory";
import type { Item } from "@/lib/types";
import { RARITY, carName, coins } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { ItemCard } from "@/components/ItemCard";
import { CarImage } from "@/components/CarImage";
import { RequireAuth } from "@/components/RequireAuth";
import { useCelebrate } from "@/components/WinOverlay";
import { sfx } from "@/lib/sound";

type Res = { won: boolean; chance: number; roll: number };

export default function UpgraderPage() {
  return (
    <RequireAuth what="koristiti upgrader">
      <Upgrader />
    </RequireAuth>
  );
}

function Upgrader() {
  const rpc = useRpc();
  const toast = useToast();
  const { profile, refresh } = useAuth();
  const celebrate = useCelebrate();
  const [inv, setInv] = useState<InvRow[]>([]);
  const [all, setAll] = useState<Item[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [extra, setExtra] = useState(0);
  const [target, setTarget] = useState<Item | null>(null);
  const [q, setQ] = useState("");
  const [angle, setAngle] = useState(0);
  const [anim, setAnim] = useState(false);
  const [result, setResult] = useState<Res | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => loadInventory().then(setInv), []);
  useEffect(() => {
    reload();
    getItems().then(setAll);
  }, [reload]);

  const input = inv.filter((r) => sel.includes(r.id)).reduce((s, r) => s + r.item.value, 0) + (extra || 0);
  const chance = target && input > 0 ? Math.min((input / target.value) * 0.95, 0.8) : 0;
  const targets = useMemo(
    () => all.filter((i) => i.value > input && (!q || carName(i).toLowerCase().includes(q.toLowerCase()))).slice(0, 60),
    [all, input, q]
  );

  const toggle = (id: number) => {
    setResult(null);
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 8 ? s : [...s, id]));
  };

  const go = async () => {
    if (!target || busy) return;
    setBusy(true);
    setResult(null);
    const res = await rpc<Res>("upgrade_items", { p_ids: sel, p_target_item: target.id, p_coins: extra || 0 }, { silentRefresh: true });
    if (!res) return setBusy(false);
    const roll = Number(res.roll);
    setAnim(false);
    setAngle(0);
    sfx.spin();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnim(true);
        setAngle(360 * 5 + roll * 360);
      })
    );
    setTimeout(async () => {
      setResult({ ...res, roll });
      if (res.won) {
        const mult = target.value / Math.max(input, 0.01);
        celebrate({ title: "Upgrade uspio!", subtitle: `${mult.toFixed(2)}× · šansa ${(Number(res.chance) * 100).toFixed(1)}%`, items: [target], amount: target.value, tier: mult >= 5 ? 3 : mult >= 2 ? 2 : 1 });
      } else {
        sfx.lose();
        toast(`Upgrade nije uspio. ${carName(target)} je ostao u salonu.`, "error");
      }
      setSel([]);
      setExtra(0);
      await Promise.all([reload(), refresh()]);
      setBusy(false);
    }, 4200);
  };

  const R = 90;
  const C = 2 * Math.PI * R;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Upgrader</h1>
        <p className="text-sm text-muted">Uloži jedan ili više automobila (i/ili coine) i pokušaj ih pretvoriti u skuplji auto. Maksimalna šansa 80%.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px_1fr]">
        <div className="card p-4">
          <div className="label">Tvoj ulog</div>
          <div className="font-display text-2xl text-accent"><span className="coin" /> {coins(input)}</div>
          <div className="mt-3">
            <label className="label" htmlFor="extra">Dodaj coine (stanje {coins(profile?.balance)})</label>
            <input id="extra" type="number" min={0} step="0.5" className="input" value={extra || ""} onChange={(e) => { setExtra(Math.max(0, Number(e.target.value))); setResult(null); }} placeholder="0" />
          </div>
          <div className="mt-3 text-xs text-muted">Odabrano {sel.length}/8 automobila</div>
        </div>

        <div className="card grid place-items-center p-4">
          <div className="relative h-56 w-56">
            <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
              <circle cx="100" cy="100" r={R} fill="none" stroke="#2a2e37" strokeWidth="14" />
              <circle cx="100" cy="100" r={R} fill="none" stroke={result ? (result.won ? "#22c55e" : "#ef4444") : "#facc15"} strokeWidth="14" strokeDasharray={`${chance * C} ${C}`} style={{ transition: "stroke-dasharray .4s" }} />
            </svg>
            <div className="absolute inset-0" style={{ transform: `rotate(${angle}deg)`, transition: anim ? "transform 4s cubic-bezier(.1,.7,.1,1)" : "none" }}>
              <div className="absolute left-1/2 top-1 h-6 w-1.5 -translate-x-1/2 rounded bg-white shadow-[0_0_10px_white]" />
            </div>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                {result ? (
                  <>
                    <div className={`font-display text-3xl font-bold ${result.won ? "text-emerald-400" : "text-red-400"}`}>{result.won ? "USPJEH" : "PROMAŠAJ"}</div>
                    <div className="text-xs text-muted">šansa {(Number(result.chance) * 100).toFixed(2)}% · roll {(result.roll * 100).toFixed(2)}</div>
                  </>
                ) : (
                  <>
                    <div className="font-display text-4xl font-bold">{(chance * 100).toFixed(2)}%</div>
                    <div className="text-xs text-muted">šansa</div>
                  </>
                )}
                {target && !result && <div className="mt-1 text-xs text-accent">x{(target.value / Math.max(input, 0.01)).toFixed(2)}</div>}
              </div>
            </div>
          </div>
          <button className="btn-primary mt-3 w-full" disabled={!target || input <= 0 || busy || input >= (target?.value ?? 0)} onClick={go}>
            {busy ? "Vrti se..." : "Upgradeaj"}
          </button>
        </div>

        <div className="card p-4">
          <div className="label">Ciljani automobil</div>
          {target ? (
            <div className="flex items-center gap-3">
              <CarImage item={target} className="h-14 w-28" />
              <div className="min-w-0">
                <div className="text-xs" style={{ color: RARITY[target.rarity].color }}>{target.brand} · {target.year}</div>
                <div className="truncate font-semibold">{target.model}</div>
                <div className="font-display text-accent">{coins(target.value)}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted">Odaberi auto iz popisa ispod.</div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-display font-semibold">Tvoja garaža</h2>
          {inv.length === 0 && <div className="card p-6 text-sm text-muted">Nemaš automobila. Otvori kutiju ili ulož coine.</div>}
          <div className="grid max-h-[520px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
            {inv.map((r) => <ItemCard key={r.id} item={r.item} size="sm" selected={sel.includes(r.id)} onClick={() => toggle(r.id)} />)}
          </div>
        </section>
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-display font-semibold">Odaberi cilj</h2>
            <input className="input w-48" placeholder="Traži..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="grid max-h-[520px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
            {targets.map((i) => <ItemCard key={i.id} item={i} size="sm" selected={target?.id === i.id} onClick={() => { setTarget(i); setResult(null); }} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
