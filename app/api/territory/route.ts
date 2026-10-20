import { NextResponse } from "next/server";
import { badRequest, fail, nowIso } from "@/lib/envelope";
import { getTerritoryIndicators, INDICATORS } from "@/services/territory/indicators";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/territory?ids=3509502,3501608 (até 25 municípios) */
export async function GET(req: Request) {
  const ids = Array.from(new Set((new URL(req.url).searchParams.get("ids") || "").split(",").filter((x) => /^\d{7}$/.test(x))));
  if (ids.length === 0 || ids.length > 25) return badRequest("informe de 1 a 25 códigos IBGE de 7 dígitos");
  const prov = { source: "IBGE + NASA + InfoDengue", institution: "IBGE · NASA Langley · Fiocruz/FGV", dataset: "Indicadores municipais (ver definição de cada indicador)",
    kind: "ESTIMATE" as const, originalUrl: "https://apisidra.ibge.gov.br/", accessedAt: nowIso(),
    methodology: "Cada indicador tem fonte, ano e tipo próprios (campo indicators). Indicadores calculados pela ASTRAE são marcados como ESTIMATE." };
  try {
    const data = await getTerritoryIndicators(ids);
    return NextResponse.json({ status: "ok", data: { ...data, indicators: INDICATORS }, provenance: { ...prov, apiEndpoint: data.urls.join(" | ") } });
  } catch (e) { return fail(e, prov); }
}
