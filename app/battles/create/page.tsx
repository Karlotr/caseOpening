"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCases } from "@/lib/data";
import { MODES } from "@/lib/battles";
import type { CaseWithItems } from "@/lib/types";
import { coins } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { CaseArt } from "@/components/CaseCard";
import { RequireAuth } from "@/components/RequireAuth";

export default function CreateBattle() {
  const router = useRouter();
  const rpc = useRpc();
  const [cases, setCases] = useState<CaseWithItems[]>([]);
  const [mode, setMode] = useState<string>("1v1");
  const [crazy, setCrazy] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCases().then((c) => setCases(c.filter((x) => x.case_type === "normal")));
  }, []);
  const byId = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  const cost = picked.reduce((s, id) => s + (byId.get(id)?.price ?? 0), 0);
  const m = MODES.find((x) => x.k === mode)!;

  const add = (id: number) => setPicked((p) => (p.length >= 25 ? p : [...p, id]));
  const remove = (id: number) =>
    setPicked((p) => {
      const i = p.lastIndexOf(id);
      return i < 0 ? p : [...p.slice(0, i), ...p.slice(i + 1)];
    });

  const create = async () => {
    setBusy(true);
    const id = await rpc<string>("create_battle", { p_mode: mode, p_case_ids: picked, p_crazy: crazy });
    setBusy(false);
    if (id) router.push(`/battles/${id}`);
  };

  return (
    <RequireAuth what="kreirati battle">
      <div className="space-y-5">
        <h1 className="h1">Kreiraj battle</h1>
        <div className="card space-y-4 p-4">
          <div>
            <span className="label">Mod</span>
            <div className="flex flex-wrap gap-1.5">
              {MODES.map((x) => (
                <button key={x.k} onClick={() => setMode(x.k)} className={mode === x.k ? "btn-primary" : "btn-ghost"}>{x.l}</button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              {m.seats} igrača{m.team > 1 ? `, timovi po ${m.team}` : ", svatko za sebe"}. Pobjednički tim dijeli sve osvojene automobile.
            </p>
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={crazy} onChange={(e) => setCrazy(e.target.checked)} className="accent-fuchsia-400" />
            <span><b className="text-fuchsia-300">Crazy mod</b> — pobjeđuje najmanja ukupna vrijednost</span>
          </label>
          <div>
            <span className="label">Odabrane kutije ({picked.length}/25)</span>
            <div className="flex min-h-16 flex-wrap gap-1.5 rounded-md border border-dashed border-line p-2">
              {picked.length === 0 && <span className="self-center text-sm text-muted">Dodaj kutije ispod.</span>}
              {picked.map((id, i) => {
                const c = byId.get(id);
                return c ? (
                  <button key={i} onClick={() => remove(id)} title="Ukloni" className="group relative">
                    <CaseArt c={c} className="h-12 w-20 [&_svg]:h-8 [&_svg]:w-16" />
                    <span className="absolute inset-0 hidden place-items-center rounded-lg bg-black/70 text-xs font-bold text-red-400 group-hover:grid">Ukloni</span>
                  </button>
                ) : null;
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div className="text-sm text-muted">Cijena ulaza po igraču: <span className="font-display text-lg text-accent"><span className="coin" /> {coins(cost)}</span></div>
            <button className="btn-primary" disabled={!picked.length || busy} onClick={create}>{busy ? "Kreiram..." : "Kreiraj battle"}</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cases.map((c) => {
            const n = picked.filter((x) => x === c.id).length;
            return (
              <div key={c.id} className="card p-3">
                <CaseArt c={c} className="h-28" />
                <div className="mt-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="text-xs text-accent"><span className="coin" /> {coins(c.price)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost h-8 w-8 p-0" onClick={() => remove(c.id)} disabled={!n}>−</button>
                    <span className="w-5 text-center text-sm">{n}</span>
                    <button className="btn-primary h-8 w-8 p-0" onClick={() => add(c.id)}>+</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </RequireAuth>
  );
}
