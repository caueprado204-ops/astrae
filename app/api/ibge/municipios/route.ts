import { cached } from "@/lib/cache";
import { badRequest, fail, nowIso, ok } from "@/lib/envelope";
import { listMunicipalities, UFS } from "@/services/ibge";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const uf = (new URL(req.url).searchParams.get("uf") || "").toUpperCase();
  if (!(UFS as readonly string[]).includes(uf)) return badRequest("uf inválida");
  const prov = { source: "IBGE", institution: "IBGE", dataset: "API de Localidades — municípios", kind: "CATALOG" as const,
    originalUrl: "https://servicodados.ibge.gov.br/api/docs/localidades", apiEndpoint: `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`, accessedAt: nowIso() };
  try {
    const c = await cached(`ibge:muns:${uf}`, 30 * 86400e3, () => listMunicipalities(uf));
    return ok(c, prov, (v) => v.length === 0);
  } catch (e) { return fail(e, prov); }
}
