"use client";

import { useAuth } from "./AuthProvider";

export function BetInput({ value, onChange, disabled, min = 0.1, max = Infinity }: { value: number; onChange: (n: number) => void; disabled?: boolean; min?: number; max?: number }) {
  const { profile } = useAuth();
  const bal = profile?.balance ?? 0;
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n * 100) / 100)));
  return (
    <div>
      <label className="label" htmlFor="bet">Ulog</label>
      <div className="flex gap-1">
        <div className="relative flex-1">
          <span className="coin absolute left-3 top-1/2 -translate-y-1/2" />
          <input id="bet" type="number" step="0.1" min={min} className="input pl-8" value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
        </div>
        <button className="btn-ghost px-2.5" disabled={disabled} onClick={() => set(value / 2)}>½</button>
        <button className="btn-ghost px-2.5" disabled={disabled} onClick={() => set(value * 2)}>2×</button>
        <button className="btn-ghost px-2.5" disabled={disabled} onClick={() => set(bal)}>Max</button>
      </div>
    </div>
  );
}
