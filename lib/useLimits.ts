"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LIMITS, loadLimits, type Limits } from "./limits";

export function useLimits(): Limits {
  const [l, setL] = useState<Limits>(DEFAULT_LIMITS);
  useEffect(() => {
    loadLimits().then(setL);
  }, []);
  return l;
}
