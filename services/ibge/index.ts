import "server-only";
import { fetchJson } from "@/lib/http";

/**
 * IBGE — três serviços oficiais, sem chave:
 *  - Localidades v1  https://servicodados.ibge.gov.br/api/docs/localidades   (municípios, regiões imediatas)
 *  - Malhas v3       https://servicodados.ibge.gov.br/api/docs/malhas?versao=3 (GeoJSON)
 *  - SIDRA           https://apisidra.ibge.gov.br/                              (tabelas do Censo e do PIB)
 */
export const IBGE_LOCALIDADES = "https://servicodados.ibge.gov.br/api/v1/localidades";
export const IBGE_MALHAS = "https://servicodados.ibge.gov.br/api/v3/malhas";
export const SIDRA = "https://apisidra.ibge.gov.br/values";
export const SIDRA_DOCS = "https://apisidra.ibge.gov.br/home/ajuda";

export const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"] as const;

/* ───────── Localidades ───────── */

export interface Municipality { id: string; name: string; uf: string; immediateRegion?: { id: string; name: string } }

interface RawMun {
  id: number; nome: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } } | null;
  "regiao-imediata"?: { id: number; nome: string; "regiao-intermediaria"?: { UF?: { sigla?: string } } } | null;
}

export function parseMunicipality(m: RawMun, ufHint?: string): Municipality {
  const ri = m["regiao-imediata"];
  const uf = ri?.["regiao-intermediaria"]?.UF?.sigla || m.microrregiao?.mesorregiao?.UF?.sigla || ufHint || "";
  return { id: String(m.id), name: m.nome, uf, immediateRegion: ri ? { id: String(ri.id), name: ri.nome } : undefined };
}

export async function listMunicipalities(uf: string) {
  const raw = await fetchJson<RawMun[]>(`${IBGE_LOCALIDADES}/estados/${uf}/municipios`, { timeoutMs: 20000 });
  return raw.map((m) => parseMunicipality(m, uf)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function getMunicipality(id: string) {
  const raw = await fetchJson<RawMun>(`${IBGE_LOCALIDADES}/municipios/${id}`, { timeoutMs: 20000 });
  return parseMunicipality(raw);
}

export async function immediateRegionMunicipalities(regionId: string) {
  const raw = await fetchJson<RawMun[]>(`${IBGE_LOCALIDADES}/regioes-imediatas/${regionId}/municipios`, { timeoutMs: 20000 });
  return raw.map((m) => parseMunicipality(m));
}

/* ───────── Malhas (GeoJSON) ───────── */

type Ring = [number, number][];
export interface Feature { type: "Feature"; properties: Record<string, unknown>; geometry: { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] } }
export interface FeatureCollection { type: "FeatureCollection"; features: Feature[] }

export const featureCode = (f: Feature) => String(f.properties?.codarea ?? f.properties?.id ?? "");

/** Malha de todos os municípios de uma UF (código numérico da UF = 2 primeiros dígitos do código do município). */
export async function stateMunicipalMesh(ufCode: string) {
  const q = new URLSearchParams({ formato: "application/vnd.geo+json", intrarregiao: "municipio", qualidade: "minima" });
  const url = `${IBGE_MALHAS}/estados/${ufCode}?${q}`;
  const fc = await fetchJson<FeatureCollection>(url, { timeoutMs: 40000 });
  return { fc, url };
}

/** Área (km²) e centróide de polígonos em lon/lat — aproximação esférica, suficiente para posicionar e comparar. */
export function areaAndCentroid(f: Feature) {
  const R = 6371.0088;
  const polys: Ring[][] = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  let A = 0, cx = 0, cy = 0;
  for (const poly of polys) poly.forEach((ring, ri) => {
    const sign = ri === 0 ? 1 : -1; // furos subtraem
    let a = 0, x = 0, y = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
      const c = x0 * y1 - x1 * y0;
      a += c; x += (x0 + x1) * c; y += (y0 + y1) * c;
    }
    a /= 2;
    if (a === 0) return;
    const lat = (y / (6 * a)) * Math.PI / 180;
    const km2 = Math.abs(a) * (Math.PI / 180) ** 2 * R * R * Math.cos(lat);
    A += sign * km2; cx += sign * km2 * (x / (6 * a)); cy += sign * km2 * (y / (6 * a));
  });
  return { areaKm2: A, lon: A ? cx / A : NaN, lat: A ? cy / A : NaN };
}

/* ───────── SIDRA ───────── */

/** A API SIDRA devolve um array cuja primeira linha é o cabeçalho; os dados começam na segunda. */
export interface SidraRow { D1C: string; D1N: string; D2C: string; D2N: string; D3N: string; MN: string; V: string; [k: string]: string }

export function parseSidra(raw: SidraRow[]) {
  return raw.slice(1).map((r) => ({ ...r, value: /^-?\d+(\.\d+)?$/.test(r.V) ? Number(r.V) : null }));
}

export async function sidra(path: string) {
  const url = `${SIDRA}${path}`;
  const raw = await fetchJson<SidraRow[]>(url, { timeoutMs: 30000 });
  return { rows: parseSidra(raw), url };
}

/** Faixas de 65 anos ou mais na tabela 9514 (Censo 2022), conferidas na resposta da API. */
export const AGE_65_PLUS = ["93096", "93097", "93098", "49108", "49109", "60040", "60041", "6653"];
export const AGE_TOTAL = "100362";
