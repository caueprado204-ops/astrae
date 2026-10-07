import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

/** Troca o código do link mágico / OAuth por sessão. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/overview";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/overview";
  const supabase = getServerClient();
  if (code && supabase) await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
