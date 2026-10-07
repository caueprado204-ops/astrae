import { cached } from "@/lib/cache";
import { fail, nowIso, ok } from "@/lib/envelope";
import { CPTEC_DOCS, getCapitalsNow } from "@/services/inpe/cptec";

export const dynamic = "force-dynamic";

export async function GET() {
  const prov = { source: "INPE", institution: "CPTEC/INPE", dataset: "Condições atuais nas capitais (METAR)",
    kind: "OBSERVED" as const, originalUrl: CPTEC_DOCS, accessedAt: nowIso(), unit: "°C · hPa · % · km/h",
    location: "Aeroportos das capitais brasileiras",
    methodology: "Observações de superfície (METAR) redistribuídas pelo CPTEC." };
  try {
    const c = await cached("cptec:capitals", 30 * 60e3, getCapitalsNow);
    return ok(c, { ...prov, apiEndpoint: c.value.url }, (v) => v.rows.length === 0);
  } catch (e) { return fail(e, prov); }
}
