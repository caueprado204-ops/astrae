import { NextResponse } from "next/server";
import { badRequest, fail, nowIso } from "@/lib/envelope";
import { buildWeeklyDataset } from "@/services/health/analysis";
import { DISEASES, INFODENGUE_DOCS, isDisease } from "@/services/health/infodengue";
import { locateMunicipality } from "@/services/ibge/locate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/health/weekly?geocode=3509502&disease=dengue&from=2015&to=2025[&lat=&lon=] */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const geocode = sp.get("geocode") || "", disease = sp.get("disease") || "dengue";
  const from = Number(sp.get("from")), to = Number(sp.get("to"));
  const thisYear = new Date().getUTCFullYear();
  if (!/^\d{7}$/.test(geocode)) return badRequest("geocode deve ser o código IBGE de 7 dígitos");
  if (!isDisease(disease)) return badRequest("disease: dengue | chikungunya | zika");
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 2010 || to > thisYear || to < from || to - from > 11) return badRequest("período: anos entre 2010 e o atual, no máximo 12 anos");

  const prov = {
    source: "InfoDengue + NASA", institution: "Fiocruz/FGV (InfoDengue) · NASA Langley (POWER)",
    dataset: `${DISEASES[disease]} — casos notificados por semana epidemiológica × clima diário agregado por semana`,
    kind: "OBSERVED" as const, originalUrl: INFODENGUE_DOCS, accessedAt: nowIso(), period: `${from}–${to}`,
    methodology: "Casos: notificações semanais do InfoDengue (revisadas retroativamente; semanas recentes incompletas). Clima: NASA POWER diário (reanálise MERRA-2, grade ~0,5°×0,625°) no centróide do município, agregado nas mesmas semanas epidemiológicas; semanas com menos de 5 dias válidos ficam vazias. Saúde é OBSERVED (notificação); clima é MODEL.",
    notes: "Dados agregados e públicos. Nenhuma informação individual é usada."
  };
  try {
    let lat = Number(sp.get("lat")), lon = Number(sp.get("lon"));
    let place: string | undefined;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !sp.get("lat")) {
      const loc = await locateMunicipality(geocode);
      if (loc.lat == null || loc.lon == null) return fail(new Error("Não foi possível localizar o município na malha do IBGE"), prov);
      lat = loc.lat; lon = loc.lon; place = `${loc.municipality.name} (${loc.municipality.uf})`;
    }
    const d = await buildWeeklyDataset({ geocode, disease, from, to, lat, lon });
    return NextResponse.json({
      status: d.rows.length ? "ok" : "empty",
      data: { ...d, lat, lon, place: place || d.municipality },
      provenance: { ...prov, location: `${place || d.municipality || geocode} · ponto climático ${lat.toFixed(3)}, ${lon.toFixed(3)}`, apiEndpoint: d.urls.join(" | ") }
    });
  } catch (e) { return fail(e, prov); }
}
