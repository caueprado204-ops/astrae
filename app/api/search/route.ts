import { NextResponse } from "next/server";
import { scientificSearch } from "@/services/search";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ status: "error", error: "q is required" }, { status: 400 });
  if (q.length > 200) return NextResponse.json({ status: "error", error: "query too long" }, { status: 400 });
  const r = await scientificSearch(q);
  return NextResponse.json({ status: r.results.length ? "ok" : "empty", ...r, accessedAt: new Date().toISOString() });
}
