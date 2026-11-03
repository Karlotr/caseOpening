"use client";

import { useEffect, useMemo, useState } from "react";
import { getItems } from "@/lib/data";
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
  const { profile, holdWallet } = useAuth();
  const celebrate = useCelebrate();
  const [all, setAll] = useState<Item[]>([]);
  const [extra, setExtra] = useState(0);
  const [target, setTarget] = useState<Item | null>(null);
  const [q, setQ] = useState("");
  const [angle, setAngle] = useState(0);
  const [anim, setAnim] = useState(false);
  const [result, setResult] = useState<Res | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getItems().then(setAll);
  }, []);

  const input = extra || 0;
  const chance = target && input > 0 ? Math.min((input / target.value) * 0.95, 0.8) : 0;
  const targets = useMemo(
    () => all.filter((i) => i.value > input && (!q || carName(i).toLowerCase().includes(q.toLowerCase()))).slice(0, 60),
    [all, input, q]
  );

  const setBet = (v: number) => {
    setResult(null);
    setExtra(Math.max(0, Math.round(v * 100) / 100));
  };

  const go = async () => {
    if (!target || busy) return;
    setBusy(true);
    setResult(null);
    const res = await rpc<Res>("upgrade_items", { p_ids: [], p_target_item: target.id, p_coins: input }, { silentRefresh: true });
    if (!res) return setBusy(false);
    if (profile) holdWallet({ balance: Math.max(0, profile.balance - input) });
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
        celebrate({ title: "Upgrade uspio!", subtitle: `${mult.toFixed(2)}× · šansa ${(Number(res.chance) * 100).toFixed(1)}% · isplaćeno na račun`, items: [target], amount: target.value, tier: mult >= 5 ? 3 : mult >= 2 ? 2 : 1 });
      } else {
        sfx.lose();
        toast(`Upgrade nije uspio. ${carName(target)} je ostao u salonu.`, "error");
      }
      holdWallet(null);
      setBusy(false);
    }, 4200);
  };

  const R = 90;
  const C = 2 * Math.PI * R;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Upgrader</h1>
        <p className="text-sm text-muted">Uloži coine i odaberi auto. Ako uspije, dobivaš njegovu vrijednost na račun. Maksimalna šansa 80%.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px_1fr]">
        <div className="card p-4">
          <div className="label">Tvoj ulog</div>
          <div className="font-display text-2xl text-accent"><span className="coin" /> {coins(input)}</div>
          <div className="mt-3">
            <label className="label" htmlFor="extra">Ulog u coinima (stanje {coins(profile?.balance)})</label>
            <input id="extra" type="number" min={0} step="0.5" className="input" value={extra || ""} onChange={(e) => setBet(Number(e.target.value))} placeholder="0" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[1, 10, 50, 100].map((v) => (
              <button key={v} type="button" className="rounded-md border border-line px-2.5 py-1 text-sm font-semibold hover:border-accent" onClick={() => setBet(input + v)}>+{v}</button>
            ))}
            <button type="button" className="rounded-md border border-line px-2.5 py-1 text-sm font-semibold hover:border-accent" onClick={() => setBet(input / 2)}>½</button>
            <button type="button" className="rounded-md border border-line px-2.5 py-1 text-sm font-semibold hover:border-accent" onClick={() => setBet(input * 2)}>2×</button>
            <button type="button" className="rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:text-fg" onClick={() => setBet(0)}>Očisti</button>
          </div>
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

      <div>
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-display font-semibold">Odaberi cilj</h2>
            <input className="input w-48" placeholder="Traži..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="grid max-h-[560px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-6">
            {targets.map((i) => <ItemCard key={i.id} item={i} size="sm" selected={target?.id === i.id} onClick={() => { setTarget(i); setResult(null); }} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
