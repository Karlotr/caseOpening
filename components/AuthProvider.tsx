"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import type { Profile } from "@/lib/types";

type Ctx = {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isTester: boolean; // ograničeni admin panel: smije samo sebi dodati coine/gemove
  loading: boolean;
  refresh: () => Promise<void>;
  // privremeno "zamrzni" prikaz stanja i garaže (npr. dok se vrti battle, da se rezultat ne vidi unaprijed)
  holdWallet: (h: Wallet | null) => void;
  // dobitak je već na računu (server), ali se prikazuje tek kad animacija završi: holdWallet(null) ga otpušta
  deferCredit: (amount: number) => void;
  signOut: () => Promise<void>;
};

type Wallet = { balance: number; gems?: number };
const SAFETY_RELEASE = 10 * 60_000; // sigurnosno otpuštanje zamrznutog stanja (dugi battleovi traju i preko 2 min)

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
  const [isTester, setIsTester] = useState(false);
  const [hold, setHold] = useState<Wallet | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdRef = useRef<Wallet | null>(null);
  const profileRef = useRef<Profile | null>(null);
  useEffect(() => {
    holdRef.current = hold;
    profileRef.current = profile;
  }, [hold, profile]);

  const loadProfile = useCallback(
    async (u: User | null) => {
      if (!u) {
        setProfile(null);
        setIsAdmin(false);
        setIsTester(false);
        return;
      }
      const [{ data }, { data: role, error: roleErr }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.id).maybeSingle(),
        supabase.rpc("my_role"),
      ]);
      setProfile(data ? toProfile(data) : null);
      if (roleErr) {
        // baza još bez migracije (nema my_role) → staro ponašanje
        const { data: adm } = await supabase.rpc("am_i_admin");
        setIsAdmin(adm === true);
        setIsTester(false);
      } else {
        setIsAdmin(role === "admin");
        setIsTester(role === "tester");
      }
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

  const setHoldSafe = useCallback((h: Wallet | null) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdRef.current = h;
    setHold(h);
    if (h) holdTimer.current = setTimeout(() => setHold(null), SAFETY_RELEASE);
  }, []);

  // holdWallet / deferCredit moraju biti STABILNE funkcije: Supabase pri osvježavanju tokena (npr. povratak na tab)
  // postavi novi `user` objekt, a promjena identiteta je u BattleView pokretala cleanup koji je otpuštao zamrznuto stanje
  // usred vrtnje — pa se dobitak vidio prije kraja battlea.
  const userRef = useRef<User | null>(null);
  const loadRef = useRef(loadProfile);
  useEffect(() => {
    userRef.current = user;
    loadRef.current = loadProfile;
  }, [user, loadProfile]);

  const holdWallet = useCallback(
    (h: Wallet | null) => {
      setHoldSafe(h);
      if (!h) loadRef.current(userRef.current);
    },
    [setHoldSafe]
  );

  const deferCredit = useCallback(
    (amount: number) => {
      // već zamrznuto prije isplate (npr. pri ulasku u battle) → ta vrijednost je točna, ne diraj
      const user = userRef.current;
      if (holdRef.current || !user) return;
      const p = profileRef.current;
      // odmah zamrzni ono što je na ekranu, pa iz svježeg stanja oduzmi dobitak
      // (lokalni profil je možda već povukao isplatu, npr. periodičnim osvježavanjem)
      if (p) setHoldSafe({ balance: p.balance, gems: p.gems });
      supabase
        .from("profiles")
        .select("balance")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data && holdRef.current) setHoldSafe({ ...holdRef.current, balance: Math.max(0, Number(data.balance) - amount) });
        });
    },
    [supabase, setHoldSafe]
  );

  const shownProfile = useMemo(
    () => (hold && profile ? { ...profile, balance: hold.balance, gems: hold.gems ?? profile.gems } : profile),
    [hold, profile]
  );

  return (
    <AuthCtx value={{ user, profile: shownProfile, isAdmin, isTester, loading, refresh, holdWallet, deferCredit, signOut }}>{children}</AuthCtx>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth mora biti unutar AuthProvider");
  return c;
}
