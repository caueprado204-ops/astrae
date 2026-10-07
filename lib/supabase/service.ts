import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

let client: SupabaseClient | null | undefined;

/** Cliente com service role — APENAS no servidor, apenas para a tabela api_cache. */
export function getServiceClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = SUPABASE_URL && key ? createClient(SUPABASE_URL, key, { auth: { persistSession: false } }) : null;
  return client;
}
