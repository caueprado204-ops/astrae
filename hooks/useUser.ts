"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/client";

export function useUser() {
  const sb = getBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!sb);
  useEffect(() => {
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, [sb]);
  return { user, ready, configured: Boolean(sb), sb };
}
