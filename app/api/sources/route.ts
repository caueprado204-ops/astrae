import { NextResponse } from "next/server";
import { getSourceStatuses } from "@/services/sources/registry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const c = await getSourceStatuses();
  return NextResponse.json({ status: "ok", data: c.value, cache: { hit: c.hit, stale: c.stale, storedAt: c.storedAt } });
}
