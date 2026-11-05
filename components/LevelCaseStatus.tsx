"use client";

import { useAuth } from "./AuthProvider";
import { ClaimedStamp } from "./ClaimedStamp";
import { fmtLeft, useNow } from "@/lib/useNow";
import { levelWait, useLevelClaims } from "@/lib/useLevelClaims";

// preko slike level kutije: zatamnjeno + "Preuzeto" i odbrojavanje ako je već otvorena u zadnja 24 h
export function LevelCaseStatus({ caseId, minLevel }: { caseId: number; minLevel: number }) {
  const { profile } = useAuth();
  const { claims } = useLevelClaims();
  const now = useNow(30_000);
  if (!profile || profile.level < minLevel) return null;
  const wait = levelWait(claims, caseId, now);
  if (wait <= 0)
    return (
      <span className="absolute right-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink shadow-[0_0_12px_#34d399]">
        Dostupno
      </span>
    );
  return (
    <div className="absolute inset-0 rounded-xl bg-black/55 backdrop-grayscale">
      <ClaimedStamp />
      <span className="absolute inset-x-0 bottom-2 text-center text-xs font-semibold text-muted tabular-nums">Ponovno za {fmtLeft(wait)}</span>
    </div>
  );
}
