import { coins } from "@/lib/format";

// Iznos s ikonom coina ili gema
export function Price({ amount, gems, className = "" }: { amount: number; gems?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${gems ? "text-emerald-300" : ""} ${className}`}>
      <span className={gems ? "gem" : "coin"} /> {coins(amount)}
    </span>
  );
}
