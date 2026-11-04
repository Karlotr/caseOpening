"use client";

import { useRouter } from "next/navigation";
import { useLimits } from "@/lib/useLimits";
import { useEffect, useMemo, useState } from "react";
import { getCases } from "@/lib/data";
import { MODES, modeDesc, modeLabel } from "@/lib/battles";
import type { CaseWithItems } from "@/lib/types";
import { coins } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { CaseArt } from "@/components/CaseCard";
import { StakePicker } from "@/components/StakePicker";
import { RequireAuth } from "@/components/RequireAuth";

export default function CreateBattle() {
  const router = useRouter();
  const rpc = useRpc();
  const limits = useLimits();
  const [cases, setCases] = useState<CaseWithItems[]>([]);
  const [mode, setMode] = useState<string>("1v1");
  const [crazy, setCrazy] = useState(false);
  const [jackpot, setJackpot] = useState(false);
  const [stake, setStake] = useState(1);
  const [sponsored, setSponsored] = useState(false);
  const [priv, setPriv] = useState(false);
  const [fast, setFast] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCases().then((c) => setCases(c.filter((x) => x.case_type === "normal")));
  }, []);
  const byId = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  const cost = picked.reduce((s, id) => s + (byId.get(id)?.price ?? 0), 0);
  const m = MODES.find((x) => x.k === mode)!;

  const add = (id: number) => setPicked((p) => (p.length >= limits.battle_max_cases ? p : [...p, id]));
  const remove = (id: number) =>
    setPicked((p) => {
      const i = p.lastIndexOf(id);
      return i < 0 ? p : [...p.slice(0, i), ...p.slice(i + 1)];
    });

  const create = async () => {
    setBusy(true);
    const id = await rpc<string>("create_battle", { p_mode: mode, p_case_ids: picked, p_crazy: crazy, p_jackpot: jackpot, p_stake: stake, p_sponsored: sponsored, p_private: priv, p_fast: fast });
    setBusy(false);
    if (id) router.push(`/battles/${id}`);
  };

  return (
    <RequireAuth what="kreirati battle">
      <div className="space-y-5">
        <h1 className="h1">Novi battle</h1>
        <div className="card space-y-4 p-4">
          <div>
            <span className="label">Mod</span>
            <div className="flex flex-wrap gap-1.5">
              {MODES.map((x) => (
                <button key={x.k} onClick={() => setMode(x.k)} className={`rounded-md border px-4 py-2 font-display text-lg font-bold ${mode === x.k ? "border-accent bg-accent text-ink" : "border-line hover:border-white/30"}`}>{x.l}</button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              {m.seats} igrača{m.team > 1 ? `, timovi po ${m.team}` : ", svatko za sebe"}. Pobjednički tim dijeli ukupnu vrijednost na jednake dijelove.
            </p>
          </div>
          <div>
            <span className="label">Tko pobjeđuje</span>
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle on={crazy} set={setCrazy} title="Crazy" desc="Pobjeđuje manja vrijednost umjesto veće." tone="fuchsia" />
              <Toggle on={jackpot} set={setJackpot} title="Jackpot" desc="Vrijednost ne odlučuje izravno nego daje šansu. Na kraju se vrti rulet." tone="emerald" />
            </div>
            <p className="mt-2 text-sm">
              <b className="font-display text-lg">{modeLabel({ crazy, jackpot })}</b>
              <span className="text-muted"> · {modeDesc({ crazy, jackpot })}</span>
            </p>
          </div>
          <div>
            <span className="label">Odabrane kutije ({picked.length}/{limits.battle_max_cases})</span>
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
          <div>
            <span className="label">Opcije</span>
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle on={sponsored} set={setSponsored} title="Sponzoriraj" desc={`Plaćaš i ${m.seats - 1} ${m.seats - 1 === 1 ? "mjesto" : "mjesta"} za druge, oni ulaze besplatno. Mjesta koja popune botovi vraćaju ti se.`} tone="emerald" />
              <Toggle on={priv} set={setPriv} title="Privatni" desc="Ne prikazuje se na popisu battleova. Ulazi se samo preko linka koji podijeliš." tone="fuchsia" />
              <Toggle on={fast} set={setFast} title="Brzo" desc="Vrtnje traju oko sekunde. Zlatni (rijetki) dropovi i dalje imaju punu animaciju." tone="emerald" />
            </div>
          </div>
          <div className="space-y-3 border-t border-line pt-4">
            <StakePicker cost={cost} value={stake} onChange={setStake} extra={sponsored ? cost * (m.seats - 1) : 0} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted">
                Ulaz po igraču: <span className="font-display text-lg text-fg">{coins(cost)}</span>
                {sponsored && <> · sponzorstvo: <span className="font-display text-lg text-emerald-300">{coins(cost * (m.seats - 1))}</span></>}
              </div>
              <button className="btn-primary px-6 py-3 text-lg" disabled={!picked.length || busy} onClick={create}>
                {busy ? "Kreiram…" : `Kreiraj battle za ${coins(cost * stake + (sponsored ? cost * (m.seats - 1) : 0))}`}
              </button>
            </div>
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

function Toggle({ on, set, title, desc, tone }: { on: boolean; set: (v: boolean) => void; title: string; desc: string; tone: "fuchsia" | "emerald" }) {
  const c = tone === "fuchsia" ? "border-fuchsia-400 bg-fuchsia-400/10" : "border-emerald-400 bg-emerald-400/10";
  const dot = tone === "fuchsia" ? "bg-fuchsia-400" : "bg-emerald-400";
  return (
    <button role="switch" aria-checked={on} onClick={() => set(!on)} className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${on ? c : "border-line hover:border-white/30"}`}>
      <span className={`mt-1 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${on ? dot : "bg-line"}`}>
        <span className={`h-4 w-4 rounded-full bg-white transition ${on ? "translate-x-4" : ""}`} />
      </span>
      <span>
        <span className="block font-display text-xl font-bold">{title}</span>
        <span className="block text-sm text-muted">{desc}</span>
      </span>
    </button>
  );
}
