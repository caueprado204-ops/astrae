import "server-only";
import { fetchText } from "@/lib/http";

/**
 * NOAA Climate Prediction Center — Oceanic Niño Index (ONI).
 * Arquivo oficial: https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt
 * Média móvel de 3 meses da anomalia de TSM (ERSST.v5) na região Niño 3.4 (5°N–5°S, 170°W–120°W).
 * Critério operacional do CPC: episódio quando o limiar ±0,5 °C é atingido em pelo menos
 * 5 trimestres sobrepostos consecutivos.
 */
export const ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt";
export const WEEKLY_URL = "https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for";
export const ENSO_DISC_URL = "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml";

const SEASONS = ["DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"];

export type EnsoPhase = "El Niño" | "La Niña" | "Neutral";

export interface OniPoint {
  season: string; year: number; centerMonth: string; // YYYY-MM do mês central
  total: number; anomaly: number;
  threshold: EnsoPhase;   // condição pontual (|ONI| ≥ 0,5)
  episode: EnsoPhase;     // após critério de 5 trimestres consecutivos
  strength?: "Fraco" | "Moderado" | "Forte" | "Muito forte";
}

export function parseOni(txt: string): OniPoint[] {
  const rows: OniPoint[] = [];
  for (const line of txt.split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Z]{3})\s+(\d{4})\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)$/);
    if (!m) continue;
    const [, season, y, total, anom] = m;
    const idx = SEASONS.indexOf(season);
    if (idx < 0) continue;
    const a = Number(anom);
    rows.push({
      season, year: Number(y),
      centerMonth: `${y}-${String(idx + 1).padStart(2, "0")}`,
      total: Number(total), anomaly: a,
      threshold: a >= 0.5 ? "El Niño" : a <= -0.5 ? "La Niña" : "Neutral",
      episode: "Neutral"
    });
  }
  // critério de episódio: ≥ 5 trimestres sobrepostos consecutivos
  let i = 0;
  while (i < rows.length) {
    const phase = rows[i].threshold;
    let j = i;
    while (j < rows.length && rows[j].threshold === phase) j++;
    if (phase !== "Neutral" && j - i >= 5) for (let k = i; k < j; k++) rows[k].episode = phase;
    i = j === i ? i + 1 : j;
  }
  for (const r of rows) {
    const x = Math.abs(r.anomaly);
    if (r.episode !== "Neutral") r.strength = x >= 2 ? "Muito forte" : x >= 1.5 ? "Forte" : x >= 1 ? "Moderado" : "Fraco";
  }
  return rows;
}

export async function getOni() {
  const txt = await fetchText(ONI_URL);
  const points = parseOni(txt);
  if (points.length === 0) throw new Error("ONI file could not be parsed");
  return points;
}

export interface WeeklyNino { week: string; nino12: number; nino3: number; nino34: number; nino4: number }

/** Anomalias semanais OISST v2.1 (base 1991–2020) para as regiões Niño. */
export function parseWeekly(txt: string): WeeklyNino[] {
  const out: WeeklyNino[] = [];
  const months: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
  for (const line of txt.split(/\r?\n/)) {
    const m = line.trim().match(/^(\d{2})([A-Z]{3})(\d{4})\s+(.*)$/);
    if (!m || !months[m[2]]) continue;
    const nums = m[4].match(/-?\d+\.\d+/g)?.map(Number);
    if (!nums || nums.length < 8) continue;
    out.push({ week: `${m[3]}-${months[m[2]]}-${m[1]}`, nino12: nums[1], nino3: nums[3], nino34: nums[5], nino4: nums[7] });
  }
  return out;
}

export async function getWeekly() {
  const rows = parseWeekly(await fetchText(WEEKLY_URL));
  if (rows.length === 0) throw new Error("Weekly Niño file could not be parsed");
  return rows;
}

/** Status oficial do sistema de alerta ENSO, extraído da discussão diagnóstica mensal do CPC. */
export async function getOfficialStatus() {
  const html = await fetchText(ENSO_DISC_URL);
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const status = text.match(/ENSO Alert System Status:\s*([^.]+?)(?:\s{2,}|Synopsis|$)/i)?.[1]?.trim();
  const synopsis = text.match(/Synopsis:\s*(.+?\.)\s/i)?.[1]?.trim();
  const issued = text.match(/issued by\s+CLIMATE PREDICTION CENTER.*?(\d{1,2}\s+\w+\s+\d{4})/i)?.[1];
  if (!status) throw new Error("Could not locate ENSO Alert System Status in CPC discussion");
  return { status, synopsis, issued, url: ENSO_DISC_URL };
}
