import "server-only";
import { fetchText } from "@/lib/http";
import { cached } from "@/lib/cache";
import type { DataKind } from "@/types/science";

/**
 * NASA GIBS (Global Imagery Browse Services) — WMTS em EPSG:3857.
 * Docs: https://nasa-gibs.github.io/gibs-api-docs/
 * Os IDs de camada NÃO são fixados às cegas: a ASTRAE lê o GetCapabilities oficial e só expõe
 * camadas que realmente existem, com o TileMatrixSet, formato, datas e legenda declarados pela NASA.
 */

export const GIBS_CAPABILITIES = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml";

export interface GibsLayer {
  id: string;
  title: string;
  tileMatrixSet: string;
  maxZoom: number;
  format: string;
  ext: "png" | "jpg";
  defaultTime?: string;
  timeRanges: string[];
  periodicity?: "P1D" | "P1M" | "P1Y" | string;
  legendUrl?: string;
  hasTime: boolean;
}

export interface VariableDef {
  key: string;
  label: string;
  kind: DataKind;
  candidates: string[];
  pattern?: RegExp;
  note?: string;
}

/** Variáveis da ASTRAE → candidatos oficiais no GIBS (validados contra o GetCapabilities em tempo de execução). */
export const EARTH_VARIABLES: VariableDef[] = [
  { key: "base", label: "Mapa base (Blue Marble)", kind: "IMAGERY",
    candidates: ["BlueMarble_ShadedRelief_Bathymetry", "BlueMarble_NextGeneration", "BlueMarble_ShadedRelief"], pattern: /^BlueMarble/i },
  { key: "truecolor", label: "Imagem real (cor verdadeira)", kind: "IMAGERY",
    candidates: ["MODIS_Terra_CorrectedReflectance_TrueColor", "VIIRS_SNPP_CorrectedReflectance_TrueColor", "VIIRS_NOAA20_CorrectedReflectance_TrueColor"] },
  { key: "temperature", label: "Temperatura do ar (2 m)", kind: "MODEL",
    candidates: ["MERRA2_2m_Air_Temperature_Monthly", "MERRA2_2m_Air_Temperature_Assimilated_Monthly"], pattern: /Air_Temperature/i,
    note: "Reanálise MERRA-2 (modelo assimilado), média mensal." },
  { key: "lst", label: "Temperatura da superfície terrestre", kind: "OBSERVED",
    candidates: ["MODIS_Terra_Land_Surface_Temp_Day", "MODIS_Aqua_Land_Surface_Temp_Day"], pattern: /Land_Surface_Temp/i },
  { key: "precipitation", label: "Precipitação", kind: "ESTIMATE",
    candidates: ["IMERG_Precipitation_Rate", "IMERG_Precipitation_Rate_30min"], pattern: /Precipitation_Rate|Precipitation/i,
    note: "Estimativa por satélite (GPM IMERG)." },
  { key: "clouds", label: "Nuvens", kind: "OBSERVED",
    candidates: ["MODIS_Terra_Cloud_Top_Temp_Day", "MODIS_Terra_Cloud_Fraction_Day"], pattern: /Cloud_(Top|Fraction)/i },
  { key: "wind", label: "Vento", kind: "MODEL", candidates: [], pattern: /Wind_Speed|Wind/i },
  { key: "pressure", label: "Pressão", kind: "MODEL", candidates: [], pattern: /Sea_Level_Pressure|Surface_Pressure|Pressure/i },
  { key: "humidity", label: "Umidade / vapor d’água", kind: "OBSERVED", candidates: [], pattern: /Relative_Humidity|Water_Vapor|Precipitable_Water/i },
  { key: "aerosols", label: "Aerossóis", kind: "OBSERVED",
    candidates: ["MODIS_Combined_Value_Added_AOD", "MODIS_Terra_Aerosol", "OMI_Aerosol_Index"], pattern: /Aerosol_Optical|AOD|Aerosol_Index/i },
  { key: "sst", label: "Temperatura da superfície do mar", kind: "MODEL",
    candidates: ["GHRSST_L4_MUR_Sea_Surface_Temperature"], pattern: /Sea_Surface_Temperature(?!_Anomal)/i,
    note: "GHRSST L4 MUR — análise multissensor (interpolada)." },
  { key: "sst_anomaly", label: "Anomalia de TSM", kind: "MODEL",
    candidates: ["GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies"], pattern: /Sea_Surface_Temperature_Anomal/i },
  { key: "labels", label: "Fronteiras e linhas costeiras", kind: "CATALOG",
    candidates: ["Coastlines_15m", "Reference_Features_15m", "Coastlines"], pattern: /^Coastlines/i }
];

function tag(block: string, re: RegExp) {
  const m = block.match(re);
  return m ? m[1] : undefined;
}

export function parseCapabilities(xml: string): Map<string, GibsLayer> {
  const out = new Map<string, GibsLayer>();
  const blocks = xml.split("<Layer>").slice(1);
  for (const b of blocks) {
    const id = tag(b, /<ows:Identifier>([^<]+)<\/ows:Identifier>/);
    if (!id) continue;
    const tms = tag(b, /<TileMatrixSet>([^<]+)<\/TileMatrixSet>/) || "";
    const format = tag(b, /<Format>([^<]+)<\/Format>/) || "image/png";
    const values = [...b.matchAll(/<Value>([^<]+)<\/Value>/g)].map((m) => m[1]);
    const hasTime = /<ows:Identifier>Time<\/ows:Identifier>/.test(b);
    const lastRange = values[values.length - 1];
    out.set(id, {
      id,
      title: tag(b, /<ows:Title[^>]*>([^<]+)<\/ows:Title>/) || id,
      tileMatrixSet: tms,
      maxZoom: Number(tms.match(/Level(\d+)/)?.[1] ?? 6),
      format,
      ext: format.includes("jpeg") ? "jpg" : "png",
      defaultTime: tag(b, /<Default>([^<]+)<\/Default>/),
      timeRanges: values.slice(-6),
      periodicity: lastRange?.split("/")[2],
      legendUrl: tag(b, /<LegendURL[^>]*xlink:href='([^']+_H\.svg)'/) || tag(b, /<LegendURL[^>]*xlink:href="([^"]+_H\.svg)"/),
      hasTime
    });
  }
  return out;
}

export async function getGibsLayers() {
  return cached("gibs:capabilities:3857", 12 * 3600 * 1000, async () => {
    const xml = await fetchText(GIBS_CAPABILITIES, { timeoutMs: 45000 });
    const map = parseCapabilities(xml);
    if (map.size === 0) throw new Error("GIBS capabilities parse returned no layers");
    return Object.fromEntries(map);
  });
}

export interface ResolvedVariable extends Omit<VariableDef, "pattern"> {
  available: boolean;
  layers: GibsLayer[];
}

export function resolveVariables(all: Record<string, GibsLayer>): ResolvedVariable[] {
  const ids = Object.keys(all);
  return EARTH_VARIABLES.map(({ pattern, ...v }) => {
    const found: GibsLayer[] = [];
    for (const c of v.candidates) if (all[c]) found.push(all[c]);
    if (found.length === 0 && pattern) {
      for (const id of ids) {
        if (pattern.test(id) && found.length < 3) found.push(all[id]);
      }
    }
    return { ...v, available: found.length > 0, layers: found };
  });
}
