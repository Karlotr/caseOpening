"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/AuthProvider";

// Omiljene kutije — prijavljenima se spremaju na račun (Supabase), neprijavljenima u preglednik.
// Jedna zajednička memorija za sve kartice na stranici: dohvat ide samo jednom po korisniku.
const KEY = "garaza-fav-cases";
const EVT = "garaza-fav-change";

const readLocal = (): number[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
};
const writeLocal = (ids: number[]) => {
  try {
    if (ids.length) localStorage.setItem(KEY, JSON.stringify(ids));
    else localStorage.removeItem(KEY);
  } catch {}
};

let ownerId: string | null = null; // čiji su favoriti u memoriji (null = preglednik)
let ids: number[] = [];
let loading: Promise<void> | null = null;
const emit = () => window.dispatchEvent(new Event(EVT));

function ensureLoaded(uid: string | null) {
  if (!uid) {
    ownerId = null;
    loading = null;
    ids = readLocal();
    return;
  }
  if (ownerId === uid && loading) return;
  ownerId = uid;
  const sb = createClient();
  loading = (async () => {
    const local = readLocal();
    // stari favoriti iz preglednika se jednom prenesu na račun
    const { data, error } = local.length
      ? await sb.rpc("add_favorite_cases", { p_cases: local })
      : await sb.rpc("my_favorite_cases");
    if (ownerId !== uid) return;
    if (error) {
      ids = local; // npr. migracija još nije pokrenuta — radi kao prije
    } else {
      ids = ((data as number[] | null) ?? []).map(Number);
      if (local.length) writeLocal([]);
    }
    emit();
  })();
}

export function useFavorites() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [fav, setFav] = useState<number[]>([]);

  useEffect(() => {
    ensureLoaded(uid);
    const sync = () => setFav(ownerId === uid ? [...ids] : []);
    sync();
    const onStorage = () => {
      if (!uid) {
        ids = readLocal();
        sync();
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
      const was = ids.includes(id);
      ids = was ? ids.filter((x) => x !== id) : [...ids, id];
      emit();
      if (!uid) {
        writeLocal(ids);
        return;
      }
      createClient()
        .rpc("toggle_favorite_case", { p_case: id })
        .then(({ data, error }) => {
          if (ownerId !== uid) return;
          if (error) {
            // vrati na staro ako server odbije
            ids = was ? [...ids, id] : ids.filter((x) => x !== id);
            emit();
          } else if (typeof data === "boolean" && data !== ids.includes(id)) {
            ids = data ? [...ids, id] : ids.filter((x) => x !== id);
            emit();
          }
        });
    },
    [uid]
  );

  return { fav, isFav: (id: number) => fav.includes(id), toggle };
}
