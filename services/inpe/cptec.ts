import "server-only";
import { XMLParser } from "fast-xml-parser";
import { fetchText } from "@/lib/http";

/**
 * CPTEC/INPE — serviço XML público de previsão e condições atuais.
 * Documentação oficial: http://servicos.cptec.inpe.br/XML/
 * Respostas em ISO-8859-1. Serviço apenas em HTTP → sempre consultado pelo backend.
 */
export const CPTEC_BASE = "http://servicos.cptec.inpe.br/XML";
export const CPTEC_DOCS = "http://servicos.cptec.inpe.br/XML/";

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });
const get = (url: string) => fetchText(url, { encoding: "iso-8859-1", timeoutMs: 20000 });
const arr = <T,>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

/** Legenda oficial das siglas de tempo do CPTEC. */
export const CPTEC_WEATHER: Record<string, string> = {
  ec: "Encoberto com chuvas isoladas", ci: "Chuvas isoladas", c: "Chuva", in: "Instável",
  pp: "Possibilidade de pancadas de chuva", cm: "Chuva pela manhã", cn: "Chuva à noite",
  pt: "Pancadas de chuva à tarde", pm: "Pancadas de chuva pela manhã", np: "Nublado e pancadas de chuva",
  pc: "Pancadas de chuva", pn: "Parcialmente nublado", cv: "Chuvisco", ch: "Chuvoso", t: "Tempestade",
  ps: "Predomínio de sol", e: "Encoberto", n: "Nublado", cl: "Céu claro", nv: "Nevoeiro", g: "Geada",
  ne: "Neve", nd: "Não definido", pnt: "Pancadas de chuva à noite", psc: "Possibilidade de chuva",
  pcm: "Possibilidade de chuva pela manhã", pct: "Possibilidade de chuva à tarde",
  pcn: "Possibilidade de chuva à noite", npt: "Nublado com pancadas à tarde",
  npn: "Nublado com pancadas à noite", ncn: "Nublado com possibilidade de chuva à noite",
  nct: "Nublado com possibilidade de chuva à tarde", ncm: "Nublado com possibilidade de chuva pela manhã",
  npm: "Nublado com pancadas pela manhã", npp: "Nublado com possibilidade de chuva",
  vn: "Variação de nebulosidade", ct: "Chuva à tarde", ppn: "Possibilidade de pancadas de chuva à noite",
  ppt: "Possibilidade de pancadas de chuva à tarde", ppm: "Possibilidade de pancadas de chuva pela manhã"
};

export interface CptecCity { id: number; name: string; uf: string }

export async function searchCities(name: string): Promise<CptecCity[]> {
  const ascii = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const xml = await get(`${CPTEC_BASE}/listaCidades?city=${encodeURIComponent(ascii)}`);
  const doc = parser.parse(xml) as { cidades?: { cidade?: unknown } };
  return arr(doc.cidades?.cidade as { id: string; nome: string; uf: string }[] | undefined)
    .map((c) => ({ id: Number(c.id), name: String(c.nome), uf: String(c.uf) }));
}

export interface CptecForecastDay { date: string; code: string; condition: string; max: number | null; min: number | null; uv: number | null }

export async function getForecast7(cityId: number) {
  const url = `${CPTEC_BASE}/cidade/7dias/${cityId}/previsao.xml`;
  const doc = parser.parse(await get(url)) as { cidade?: { nome: string; uf: string; atualizacao: string; previsao?: unknown } };
  if (!doc.cidade) throw new Error("CPTEC returned no forecast for this city");
  const n = (s: unknown) => (s === undefined || s === "" || isNaN(Number(s)) ? null : Number(s));
  const days: CptecForecastDay[] = arr(doc.cidade.previsao as { dia: string; tempo: string; maxima: string; minima: string; iuv: string }[])
    .map((p) => ({ date: p.dia, code: p.tempo, condition: CPTEC_WEATHER[p.tempo] || p.tempo, max: n(p.maxima), min: n(p.minima), uv: n(p.iuv) }));
  return { city: doc.cidade.nome, uf: doc.cidade.uf, issued: doc.cidade.atualizacao, days, url };
}

/** Nomes das capitais para os códigos ICAO usados no XML de condições atuais. */
export const CAPITAL_STATIONS: Record<string, string> = {
  SBAR: "Aracaju", SBBE: "Belém", SBCF: "Belo Horizonte (Confins)", SBBH: "Belo Horizonte (Pampulha)", SBBV: "Boa Vista",
  SBBR: "Brasília", SBCG: "Campo Grande", SBCY: "Cuiabá", SBCT: "Curitiba", SBFL: "Florianópolis", SBFZ: "Fortaleza",
  SBGO: "Goiânia", SBJP: "João Pessoa", SBMQ: "Macapá", SBMO: "Maceió", SBEG: "Manaus", SBNT: "Natal", SBSG: "Natal",
  SBPJ: "Palmas", SBPA: "Porto Alegre", SBPV: "Porto Velho", SBRF: "Recife", SBRB: "Rio Branco",
  SBRJ: "Rio de Janeiro (Santos Dumont)", SBGL: "Rio de Janeiro (Galeão)", SBSV: "Salvador", SBSL: "São Luís",
  SBSP: "São Paulo (Congonhas)", SBGR: "São Paulo (Guarulhos)", SBTE: "Teresina", SBVT: "Vitória"
};

export interface CapitalObs {
  station: string; name: string; updated: string; pressure: number | null; temperature: number | null;
  humidity: number | null; windDir: number | null; windSpeed: number | null; condition: string;
}

/** Condições atuais (METAR) nas capitais — dado OBSERVADO. */
export async function getCapitalsNow() {
  const url = `${CPTEC_BASE}/capitais/condicoesAtuais.xml`;
  const doc = parser.parse(await get(url)) as { capitais?: { metar?: unknown } };
  const n = (s: unknown) => (s === undefined || s === "" || isNaN(Number(s)) ? null : Number(s));
  const rows = arr(doc.capitais?.metar as Record<string, string>[]).map((m) => ({
    station: m.codigo,
    name: CAPITAL_STATIONS[m.codigo] || m.codigo,
    updated: m.atualizacao,
    pressure: n(m.pressao),
    temperature: n(m.temperatura),
    humidity: n(m.umidade),
    windDir: n(m.vento_dir),
    windSpeed: n(m.vento_int),
    condition: m.tempo_desc || CPTEC_WEATHER[m.tempo] || m.tempo || "—"
  }));
  return { rows, url };
}
