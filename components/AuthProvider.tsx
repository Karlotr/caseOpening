"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import type { Profile } from "@/lib/types";

type Ctx = {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  garage: { count: number; value: number };
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [garage, setGarage] = useState({ count: 0, value: 0 });

  const loadProfile = useCallback(
    async (u: User | null) => {
      if (!u) {
        setProfile(null);
        setIsAdmin(false);
        return;
      }
      const [{ data }, { data: adm }, { data: gar }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.id).maybeSingle(),
        supabase.rpc("am_i_admin"),
        supabase.rpc("garage_summary"),
      ]);
      setProfile(data ? toProfile(data) : null);
      setIsAdmin(adm === true);
      if (gar) setGarage({ count: Number((gar as { count: number }).count), value: Number((gar as { value: number }).value) });
    },
    [supabase]
  );

  useEffect(() => {
    // affiliate: zapamti ?ref=KOD iz linka za registraciju
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[A-Za-z0-9_]{3,20}$/.test(ref)) localStorage.setItem("garaza-ref", ref.toLowerCase());
    } catch {}
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

  // stanje se osvježava samo od sebe (npr. isplata kiše, jackpota, battlea dok si na drugoj stranici)
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => loadProfile(user), 15000);
    const onFocus = () => loadProfile(user);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  return <AuthCtx value={{ user, profile, isAdmin, garage, loading, refresh, signOut }}>{children}</AuthCtx>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth mora biti unutar AuthProvider");
  return c;
}
