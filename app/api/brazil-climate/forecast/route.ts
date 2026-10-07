import { cached } from "@/lib/cache";
import { badRequest, fail, nowIso, ok } from "@/lib/envelope";
import { CPTEC_DOCS, getForecast7 } from "@/services/inpe/cptec";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("city"));
  if (!Number.isInteger(id) || id <= 0) return badRequest("city must be a CPTEC locality id");
  const prov = { source: "INPE", institution: "CPTEC/INPE", dataset: "Previsão de tempo 7 dias por município",
    kind: "FORECAST" as const, originalUrl: CPTEC_DOCS, accessedAt: nowIso(), unit: "°C",
    methodology: "Previsão operacional do CPTEC/INPE (modelos numéricos + meteorologistas)." };
  try {
    const c = await cached(`cptec:forecast:${id}`, 3 * 3600e3, () => getForecast7(id));
    return ok(c, { ...prov, apiEndpoint: c.value.url, location: `${c.value.city}/${c.value.uf}`, period: c.value.days.length ? `${c.value.days[0].date} → ${c.value.days[c.value.days.length - 1].date}` : undefined },
      (v) => v.days.length === 0);
  } catch (e) { return fail(e, prov); }
}
