import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./env";

export function getServerClient() {
  if (!supabaseConfigured) return null;
  const store = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options?: CookieOptions }[]) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* RSC: read-only */ }
      }
    }
  });
}
