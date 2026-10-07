import "server-only";
import { fetchJson } from "@/lib/http";
import { nasaKey } from "./key";

export interface Apod {
  date: string; title: string; explanation: string; url: string;
  hdurl?: string; media_type: "image" | "video" | string; copyright?: string;
}

/** Docs: https://api.nasa.gov (APOD) — https://github.com/nasa/apod-api */
export function apodUrl(date?: string) {
  const q = new URLSearchParams({ api_key: nasaKey() });
  if (date) q.set("date", date);
  return `https://api.nasa.gov/planetary/apod?${q}`;
}

export async function getApod(date?: string): Promise<Apod> {
  return fetchJson<Apod>(apodUrl(date));
}
