import "server-only";
import { cached } from "@/lib/cache";
import { fetchText } from "@/lib/http";
import { apodUrl } from "@/services/nasa/apod";
import { usingDemoKey } from "@/services/nasa/key";
import { GIBS_CAPABILITIES } from "@/services/nasa/gibs";
import { MSL_WEATHER_URL } from "@/services/mars/weather";
import { ONI_URL } from "@/services/enso/oni";
import { CPTEC_BASE } from "@/services/inpe/cptec";
import { CDO_BASE, CDO_DOCS, noaaConfigured } from "@/services/noaa/cdo";

export type SourceState = "connected" | "unavailable" | "key-required" | "pending";

export interface SourceDef {
  id: string; institution: string; api: string; dataset: string; docs: string;
  probe?: string; needsKey?: () => boolean; pending?: string; note?: () => string | undefined;
}

export const SOURCES: SourceDef[] = [
  { id: "nasa-apod", institution: "NASA", api: "NASA Open APIs — APOD", dataset: "Astronomy Picture of the Day",
    docs: "https://api.nasa.gov", probe: apodUrl(), note: () => (usingDemoKey() ? "Usando DEMO_KEY — configure NASA_API_KEY" : undefined) },
  { id: "nasa-images", institution: "NASA", api: "NASA Image and Video Library", dataset: "images.nasa.gov",
    docs: "https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf", probe: "https://images-api.nasa.gov/search?q=mars&page_size=1" },
  { id: "nasa-cmr", institution: "NASA Earthdata", api: "Common Metadata Repository (CMR)", dataset: "Catálogo de coleções EOSDIS",
    docs: "https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html", probe: "https://cmr.earthdata.nasa.gov/search/collections.json?keyword=sst&page_size=1" },
  { id: "nasa-ntrs", institution: "NASA STI", api: "Technical Reports Server (NTRS)", dataset: "Publicações técnicas e científicas",
    docs: "https://ntrs.nasa.gov/api/openapi/", probe: "https://ntrs.nasa.gov/api/citations/search?q=mars&page.size=1" },
  { id: "nasa-gibs", institution: "NASA ESDIS", api: "GIBS WMTS (EPSG:3857)", dataset: "Camadas de observação da Terra",
    // probe leve: um tile real (o GetCapabilities completo tem vários MB e é usado só no catálogo de camadas)
    docs: GIBS_CAPABILITIES, probe: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MERRA2_2m_Air_Temperature_Monthly/default/default/GoogleMapsCompatible_Level6/0/0/0.png" },
  { id: "nasa-power", institution: "NASA Langley", api: "POWER API", dataset: "Daily / Climatology (MERRA-2, CERES)",
    docs: "https://power.larc.nasa.gov/docs/services/api/",
    probe: "https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M&community=AG&latitude=-15.8&longitude=-47.9&format=JSON" },
  { id: "nasa-msl", institution: "NASA/JPL · CAB", api: "Mars weather feed (REMS)", dataset: "Curiosity REMS — dados por sol",
    docs: "https://mars.nasa.gov/msl/weather/", probe: MSL_WEATHER_URL },
  { id: "nasa-raw", institution: "NASA/JPL", api: "Mars raw images", dataset: "Curiosity / Perseverance",
    docs: "https://mars.nasa.gov/msl/multimedia/raw-images/", probe: "https://mars.nasa.gov/api/v1/raw_image_items/?per_page=1&page=0&condition_1=msl:mission" },
  { id: "nasa-trek", institution: "NASA Solar System Treks", api: "Mars Trek WMTS", dataset: "Viking MDIM 2.1 mosaico global",
    docs: "https://trek.nasa.gov/mars/", probe: "https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/WMTSCapabilities.xml" },
  { id: "nasa-rover-photos", institution: "NASA", api: "Mars Rover Photos API", dataset: "—",
    docs: "https://api.nasa.gov", pending: "Arquivada pela NASA. Substituída pelas APIs de imagens brutas da JPL e pela NASA Image Library." },
  { id: "nasa-pds", institution: "NASA PDS", api: "Planetary Data System", dataset: "Arquivos científicos planetários",
    docs: "https://pds.nasa.gov/", pending: "Integration pending — acesso por arquivos/PDS4; adaptador planejado." },
  { id: "noaa-oni", institution: "NOAA", api: "CPC — índices climáticos", dataset: "Oceanic Niño Index (ONI)",
    docs: "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/ONI_v5.php", probe: ONI_URL },
  { id: "noaa-cdo", institution: "NOAA NCEI", api: "Climate Data Online v2", dataset: "GHCN-Daily e outros",
    docs: CDO_DOCS, probe: `${CDO_BASE}/datasets?limit=1`, needsKey: () => !noaaConfigured() },
  { id: "inpe-cptec", institution: "CPTEC/INPE", api: "Serviço XML de previsão", dataset: "Previsão municipal e condições atuais",
    docs: "http://servicos.cptec.inpe.br/XML/", probe: `${CPTEC_BASE}/capitais/condicoesAtuais.xml` },
  { id: "inmet", institution: "INMET", api: "API Tempo / BDMEP", dataset: "Estações meteorológicas",
    docs: "https://portal.inmet.gov.br/manual", pending: "Integration pending — exige token institucional." }
];

export interface SourceStatus extends Omit<SourceDef, "probe" | "needsKey" | "note" | "pending"> {
  state: SourceState; latencyMs?: number; checkedAt: string; detail?: string;
}

async function probe(def: SourceDef): Promise<SourceStatus> {
  const base = { id: def.id, institution: def.institution, api: def.api, dataset: def.dataset, docs: def.docs };
  const checkedAt = new Date().toISOString();
  if (def.pending) return { ...base, state: "pending", checkedAt, detail: def.pending };
  if (def.needsKey?.()) return { ...base, state: "key-required", checkedAt, detail: "Chave/token não configurado no .env" };
  if (!def.probe) return { ...base, state: "pending", checkedAt };
  const t0 = Date.now();
  try {
    const headers: Record<string, string> = def.id === "noaa-cdo" ? { token: process.env.NOAA_API_KEY || "" } : {};
    await fetchText(def.probe, { timeoutMs: 15000, headers });
    return { ...base, state: "connected", latencyMs: Date.now() - t0, checkedAt, detail: def.note?.() };
  } catch (e) {
    return { ...base, state: "unavailable", checkedAt, detail: (e as Error).message };
  }
}

export async function getSourceStatuses() {
  return cached("sources:status", 10 * 60e3, () => Promise.all(SOURCES.map(probe)));
}
