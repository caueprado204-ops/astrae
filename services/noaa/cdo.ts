import "server-only";
import { fetchJson } from "@/lib/http";

/**
 * NOAA NCEI Climate Data Online (CDO) Web Services v2.
 * Docs: https://www.ncdc.noaa.gov/cdo-web/webservices/v2 — exige token (NOAA_API_KEY) no header "token".
 */
export const CDO_BASE = "https://www.ncei.noaa.gov/cdo-web/api/v2";
export const CDO_DOCS = "https://www.ncdc.noaa.gov/cdo-web/webservices/v2";
export const noaaConfigured = () => Boolean(process.env.NOAA_API_KEY);

async function cdo<T>(path: string, params: Record<string, string>) {
  const token = process.env.NOAA_API_KEY;
  if (!token) throw new Error("NOAA_API_KEY not configured");
  const url = `${CDO_BASE}/${path}?${new URLSearchParams(params)}`;
  return { body: await fetchJson<T>(url, { headers: { token } }), url };
}

export async function listDatasets() {
  return cdo<{ results?: { id: string; name: string; mindate: string; maxdate: string; datacoverage: number }[] }>("datasets", { limit: "50" });
}

export async function findStations(extent: [number, number, number, number], datasetid = "GHCND") {
  return cdo<{ results?: { id: string; name: string; latitude: number; longitude: number; mindate: string; maxdate: string; datacoverage: number }[] }>(
    "stations", { datasetid, extent: extent.join(","), limit: "50", sortfield: "datacoverage", sortorder: "desc" }
  );
}

/** Observações diárias GHCN-Daily (OBSERVED) — máx. 1 ano por requisição. */
export async function stationDaily(stationid: string, start: string, end: string) {
  return cdo<{ results?: { date: string; datatype: string; value: number }[] }>("data", {
    datasetid: "GHCND", stationid, startdate: start, enddate: end,
    datatypeid: "TMAX,TMIN,PRCP", units: "metric", limit: "1000"
  });
}
