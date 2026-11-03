"use client";

import { coins } from "@/lib/format";
import { useAuth } from "./AuthProvider";

const OPTIONS = [1, 0.75, 0.5, 0.25];

// Posudba: plati samo dio ulaza i dobij isti dio nagrade ako pobijediš
export function StakePicker({ cost, value, onChange }: { cost: number; value: number; onChange: (v: number) => void }) {
  const { profile } = useAuth();
  const bal = profile?.balance ?? 0;
  const affordable = cost > 0 ? Math.min(1, Math.floor((bal / cost) * 100) / 100) : 1;
  const pct = Math.round(value * 100);
  return (
    <div className="rounded-lg border border-line bg-ink/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-lg font-bold">Ulaz</span>
        <div className="flex overflow-hidden rounded-md border border-line" role="radiogroup" aria-label="Koliki dio ulaza plaćaš">
          {OPTIONS.map((o) => (
            <button
              key={o}
              role="radio"
              aria-checked={value === o}
              onClick={() => onChange(o)}
              disabled={o * cost > bal + 0.001}
              className={`px-3 py-1.5 font-display text-base font-bold disabled:opacity-30 ${value === o ? "bg-accent2 text-ink" : "bg-panel hover:bg-panel2"}`}
            >
              {o === 1 ? "Puni" : `${o * 100}%`}
            </button>
          ))}
        </div>
        {affordable < 1 && affordable >= 0.1 && !OPTIONS.includes(affordable) && (
          <button onClick={() => onChange(affordable)} className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${value === affordable ? "border-accent2 text-accent2" : "border-line hover:border-white/30"}`}>
            Koliko imam ({Math.round(affordable * 100)}%)
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        Plaćaš <b className="text-accent">{coins(cost * value)}</b>
        {value < 1 ? (
          <> umjesto {coins(cost)}. Ako pobijediš, dobivaš <b className="text-fg">{pct}%</b> svog dijela nagrade (auti, a ostatak u coinima).</>
        ) : (
          <>. Ako pobijediš, dobivaš punu nagradu.</>
        )}
      </p>
      {affordable < 0.1 && <p className="mt-1 text-sm text-red-300">Nemaš dovoljno coina ni za 10% ulaza.</p>}
    </div>
  );
}
