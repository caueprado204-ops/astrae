"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./env";

let browser: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!browser) browser = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return browser;
}
