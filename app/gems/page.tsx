"use client";

import { useEffect, useState } from "react";
import { getCases } from "@/lib/data";
import type { CaseWithItems } from "@/lib/types";
import { coins } from "@/lib/format";
import { useAuth } from "@/components/AuthProvider";
import { CaseCard } from "@/components/CaseCard";

export default function GemsPage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<CaseWithItems[]>([]);
  useEffect(() => {
    getCases().then((c) => setCases(c.filter((x) => x.case_type === "gem")));
  }, []);
  return (
    <div className="space-y-5">
      <section className="card relative overflow-hidden p-6">
        <div className="absolute -right-10 -top-10 h-48 w-48 rotate-45 rounded-3xl bg-emerald-500/10" />
        <h1 className="h1">Gem Stash</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Svaki odigrani coin (kutije, battles, upgrader, crash, crossroad, plinko, rulet, jackpot) puni tvoj stash: dobivaš <b className="text-emerald-400">0,1 gem po coinu</b>. Gemovima otključavaš ekskluzivne bonus kutije.
        </p>
        <div className="mt-4 flex items-center gap-2 font-display text-3xl text-emerald-400">
          <span className="gem" /> {coins(profile?.gems ?? 0)}
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cases.map((c) => {
          const pct = Math.min(100, ((profile?.gems ?? 0) / (c.gem_price ?? 1)) * 100);
          return (
            <div key={c.id} className="space-y-2">
              <CaseCard c={c} />
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs text-muted">{pct >= 100 ? "Spremno za otvaranje!" : `${coins(profile?.gems ?? 0)} / ${coins(c.gem_price)} gemova`}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
