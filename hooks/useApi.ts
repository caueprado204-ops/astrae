"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiEnvelope } from "@/types/science";

export type FetchState = "idle" | "loading" | "success" | "error" | "empty";

/** Hook padrão: Loading / Success / Error / No data, com envelope de proveniência. */
export function useApi<T>(url: string | null) {
  const [env, setEnv] = useState<ApiEnvelope<T> | null>(null);
  const [state, setState] = useState<FetchState>(url ? "loading" : "idle");
  const [tick, setTick] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (!url) { setState("idle"); return; }
    const my = ++seq.current;
    setState("loading");
    fetch(url)
      .then(async (r) => (await r.json()) as ApiEnvelope<T>)
      .then((j) => {
        if (my !== seq.current) return;
        setEnv(j);
        setState(j.status === "ok" ? "success" : j.status === "empty" ? "empty" : "error");
      })
      .catch((e) => {
        if (my !== seq.current) return;
        setEnv({ status: "error", data: null, provenance: null, error: String(e?.message || e) });
        setState("error");
      });
  }, [url, tick]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { env, data: env?.data ?? null, state, retry };
}
