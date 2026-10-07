import { cached } from "@/lib/cache";
import { badRequest, fail, nowIso, ok } from "@/lib/envelope";
import { fetchJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Geocodificação via Nominatim (OpenStreetMap) — apenas para localizar o mapa, nunca como dado científico. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return badRequest("q required");
  const prov = { source: "OpenStreetMap", institution: "OpenStreetMap Foundation (Nominatim)", dataset: "Geocoding",
    kind: "CATALOG" as const, originalUrl: "https://nominatim.org/release-docs/latest/api/Search/", accessedAt: nowIso(),
    license: "© OpenStreetMap contributors, ODbL" };
  try {
    const contact = process.env.GEOCODER_CONTACT ? `&email=${encodeURIComponent(process.env.GEOCODER_CONTACT)}` : "";
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}${contact}`;
    const c = await cached(`geo:${q.toLowerCase()}`, 30 * 86400e3, async () =>
      (await fetchJson<{ display_name: string; lat: string; lon: string; boundingbox: string[] }[]>(url))
        .map((r) => ({ name: r.display_name, lat: Number(r.lat), lon: Number(r.lon), bbox: r.boundingbox.map(Number) })));
    return ok(c, prov);
  } catch (e) { return fail(e, prov); }
}
