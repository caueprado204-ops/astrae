import "server-only";
import { NextResponse } from "next/server";
import type { ApiEnvelope, Provenance } from "@/types/science";
import type { CachedResult } from "./cache";

export function ok<T>(c: CachedResult<T>, provenance: Provenance, isEmpty?: (v: T) => boolean) {
  const empty = isEmpty ? isEmpty(c.value) : Array.isArray(c.value) ? c.value.length === 0 : c.value == null;
  const body: ApiEnvelope<T> = {
    status: empty ? "empty" : "ok",
    data: c.value,
    provenance,
    cache: { hit: c.hit, stale: c.stale, storedAt: c.storedAt }
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}

export function fail(error: unknown, provenance: Provenance | null = null, status = 502) {
  const message = error instanceof Error ? error.message : String(error);
  const body: ApiEnvelope<null> = { status: "error", data: null, provenance, error: `Data source temporarily unavailable. ${message}` };
  return NextResponse.json(body, { status });
}

export function badRequest(message: string) {
  return NextResponse.json({ status: "error", data: null, provenance: null, error: message }, { status: 400 });
}

export const nowIso = () => new Date().toISOString();
