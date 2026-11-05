"use client";

import { useRouter } from "next/navigation";
import { useLimits } from "@/lib/useLimits";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getCases } from "@/lib/data";
import { MODES, modeDesc, modeLabel } from "@/lib/battles";
import type { CaseWithItems } from "@/lib/types";
import { coins } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { CaseArt } from "@/components/CaseCard";
import { StakePicker } from "@/components/StakePicker";
import { Price } from "@/components/Price";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { useFavorites } from "@/lib/favorites";

export default function CreateBattle() {
  const router = useRouter();
  const rpc = useRpc();
  const { refresh } = useAuth();
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
  const [cur, setCur] = useState<"coins" | "gems">("coins");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCases().then((c) => setCases(c.filter((x) => x.case_type === "normal" || x.case_type === "gem")));
  }, []);
  const gems = cur === "gems";
  // filtriranje i sortiranje kao na stranici kutija; omiljene uvijek prve (dodaju se na stranici kutija)
  const { fav } = useFavorites();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [onlyFav, setOnlyFav] = useState(false);
  const ofCur = cases.filter((c) => c.case_type === (gems ? "gem" : "normal"));
  const favCount = ofCur.filter((c) => fav.includes(c.id)).length;
  const shownCases = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const val = (c: CaseWithItems) => (gems ? c.gem_price ?? 0 : c.price);
    return cases
      .filter((c) => c.case_type === (gems ? "gem" : "normal"))
      .filter((c) => !onlyFav || fav.includes(c.id))
      .filter((c) => !ql || c.name.toLowerCase().includes(ql) || c.items.some((i) => `${i.brand} ${i.model}`.toLowerCase().includes(ql)))
      .sort((a, b) => Number(fav.includes(b.id)) - Number(fav.includes(a.id)) || (sort === "asc" ? val(a) - val(b) : val(b) - val(a)));
  }, [cases, gems, onlyFav, fav, q, sort]);
  const switchCur = (c: "coins" | "gems") => {
    if (c === cur) return;
    setCur(c);
    setPicked([]);
    setSponsored(false);
  };
  const byId = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  const cost = picked.reduce((s, id) => s + ((gems ? byId.get(id)?.gem_price : byId.get(id)?.price) ?? 0), 0);
  const m = MODES.find((x) => x.k === mode)!;

  // ručno sidrenje skrola: iOS Safari nema scroll anchoring, pa bi promjena visine iznad
  // (odabrane kutije, cijena, posudba) pomaknula karticu koju upravo tapkaš
  const anchor = useRef<{ el: HTMLElement; top: number } | null>(null);
  const keepInPlace = (e?: React.MouseEvent) => {
    const el = (e?.currentTarget as HTMLElement | undefined)?.closest<HTMLElement>("[data-anchor]");
    anchor.current = el ? { el, top: el.getBoundingClientRect().top } : null;
  };
  useLayoutEffect(() => {
    const a = anchor.current;
    anchor.current = null;
    if (!a || !a.el.isConnected) return;
    const d = a.el.getBoundingClientRect().top - a.top;
    if (Math.abs(d) > 0.5) window.scrollBy({ top: d, behavior: "instant" });
  }, [picked, stake]);

  const add = (id: number, e?: React.MouseEvent) => {
    keepInPlace(e);
    setPicked((p) => (p.length >= limits.battle_max_cases ? p : [...p, id]));
  };
  const remove = (id: number, e?: React.MouseEvent) => {
    keepInPlace(e);
    setPicked((p) => {
      const i = p.lastIndexOf(id);
      return i < 0 ? p : [...p.slice(0, i), ...p.slice(i + 1)];
    });
  };

  const creating = useRef(false);
  // stranica battlea se učita unaprijed, da prijelaz nakon kreiranja bude trenutan
  useEffect(() => {
    router.prefetch("/battles/0");
  }, [router]);
  // povratak na stranicu (strelica natrag, iOS swipe, Next zadrži stanje stranice): gumb mora opet raditi
  useEffect(() => {
    const reset = () => {
      creating.current = false;
      setBusy(false);
    };
    reset();
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  const create = async () => {
    if (creating.current) return; // zaštita od duplog klika
    creating.current = true;
    setBusy(true);
    // stanje se osvježava u pozadini (ne čeka se prije prelaska na battle)
    const id = await rpc<string>("create_battle", { p_mode: mode, p_case_ids: picked, p_crazy: crazy, p_jackpot: jackpot, p_stake: stake, p_sponsored: sponsored, p_private: priv, p_fast: fast }, { silentRefresh: true });
    if (id) {
      refresh();
      router.push(`/battles/${id}`); // gumb ostaje u "Kreiram…" dok se battle ne otvori
      return;
    }
    creating.current = false;
    setBusy(false);
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
            <span className="label">Valuta</span>
            <div className="flex w-fit overflow-hidden rounded-md border border-line" role="radiogroup" aria-label="Valuta ulaza">
              {(["coins", "gems"] as const).map((c) => (
                <button key={c} role="radio" aria-checked={cur === c} onClick={() => switchCur(c)} className={`flex items-center gap-1.5 px-4 py-2 font-display text-base font-bold ${cur === c ? (c === "gems" ? "bg-emerald-400 text-ink" : "bg-accent text-ink") : "bg-panel hover:bg-panel2"}`}>
                  <span className={c === "gems" ? "gem" : "coin"} /> {c === "gems" ? "Gem kutije" : "Coin kutije"}
                </button>
              ))}
            </div>
            {gems && <p className="mt-1.5 text-xs text-muted">Ulaz se plaća gemovima, a nagrada se isplaćuje u coinima.</p>}
          </div>
          <div>
            <span className="label">Odabrane kutije ({picked.length}/{limits.battle_max_cases})</span>
            <div className="nice-scroll flex h-[74px] gap-1.5 overflow-x-auto overflow-y-hidden rounded-md border border-dashed border-line p-2 pb-1.5 sm:h-auto sm:min-h-16 sm:flex-wrap sm:overflow-visible">
              {picked.length === 0 && <span className="self-center text-sm text-muted">Dodaj kutije ispod.</span>}
              {picked.map((id, i) => {
                const c = byId.get(id);
                return c ? (
                  <button key={i} onClick={() => remove(id)} title="Ukloni" className="group relative shrink-0">
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
            <StakePicker cost={cost} value={stake} onChange={setStake} extra={sponsored ? cost * (m.seats - 1) : 0} gems={gems} />
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="text-sm text-muted tabular-nums">
                Ulaz po igraču: <Price amount={cost} gems={gems} className="font-display text-lg text-fg" />
                {sponsored && <> · sponzorstvo: <Price amount={cost * (m.seats - 1)} gems={gems} className="font-display text-lg text-emerald-300" /></>}
              </div>
              <button className="btn-primary w-full whitespace-nowrap px-6 py-3 text-lg tabular-nums sm:w-auto" disabled={!picked.length || busy} aria-busy={busy} onClick={create}>
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" aria-hidden />
                    Kreiram battle…
                  </span>
                ) : `Kreiraj battle za ${coins(cost * stake + (sponsored ? cost * (m.seats - 1) : 0))}${gems ? " gemova" : ""}`}
              </button>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[
                { k: false, l: gems ? "Gem kutije" : "Sve kutije" },
                { k: true, l: "★ Omiljene" },
              ].map((t) => (
                <button
                  key={String(t.k)}
                  onClick={() => setOnlyFav(t.k)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold ring-1 transition sm:px-4 sm:py-2 ${
                    onlyFav === t.k ? "bg-[linear-gradient(100deg,#ff2b4e,#ff5a3c_45%,#ffb547)] text-white ring-white/20 shadow-[0_6px_20px_-8px_#ff2b4ecc]" : "bg-white/[.04] text-white/75 ring-white/10 hover:bg-white/[.08] hover:text-white"
                  }`}
                >
                  {t.l}
                  {t.k && favCount > 0 && <span className={`ml-1.5 rounded-full px-1.5 text-[11px] ${onlyFav ? "bg-black/25" : "bg-amber-300/20 text-amber-200"}`}>{favCount}</span>}
                </button>
              ))}
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <input className="input min-w-0 flex-1 sm:w-64 sm:flex-none" placeholder="Traži kutiju ili auto (npr. Supra)" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="input w-auto shrink-0" value={sort} onChange={(e) => setSort(e.target.value as "asc" | "desc")} aria-label="Sortiraj">
                <option value="asc">Cijena ↑</option>
                <option value="desc">Cijena ↓</option>
              </select>
            </div>
          </div>
          {cases.length > 0 && shownCases.length === 0 && (
            <p className="text-sm text-muted">{onlyFav ? "Nemaš omiljenih kutija ovdje. Dodaj ih zvjezdicom ☆ na stranici Kutije." : "Nema rezultata."}</p>
          )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shownCases.map((c) => {
            const n = picked.filter((x) => x === c.id).length;
            return (
              <div key={c.id} data-anchor className="card relative p-3">
                <CaseArt c={c} label className="h-32" />
                {fav.includes(c.id) && <span className="pointer-events-none absolute left-5 top-5 z-20 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-sm leading-none text-amber-300 ring-1 ring-amber-300/50" title="Omiljena">★</span>}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex rounded-lg bg-black/40 px-2 py-0.5 font-display text-base font-black text-accent ring-1 ring-accent/30"><Price amount={gems ? c.gem_price ?? 0 : c.price} gems={gems} /></div>
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost h-8 w-8 p-0" onClick={(e) => remove(c.id, e)} disabled={!n}>−</button>
                    <span className="w-5 text-center text-sm">{n}</span>
                    <button className="btn-primary h-8 w-8 p-0" onClick={(e) => add(c.id, e)}>+</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
