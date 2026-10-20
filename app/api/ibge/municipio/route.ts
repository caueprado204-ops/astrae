import { badRequest, fail, nowIso } from "@/lib/envelope";
import { NextResponse } from "next/server";
import { locateMunicipality } from "@/services/ibge/locate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^\d{7}$/.test(id)) return badRequest("id deve ser o código IBGE de 7 dígitos");
  const prov = { source: "IBGE", institution: "IBGE", dataset: "Localidades + Malhas municipais", kind: "CATALOG" as const,
    originalUrl: "https://servicodados.ibge.gov.br/api/docs/malhas?versao=3", accessedAt: nowIso(),
    methodology: "Centróide e área calculados pela ASTRAE a partir da malha oficial (qualidade mínima); servem para posicionar o ponto de consulta climática." };
  try {
    const data = await locateMunicipality(id);
    return NextResponse.json({ status: "ok", data, provenance: { ...prov, apiEndpoint: data.meshUrl } });
  } catch (e) { return fail(e, prov); }
}
