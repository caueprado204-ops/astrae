import { cached } from "@/lib/cache";
import { badRequest, fail, nowIso, ok } from "@/lib/envelope";
import { getApod } from "@/services/nasa/apod";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") || undefined;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest("date must be YYYY-MM-DD");
  const prov = {
    source: "NASA", institution: "NASA Goddard Space Flight Center", dataset: "Astronomy Picture of the Day",
    kind: "IMAGERY" as const, originalUrl: "https://apod.nasa.gov/apod/", apiEndpoint: "https://api.nasa.gov/planetary/apod",
    accessedAt: nowIso()
  };
  try {
    const c = await cached(`apod:${date || "today"}`, 3 * 3600e3, () => getApod(date));
    return ok(c, { ...prov, period: c.value.date });
  } catch (e) { return fail(e, prov); }
}
