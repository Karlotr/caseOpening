// pečat "Preuzeto" preko slike kutije
export function ClaimedStamp({ big = false }: { big?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <span className={`-rotate-12 rounded-lg border-2 border-emerald-400/80 bg-black/50 font-display font-black uppercase tracking-widest text-emerald-300 shadow-[0_0_20px_-4px_#34d399] backdrop-blur-[1px] ${big ? "px-4 py-1.5 text-2xl" : "px-2 py-0.5 text-xs"}`}>
        ✓ Preuzeto
      </span>
    </div>
  );
}
