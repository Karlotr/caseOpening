"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getCases, randomFromCase } from "@/lib/data";
import type { CaseWithItems, Item } from "@/lib/types";
import { coins } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { CaseArt } from "@/components/CaseCard";
import { ItemCard } from "@/components/ItemCard";
import { Reel } from "@/components/Reel";

const WIN = 50;
type OpenResult = { items: Item[]; instant_drop: number | null };

export function CaseView() {
  const { slug } = useParams<{ slug: string }>();
  const { user, profile, refresh } = useAuth();
  const rpc = useRpc();
  const toast = useToast();
  const [c, setC] = useState<CaseWithItems | null>(null);
  const [missing, setMissing] = useState(false);
  const [count, setCount] = useState(1);
  const [fast, setFast] = useState(false);
  const [strips, setStrips] = useState<Item[][]>([]);
  const [spinKey, setSpinKey] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<Item[]>([]);
  const [showWon, setShowWon] = useState(false);
  const [instant, setInstant] = useState<number | null>(null);

  useEffect(() => {
    getCases().then((all) => {
      const f = all.find((x) => x.slug === slug);
      if (!f) setMissing(true);
      else {
        setC(f);
        setStrips([Array.from({ length: 60 }, () => randomFromCase(f))]);
      }
    });
  }, [slug]);

  if (missing) return <div className="card p-8 text-center">Kutija ne postoji. <Link href="/cases" className="text-accent">Natrag</Link></div>;
  if (!c) return <div className="card h-96 animate-pulse" />;

  const build = (winners: Item[]) =>
    winners.map((w) => {
      const s = Array.from({ length: 60 }, () => randomFromCase(c));
      s[WIN] = w;
      return s;
    });

  const start = (winners: Item[]) => {
    setShowWon(false);
    setStrips(build(winners));
    setWon(winners);
    setSpinning(true);
    setSpinKey((k) => k + 1);
  };

  const open = async () => {
    if (spinning) return;
    const res = await rpc<OpenResult>("open_case", { p_slug: c.slug, p_count: c.case_type === "level" ? 1 : count }, { silentRefresh: true });
    if (!res) return;
    setInstant(res.instant_drop ? Number(res.instant_drop) : null);
    start(res.items.map((i) => ({ ...i, value: Number(i.value) })));
  };

  const demo = () => {
    if (spinning) return;
    setInstant(null);
    start(Array.from({ length: count }, () => ({ ...randomFromCase(c), inventory_id: undefined })));
  };

  const finished = async () => {
    setSpinning(false);
    setShowWon(true);
    await refresh();
    if (instant) toast(`⚡ Instant drop! +${coins(instant)} coina`, "gold");
  };

  const sellAll = async () => {
    const ids = won.map((w) => w.inventory_id).filter(Boolean);
    if (!ids.length) return;
    const total = await rpc<number>("sell_items", { p_ids: ids });
    if (total !== null) {
      toast(`Prodano za ${coins(total)} coina`, "success");
      setWon([]);
      setShowWon(false);
    }
  };

  const costLabel =
    c.case_type === "gem" ? (
      <><span className="gem" /> {coins((c.gem_price ?? 0) * count)}</>
    ) : c.case_type === "level" ? (
      "Besplatno"
    ) : (
      <><span className="coin" /> {coins(c.price * count)}</>
    );

  const canOpen =
    !!user &&
    c.case_type !== "daily" &&
    (c.case_type !== "level" || (profile?.level ?? 0) >= c.min_level);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/cases" className="hover:text-fg">Kutije</Link> <span>/</span> <span className="text-fg">{c.name}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="card p-4">
          <CaseArt c={c} className="h-44" />
          <h1 className="mt-3 font-display text-2xl font-bold">{c.name}</h1>
          <p className="text-sm text-muted">{c.description}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
            <div className="rounded-md bg-black/30 p-2">Najskuplji<div className="font-semibold text-fg">{c.items[0]?.model}</div></div>
            <div className="rounded-md bg-black/30 p-2">Automobila<div className="font-semibold text-fg">{c.items.length}</div></div>
          </div>
        </div>

        <div className="card min-w-0 space-y-3 p-4">
          <div className="space-y-2">
            {strips.map((s, i) => (
              <Reel key={i} items={s} winnerIndex={WIN} spinKey={spinKey} duration={fast ? 1800 : 5200} onDone={i === 0 ? finished : undefined} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {c.case_type !== "level" && c.case_type !== "daily" && (
              <div className="flex overflow-hidden rounded-md border border-line">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} disabled={spinning} onClick={() => setCount(n)} className={`px-3 py-2 text-sm font-semibold ${count === n ? "bg-accent text-black" : "bg-panel hover:bg-panel2"}`}>
                    {n}x
                  </button>
                ))}
              </div>
            )}
            {c.case_type === "daily" ? (
              <Link href="/rewards" className="btn-primary">Otvori na stranici Nagrade</Link>
            ) : !user ? (
              <Link href="/login" className="btn-primary">Prijavi se za otvaranje</Link>
            ) : (
              <button className="btn-primary min-w-44" onClick={open} disabled={!canOpen || spinning}>
                {spinning ? "Vrti se..." : c.case_type === "level" && (profile?.level ?? 0) < c.min_level ? `Potreban level ${c.min_level}` : <>Otvori · {costLabel}</>}
              </button>
            )}
            <button className="btn-ghost" onClick={demo} disabled={spinning}>Demo vrtnja</button>
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} className="accent-yellow-400" /> Brzo otvaranje
            </label>
          </div>

          {showWon && won.length > 0 && (
            <div className="pop rounded-lg border border-accent/40 bg-accent/5 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="font-display font-semibold">
                  {won[0].inventory_id ? "Osvojio si" : "Demo rezultat"} · <span className="text-accent">{coins(won.reduce((s, w) => s + w.value, 0))}</span>
                </div>
                {won[0].inventory_id && (
                  <div className="flex gap-2">
                    <button className="btn-ghost" onClick={sellAll}>Prodaj sve</button>
                    <Link href="/profile" className="btn-ghost">U garažu</Link>
                    <Link href="/upgrader" className="btn-ghost">Upgradeaj</Link>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                {won.map((w, i) => <ItemCard key={i} item={w} size="sm" />)}
              </div>
            </div>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Sadržaj kutije</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {c.items.map((i) => <ItemCard key={i.id} item={i} chance={i.chance} size="sm" />)}
        </div>
      </section>
    </div>
  );
}
