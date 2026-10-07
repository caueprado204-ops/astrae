import { fail, nowIso, ok } from "@/lib/envelope";
import { getGibsLayers, resolveVariables, GIBS_CAPABILITIES } from "@/services/nasa/gibs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const prov = { source: "NASA", institution: "NASA ESDIS · GIBS", dataset: "GIBS WMTS EPSG:3857 (best)", kind: "IMAGERY" as const,
    originalUrl: "https://nasa-gibs.github.io/gibs-api-docs/", apiEndpoint: GIBS_CAPABILITIES, accessedAt: nowIso() };
  try {
    const c = await getGibsLayers();
    const variables = resolveVariables(c.value);
    return ok({ ...c, value: { variables, totalLayers: Object.keys(c.value).length } }, prov);
  } catch (e) { return fail(e, prov); }
}
