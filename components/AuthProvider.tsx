"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import type { Profile } from "@/lib/types";

type Ctx = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

const toProfile = (r: Record<string, unknown>): Profile => ({
  ...(r as unknown as Profile),
  balance: Number(r.balance),
  gems: Number(r.gems),
  xp: Number(r.xp),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(
    async (u: User | null) => {
      if (!u) {
        setProfile(null);
        return;
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle();
      setProfile(data ? toProfile(data) : null);
    },
    [supabase]
  );

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!alive) return;
      setUser(data.user);
      await loadProfile(data.user);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      // izbjegni pozive Supabasea unutar callbacka (deadlock) — odgodi
      setTimeout(() => loadProfile(u), 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const refresh = useCallback(async () => {
    await loadProfile(user);
  }, [loadProfile, user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  return <AuthCtx value={{ user, profile, loading, refresh, signOut }}>{children}</AuthCtx>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth mora biti unutar AuthProvider");
  return c;
}
