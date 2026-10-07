import "server-only";
import { cached } from "@/lib/cache";
import { searchNasaMedia } from "@/services/nasa/images";
import { searchCollections } from "@/services/nasa/cmr";
import { searchNtrs } from "@/services/nasa/ntrs";
import type { SearchResult } from "@/types/science";
import { CATALOG } from "./catalog";

/** Dicionário PT→EN: as APIs da NASA indexam em inglês. */
const PT_EN: Record<string, string> = {
  marte: "mars", terra: "earth", atmosfera: "atmosphere", atmosferico: "atmospheric", atmosférica: "atmospheric",
  temperatura: "temperature", precipitação: "precipitation", precipitacao: "precipitation", chuva: "rainfall",
  pressão: "pressure", pressao: "pressure", vento: "wind", ventos: "wind", nuvens: "clouds", nuvem: "cloud",
  aerossóis: "aerosols", aerossois: "aerosols", aerossol: "aerosol", oceano: "ocean", oceanos: "ocean",
  oceanografia: "oceanography", clima: "climate", climática: "climate", climatica: "climate", climatologia: "climatology",
  meteorologia: "meteorology", umidade: "humidity", radiação: "radiation", radiacao: "radiation",
  superfície: "surface", superficie: "surface", mar: "sea", "do": "", "da": "", "de": "", "e": "", "no": "", "na": "",
  pacífico: "pacific", pacifico: "pacific", atlântico: "atlantic", atlantico: "atlantic", poeira: "dust",
  cratera: "crater", crateras: "craters", satélite: "satellite", satelite: "satellite", imagens: "images",
  mudanças: "change", mudancas: "change", climáticas: "climate", "niño": "el nino", nino: "nino", "niña": "la nina", nina: "nina",
  brasil: "brazil", amazônia: "amazon", amazonia: "amazon", gelo: "ice", solar: "solar", planeta: "planet",
  planetas: "planets", júpiter: "jupiter", jupiter: "jupiter", vênus: "venus", venus: "venus", lua: "moon", sol: "sun"
};

export function translateQuery(q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const out = words.map((w) => (w in PT_EN ? PT_EN[w] : w)).filter(Boolean);
  return Array.from(new Set(out.join(" ").split(" "))).join(" ").trim() || q;
}

const TOPIC_RULES: [string, RegExp][] = [
  ["mars", /\bmars\b|martian|curiosity|perseverance|gale|jezero/i],
  ["earth", /\bearth\b|land|terrestrial|global/i],
  ["climate", /climate|enso|el ni|la ni|anomal|warming|temperature/i],
  ["atmosphere", /atmospher|aerosol|cloud|wind|pressure|humidity|ozone/i],
  ["ocean", /ocean|sea surface|sst|marine|pacific|atlantic/i],
  ["brazil", /brazil|brasil|amazon|cptec|inpe/i],
  ["planetary", /planet|jupiter|saturn|venus|moon|lunar|asteroid|comet/i]
];
const topicsOf = (s: string) => TOPIC_RULES.filter(([, re]) => re.test(s)).map(([t]) => t);

export interface ProviderStatus { provider: string; ok: boolean; count: number; error?: string; endpoint?: string }

export async function scientificSearch(rawQuery: string) {
  const q = rawQuery.trim();
  const en = translateQuery(q);
  const terms = [...q.toLowerCase().split(/\s+/), ...en.split(/\s+/)];

  // 1) catálogo interno de séries ao vivo da ASTRAE
  const internal: SearchResult[] = CATALOG
    .map((c) => ({ c, score: terms.reduce((s, t) => s + (t.length > 2 && c.keywords.some((k) => k.includes(t) || t.includes(k)) ? 1 : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c.result);

  // 2) provedores externos em paralelo — falha de um não derruba os outros
  const providers = await Promise.allSettled([
    cached(`search:cmr:${en}`, 6 * 3600e3, () => searchCollections(en, 15)),
    cached(`search:ntrs:${en}`, 6 * 3600e3, () => searchNtrs(en, 12)),
    cached(`search:img:${en}`, 6 * 3600e3, () => searchNasaMedia(en, { pageSize: 18 }))
  ]);
  const status: ProviderStatus[] = [];
  const results: SearchResult[] = [...internal];

  const [cmr, ntrs, img] = providers;
  if (cmr.status === "fulfilled") {
    const v = cmr.value.value;
    status.push({ provider: "NASA Earthdata CMR", ok: true, count: v.items.length, endpoint: v.url });
    for (const c of v.items) results.push({
      id: `cmr:${c.id}`, title: c.title, description: c.summary, source: "NASA",
      institution: c.organizations[0] || c.dataCenter, date: c.timeStart?.slice(0, 10),
      type: "dataset", kind: "CATALOG", topics: topicsOf(`${c.title} ${c.summary}`),
      originalUrl: c.earthdataSearchUrl, thumbnail: c.thumbnail,
      datasetName: `${c.shortName}${c.version ? ` v${c.version}` : ""}`
    });
  } else status.push({ provider: "NASA Earthdata CMR", ok: false, count: 0, error: String(cmr.reason?.message || cmr.reason) });

  if (ntrs.status === "fulfilled") {
    const v = ntrs.value.value;
    status.push({ provider: "NASA Technical Reports Server", ok: true, count: v.items.length, endpoint: v.url });
    for (const a of v.items) results.push({
      id: `ntrs:${a.id}`, title: a.title, description: a.abstract || a.subjects.join(", "), source: "NASA",
      institution: a.center || "NASA STI Program", date: a.published?.slice(0, 10),
      type: a.pdfUrl ? "document" : "article", kind: "CATALOG", topics: topicsOf(`${a.title} ${a.abstract}`),
      originalUrl: a.url, datasetName: a.stiType
    });
  } else status.push({ provider: "NASA Technical Reports Server", ok: false, count: 0, error: String(ntrs.reason?.message || ntrs.reason) });

  if (img.status === "fulfilled") {
    const v = img.value.value;
    status.push({ provider: "NASA Image and Video Library", ok: true, count: v.items.length, endpoint: v.url });
    for (const m of v.items) results.push({
      id: `img:${m.nasaId}`, title: m.title, description: m.description, source: "NASA",
      institution: m.center ? `NASA ${m.center}` : "NASA", date: m.dateCreated?.slice(0, 10),
      type: m.mediaType === "video" ? "video" : "image", kind: "IMAGERY",
      topics: topicsOf(`${m.title} ${m.keywords.join(" ")} ${m.description}`),
      originalUrl: m.detailsUrl, thumbnail: m.thumb, datasetName: "NASA Image and Video Library"
    });
  } else status.push({ provider: "NASA Image and Video Library", ok: false, count: 0, error: String(img.reason?.message || img.reason) });

  status.unshift({ provider: "ASTRAE — séries ao vivo", ok: true, count: internal.length });
  return { query: q, translated: en, results, providers: status };
}
