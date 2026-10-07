import "server-only";
import { getServiceClient } from "@/lib/supabase/service";

/**
 * Cache em duas camadas:
 *  1. memória do processo (rápido, por instância)
 *  2. tabela `api_cache` no Supabase (persistente, opcional — exige SUPABASE_SERVICE_ROLE_KEY)
 *
 * Quando a fonte oficial falha, devolvemos a última versão disponível marcada como `stale`,
 * para que a interface mostre "última atualização disponível" em vez de quebrar.
 */

interface Entry<T> { value: T; storedAt: number; ttlMs: number }

const g = globalThis as unknown as { __astraeCache?: Map<string, Entry<unknown>> };
const mem: Map<string, Entry<unknown>> = g.__astraeCache ?? (g.__astraeCache = new Map());
const MAX_ENTRIES = 500;

export interface CachedResult<T> {
  value: T;
  hit: boolean;
  stale: boolean;
  storedAt: string;
}

async function readPersistent<T>(key: string): Promise<Entry<T> | null> {
  const db = getServiceClient();
  if (!db) return null;
  try {
    const { data } = await db.from("api_cache").select("value, stored_at, ttl_ms").eq("key", key).maybeSingle();
    if (!data) return null;
    return { value: data.value as T, storedAt: new Date(data.stored_at).getTime(), ttlMs: data.ttl_ms };
  } catch {
    return null;
  }
}

function writePersistent(key: string, entry: Entry<unknown>) {
  const db = getServiceClient();
  if (!db) return;
  // fire-and-forget: falha de cache nunca derruba a requisição
  void db.from("api_cache").upsert({
    key,
    value: entry.value as never,
    stored_at: new Date(entry.storedAt).toISOString(),
    ttl_ms: entry.ttlMs
  }).then(() => undefined, () => undefined);
}

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<CachedResult<T>> {
  const now = Date.now();
  let entry = mem.get(key) as Entry<T> | undefined;
  if (!entry) {
    const p = await readPersistent<T>(key);
    if (p) { entry = p; mem.set(key, p); }
  }
  if (entry && now - entry.storedAt < entry.ttlMs) {
    return { value: entry.value, hit: true, stale: false, storedAt: new Date(entry.storedAt).toISOString() };
  }
  try {
    const value = await loader();
    const fresh: Entry<T> = { value, storedAt: now, ttlMs };
    if (mem.size >= MAX_ENTRIES) mem.delete(mem.keys().next().value as string);
    mem.set(key, fresh);
    writePersistent(key, fresh);
    return { value, hit: false, stale: false, storedAt: new Date(now).toISOString() };
  } catch (err) {
    if (entry) {
      return { value: entry.value, hit: true, stale: true, storedAt: new Date(entry.storedAt).toISOString() };
    }
    throw err;
  }
}
