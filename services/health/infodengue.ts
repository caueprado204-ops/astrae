import "server-only";
import { fetchJson } from "@/lib/http";

/**
 * InfoDengue (Fiocruz / FGV EMAp) — vigilância de arboviroses por município e semana epidemiológica.
 * Documentação: https://info.dengue.mat.br/services/api/doc
 * Dicionário de colunas: https://api.mosqlimate.org/docs/datastore/GET/infodengue/
 * Sem chave. Todos os parâmetros são obrigatórios.
 */
export const INFODENGUE_DOCS = "https://info.dengue.mat.br/services/api/doc";
export const INFODENGUE_API = "https://info.dengue.mat.br/api/alertcity";
export const DISEASES = { dengue: "Dengue", chikungunya: "Chikungunya", zika: "Zika" } as const;
export type Disease = keyof typeof DISEASES;
export const isDisease = (d: string): d is Disease => d in DISEASES;

export interface ArboWeek {
  se: number;            // ano*100 + semana (ex.: 202403)
  weekStart: string;     // ISO do domingo que inicia a semana
  cases: number | null;  // casos notificados (revisados retroativamente toda semana)
  casesEst: number | null;      // estimativa por nowcasting (modelo do InfoDengue)
  probable: number | null;      // casos prováveis = notificados − descartados
  incidence: number | null;     // incidência estimada por 100 mil hab.
  population: number | null;    // população usada pelo InfoDengue (IBGE)
  municipality?: string;
}

interface Raw {
  data_iniSE: number; SE: number; casos: number | null; casos_est: number | null; casprov?: number | null;
  p_inc100k: number | null; pop?: string | number | null; municipio_nome?: string;
}

const num = (v: unknown) => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export function parseInfoDengue(raw: Raw[]): ArboWeek[] {
  return raw
    .map((r) => ({
      se: r.SE,
      weekStart: new Date(r.data_iniSE).toISOString().slice(0, 10),
      cases: num(r.casos), casesEst: num(r.casos_est), probable: num(r.casprov),
      incidence: num(r.p_inc100k), population: num(r.pop), municipality: r.municipio_nome
    }))
    .sort((a, b) => a.se - b.se);
}

export function infodengueUrl(geocode: string, disease: Disease, yStart: number, yEnd: number) {
  const q = new URLSearchParams({ geocode, disease, format: "json", ew_start: "1", ew_end: "53", ey_start: String(yStart), ey_end: String(yEnd) });
  return `${INFODENGUE_API}?${q}`;
}

export async function getArboWeeks(geocode: string, disease: Disease, yStart: number, yEnd: number) {
  const url = infodengueUrl(geocode, disease, yStart, yEnd);
  const raw = await fetchJson<Raw[]>(url, { timeoutMs: 40000 });
  return { weeks: parseInfoDengue(Array.isArray(raw) ? raw : []), url };
}
