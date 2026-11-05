"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export const LEVEL_COOLDOWN = 86400_000; // level kutija: jednom u 24 h

type Claims = Record<number, string>; // case_id → claimed_at

// jedan zajednički dohvat za sve kartice na stranici (ne po jedan upit po kutiji)
let cache: { uid: string; at: number; p: Promise<Claims> } | null = null;
const listeners = new Set<(c: Claims) => void>();

function fetchClaims(uid: string, force = false): Promise<Claims> {
  if (!force && cache && cache.uid === uid && Date.now() - cache.at < 30_000) return cache.p;
  const p = Promise.resolve(createClient().from("level_case_claims").select("case_id, claimed_at")).then(({ data }) => {
    const c: Claims = Object.fromEntries((data ?? []).map((r) => [r.case_id, r.claimed_at]));
    listeners.forEach((l) => l(c));
    return c;
  });
  cache = { uid, at: Date.now(), p };
  return p;
}

export function useLevelClaims() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<Claims>({});
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const on = (c: Claims) => alive && setClaims(c);
    listeners.add(on);
    fetchClaims(user.id).then(on);
    return () => {
      alive = false;
      listeners.delete(on);
    };
  }, [user]);
  const reload = useCallback(() => (user ? fetchClaims(user.id, true) : Promise.resolve({})), [user]);
  return { claims, reload };
}

// ms do ponovnog otvaranja (0 = dostupno)
export const levelWait = (claims: Claims, caseId: number, now: number | null) => {
  const last = claims[caseId];
  return now && last ? Math.max(0, new Date(last).getTime() + LEVEL_COOLDOWN - now) : 0;
};
