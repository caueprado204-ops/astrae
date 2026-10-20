import { cached } from "@/lib/cache";
import { badRequest, fail, nowIso, ok } from "@/lib/envelope";
import { DISEASES, getArboWeeks, INFODENGUE_DOCS, isDisease } from "@/services/health/infodengue";

export const dynamic = "force-dynamic";

/** GET /api/health/arbovirus?geocode=3509502&disease=dengue&from=2025&to=2026 — só a série de saúde (InfoDengue). */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const geocode = sp.get("geocode") || "", disease = sp.get("disease") || "dengue";
  const y = new Date().getUTCFullYear();
  const from = Number(sp.get("from") || y - 1), to = Number(sp.get("to") || y);
  if (!/^\d{7}$/.test(geocode)) return badRequest("geocode deve ser o código IBGE de 7 dígitos");
  if (!isDisease(disease)) return badRequest("disease: dengue | chikungunya | zika");
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 2010 || to > y || to < from || to - from > 11) return badRequest("período inválido");
  const prov = { source: "InfoDengue", institution: "Fiocruz / FGV EMAp", dataset: `${DISEASES[disease]} — casos notificados por semana epidemiológica`,
    kind: "OBSERVED" as const, originalUrl: INFODENGUE_DOCS, accessedAt: nowIso(), period: `${from}–${to}`, unit: "casos/semana",
    methodology: "Notificações do SINAN processadas pelo InfoDengue; valores das semanas recentes são revisados retroativamente." };
  try {
    const c = await cached(`infodengue:${geocode}:${disease}:${from}-${to}`, 12 * 3600e3, () => getArboWeeks(geocode, disease, from, to));
    return ok(c, { ...prov, apiEndpoint: c.value.url, location: c.value.weeks.at(-1)?.municipality }, (v) => v.weeks.length === 0);
  } catch (e) { return fail(e, prov); }
}
