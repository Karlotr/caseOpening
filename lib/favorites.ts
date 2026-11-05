"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/AuthProvider";

// Omiljene kutije. Prijavljenima se spremaju na račun (Supabase) i uvijek i lokalno kao rezerva,
// neprijavljenima samo u preglednik. Jedna zajednička memorija za sve kartice na stranici.
const GUEST_KEY = "garaza-fav-cases"; // stari ključ (prije računa) = gost
const EVT = "garaza-fav-change";
const userKey = (uid: string) => `garaza-fav-cases:${uid}`;

const readKey = (k: string): number[] => {
  try {
    const v = JSON.parse(localStorage.getItem(k) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
};
const writeKey = (k: string, v: number[]) => {
  try {
    if (v.length) localStorage.setItem(k, JSON.stringify(v));
    else localStorage.removeItem(k);
  } catch {}
};

let owner: string | null | undefined; // undefined = još ništa učitano
let ids: number[] = [];
let ready = false; // za prijavljene: je li dohvat sa servera gotov
const pending = new Map<number, boolean>(); // klikovi dok se dohvat još učitava
const emit = () => window.dispatchEvent(new Event(EVT));
const keyOf = (uid: string | null) => (uid ? userKey(uid) : GUEST_KEY);
const save = (uid: string | null) => writeKey(keyOf(uid), ids);

function load(uid: string | null) {
  if (owner === uid) return;
  owner = uid;
  pending.clear();
  ids = readKey(keyOf(uid));
  ready = !uid;
  if (!uid) return;
  const guest = readKey(GUEST_KEY);
  const local = [...new Set([...ids, ...guest])];
  ids = local;
  const sb = createClient();
  (async () => {
    // lokalni favoriti (gost + rezerva) se spoje s onima na računu
    const { data, error } = local.length ? await sb.rpc("add_favorite_cases", { p_cases: local }) : await sb.rpc("my_favorite_cases");
    if (owner !== uid) return;
    if (!error && Array.isArray(data)) {
      ids = (data as number[]).map(Number);
      if (guest.length) writeKey(GUEST_KEY, []);
    }
    ready = true;
    // primijeni klikove koji su se dogodili za vrijeme učitavanja
    for (const [id, on] of pending) {
      const has = ids.includes(id);
      if (on !== has) {
        ids = on ? [...ids, id] : ids.filter((x) => x !== id);
        void sb.rpc("set_favorite_case", { p_case: id, p_on: on });
      }
    }
    pending.clear();
    save(uid);
    emit();
  })();
}

export function useFavorites() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [fav, setFav] = useState<number[]>([]);

  useEffect(() => {
    load(uid);
    const sync = () => setFav(owner === uid ? [...ids] : []);
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === keyOf(uid)) {
        ids = readKey(keyOf(uid));
        emit();
      }
    };
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, [uid]);

  const toggle = useCallback(
    (id: number) => {
      const on = !ids.includes(id);
      ids = on ? [...ids, id] : ids.filter((x) => x !== id);
      save(uid);
      emit();
      if (!uid) return;
      if (!ready) {
        pending.set(id, on);
        return;
      }
      // server je izvor istine; ako ne odgovori (npr. migracija nije pokrenuta), ostaje lokalno
      createClient()
        .rpc("set_favorite_case", { p_case: id, p_on: on })
        .then(({ data, error }) => {
          if (owner !== uid || error || typeof data !== "boolean") return;
          if (data !== ids.includes(id) && ids.includes(id) === on) {
            // server je odbio (npr. limit 200) — uskladi s njim
            ids = data ? [...ids, id] : ids.filter((x) => x !== id);
            save(uid);
            emit();
          }
        });
    },
    [uid]
  );

  return { fav, isFav: (id: number) => fav.includes(id), toggle };
}
