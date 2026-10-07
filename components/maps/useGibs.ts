"use client";
import { useApi } from "@/hooks/useApi";
import type { Variable } from "./gibs-client";

export function useGibsVariables() {
  const r = useApi<{ variables: Variable[]; totalLayers: number }>("/api/nasa/gibs/layers");
  const byKey = Object.fromEntries((r.data?.variables || []).map((v) => [v.key, v])) as Record<string, Variable>;
  return { ...r, variables: r.data?.variables || [], byKey };
}
