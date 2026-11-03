"use client";

import { useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { coins, errMsg } from "./format";
import type { LevelUp } from "./types";

// Poziv RPC funkcije + obrada grešaka i level-up obavijesti
export function useRpc() {
  const toast = useToast();
  const { refresh } = useAuth();
  return useCallback(
    async <T,>(fn: string, args: Record<string, unknown> = {}, opts: { silentRefresh?: boolean } = {}) => {
      const { data, error } = await createClient().rpc(fn, args);
      if (error) {
        toast(errMsg(error), "error");
        return null;
      }
      const lv = data as LevelUp | null;
      if (lv && typeof lv === "object" && "level_up" in lv && lv.level_up) {
        setTimeout(() => toast(`🏁 Level up! Sada si level ${lv.level_up} (+${coins(lv.bonus ?? 0)} coina)`, "gold"), 600);
      }
      if (!opts.silentRefresh) await refresh();
      return data as T;
    },
    [toast, refresh]
  );
}
