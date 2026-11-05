"use client";

import { useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { errMsg } from "./format";

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
      // obavijesti za level up su namjerno isključene (level se i dalje vidi u navbaru)
      if (!opts.silentRefresh) await refresh();
      return data as T;
    },
    [toast, refresh]
  );
}
