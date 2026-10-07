/**
 * Núcleo do modelo de rastreabilidade científica da ASTRAE.
 * Todo dado exibido na plataforma carrega uma `Provenance`.
 */

/** Natureza do dado — nunca misturar observação com previsão. */
export type DataKind =
  | "OBSERVED"   // medição direta de instrumento
  | "FORECAST"   // previsão operacional
  | "MODEL"      // saída de modelo / reanálise (ex.: MERRA-2)
  | "ESTIMATE"   // estimativa derivada (ex.: precipitação por satélite)
  | "SIMULATION" // simulação / cenário
  | "INDEX"      // índice derivado oficial (ex.: ONI)
  | "CATALOG"    // metadados / referência bibliográfica
  | "IMAGERY"    // imagem
  | "DEMO";      // dado de exemplo — NUNCA dado científico real

export interface Provenance {
  source: string;          // ex.: "NASA"
  institution: string;     // ex.: "NASA Langley Research Center"
  dataset: string;         // ex.: "POWER Daily (MERRA-2 / CERES)"
  kind: DataKind;
  originalUrl: string;     // link para a fonte oficial
  apiEndpoint?: string;    // endpoint consultado pelo backend
  accessedAt: string;      // ISO — data de acesso
  unit?: string;
  location?: string;
  period?: string;
  methodology?: string;
  license?: string;
  notes?: string;
}

export type ResultStatus = "ok" | "empty" | "error";

export interface ApiEnvelope<T> {
  status: ResultStatus;
  data: T | null;
  provenance: Provenance | null;
  /** Quando os dados vieram de cache (inclusive cache "vencido" após falha). */
  cache?: { hit: boolean; stale: boolean; storedAt: string };
  error?: string;
}

export interface SeriesPoint {
  t: string;               // ISO date ou rótulo (ex.: "Sol 4995")
  v: number | null;
}

export interface Series {
  id: string;
  label: string;
  unit: string;
  kind: DataKind;
  points: SeriesPoint[];
}

export type ResultType =
  | "dataset" | "article" | "image" | "map" | "timeseries" | "document" | "video";

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  source: string;          // NASA, NOAA, INPE…
  institution: string;
  date?: string;
  type: ResultType;
  kind: DataKind;
  topics: string[];        // mars, earth, climate, atmosphere, ocean…
  originalUrl: string;
  openUrl?: string;        // rota interna da ASTRAE, quando existe
  thumbnail?: string;
  datasetName?: string;
}
