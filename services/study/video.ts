import "server-only";
import { fetchJson, fetchText } from "@/lib/http";
import type { NasaMediaItem } from "@/services/nasa/images";

/**
 * Videoaulas a partir da NASA Image and Video Library (sem chave).
 * Endpoints documentados em https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf:
 *  - GET /search?nasa_id=…      metadados do item
 *  - GET /asset/{nasa_id}       arquivos do item (mp4 em várias resoluções, legendas, metadata.json)
 *  - GET /captions/{nasa_id}    { location } → arquivo de legenda (SRT ou VTT)
 */
const API = "https://images-api.nasa.gov";

export interface Cue { start: number; end: number; text: string }
export interface VideoLesson {
  item: NasaMediaItem;
  files: { label: string; url: string }[];
  captionsUrl?: string;
  cues: Cue[];
  apiEndpoints: string[];
}

/** O acervo devolve links http e com espaços; normaliza para https e codifica. */
export const normalizeAssetUrl = (href: string) => encodeURI(decodeURI(href.replace(/^http:\/\//, "https://")));

const RES_ORDER = ["mobile", "small", "medium", "large", "orig"];
/** Escolhe os arquivos .mp4 do item, do mais leve ao original. */
export function pickVideoFiles(hrefs: string[]) {
  const mp4 = hrefs.filter((h) => /\.mp4$/i.test(h));
  const label = (h: string) => h.match(/~([a-z]+)\.mp4$/i)?.[1]?.toLowerCase() || "mp4";
  return mp4
    .map((h) => ({ label: label(h), url: normalizeAssetUrl(h) }))
    .sort((a, b) => (RES_ORDER.indexOf(a.label) + 99) % 99 - (RES_ORDER.indexOf(b.label) + 99) % 99);
}

const ts = (s: string) => {
  const m = s.trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/);
  if (!m) return NaN;
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000;
};

/** Lê legendas SRT ou WebVTT e devolve as falas com tempo (em segundos). */
export function parseCaptions(raw: string): Cue[] {
  const blocks = raw.replace(/\r/g, "").replace(/^﻿/, "").split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const b of blocks) {
    const lines = b.split("\n").filter(Boolean);
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, z] = lines[i].split("-->");
    const start = ts(a), end = ts(z);
    const text = lines.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (Number.isFinite(start) && Number.isFinite(end) && text) cues.push({ start, end, text });
  }
  return cues;
}

interface SearchRaw { collection: { items: { href: string; data: { nasa_id: string; title: string; description?: string; center?: string; date_created?: string; media_type: string; keywords?: string[]; photographer?: string; secondary_creator?: string }[]; links?: { href: string; rel: string }[] }[] } }

export async function getVideoLesson(nasaId: string): Promise<VideoLesson> {
  const searchUrl = `${API}/search?${new URLSearchParams({ nasa_id: nasaId, media_type: "video" })}`;
  const assetUrl = `${API}/asset/${encodeURIComponent(nasaId)}`;
  const [meta, asset] = await Promise.all([
    fetchJson<SearchRaw>(searchUrl),
    fetchJson<{ collection: { items: { href: string }[] } }>(assetUrl)
  ]);
  const it = meta.collection.items[0];
  if (!it) throw new Error(`Vídeo ${nasaId} não encontrado na NASA Image and Video Library.`);
  const d = it.data[0];
  const item: NasaMediaItem = {
    nasaId: d.nasa_id, title: d.title, description: d.description || "", center: d.center, dateCreated: d.date_created,
    mediaType: d.media_type, keywords: d.keywords || [], thumb: it.links?.find((l) => l.rel === "preview")?.href,
    detailsUrl: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`, assetManifest: it.href,
    photographer: d.photographer || d.secondary_creator
  };

  const hrefs = asset.collection.items.map((i) => i.href);
  const apiEndpoints = [searchUrl, assetUrl];
  let captionsUrl = hrefs.find((h) => /\.(vtt|srt)$/i.test(h));
  if (!captionsUrl) {
    const capEndpoint = `${API}/captions/${encodeURIComponent(nasaId)}`;
    try {
      captionsUrl = (await fetchJson<{ location?: string }>(capEndpoint)).location;
      apiEndpoints.push(capEndpoint);
    } catch { /* vídeo sem legenda publicada */ }
  }
  let cues: Cue[] = [];
  if (captionsUrl) {
    captionsUrl = normalizeAssetUrl(captionsUrl);
    try { cues = parseCaptions(await fetchText(captionsUrl)); } catch { cues = []; }
  }
  return { item, files: pickVideoFiles(hrefs), captionsUrl, cues, apiEndpoints };
}
