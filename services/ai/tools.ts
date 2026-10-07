import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { cached } from "@/lib/cache";
import { getOfficialStatus, getOni, getWeekly, ONI_URL, WEEKLY_URL, ENSO_DISC_URL } from "@/services/enso/oni";
import { getMslWeather, MSL_WEATHER_URL } from "@/services/mars/weather";
import { getRoverPosition, ROVERS, type RoverId } from "@/services/mars/rovers";
import { getCapitalsNow, getForecast7, searchCities, CPTEC_DOCS } from "@/services/inpe/cptec";
import { getPowerClimatology, getPowerDaily, isPowerParam, type PowerParam } from "@/services/nasa/power";
import { searchCollections } from "@/services/nasa/cmr";
import { searchNtrs } from "@/services/nasa/ntrs";
import type { DataKind } from "@/types/science";

/**
 * Ferramentas do ASTRAE AI. Cada uma chama os MESMOS serviços verificados das rotas /api/*
 * e registra a fonte consultada com um ID (S1, S2…) que o modelo deve citar.
 */

export interface ConsultedSource {
  id: string;
  title: string;
  institution: string;
  dataset: string;
  kind: DataKind;
  url: string;
  accessedAt: string;
  detail?: string;
}

export class SourceRegistry {
  list: ConsultedSource[] = [];
  add(s: Omit<ConsultedSource, "id" | "accessedAt">) {
    const existing = this.list.find((x) => x.url === s.url && x.detail === s.detail);
    if (existing) return existing.id;
    const id = `S${this.list.length + 1}`;
    this.list.push({ ...s, id, accessedAt: new Date().toISOString() });
    return id;
  }
}

const round = (v: number | null | undefined, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

function monthlyMeans(points: { t: string; v: number | null }[]) {
  const m = new Map<string, number[]>();
  for (const p of points) if (p.v != null) m.set(p.t.slice(0, 7), [...(m.get(p.t.slice(0, 7)) || []), p.v]);
  return [...m.entries()].map(([month, vs]) => ({ month, mean: round(vs.reduce((a, b) => a + b, 0) / vs.length), sum: round(vs.reduce((a, b) => a + b, 0), 1), days: vs.length }));
}

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_enso_status",
    description: "Returns the official NOAA Climate Prediction Center ENSO Alert System status and synopsis (from the monthly ENSO diagnostic discussion), plus the latest Oceanic Niño Index (ONI) values. Use for any question about the current state of El Niño / La Niña. The official status is a FORECAST-type assessment; ONI values are an observed-data INDEX.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_oni_series",
    description: "Returns the NOAA CPC Oceanic Niño Index (3-month running mean SST anomaly in the Niño 3.4 region, ERSST.v5) between two years, with each season's phase classification and the El Niño/La Niña episodes computed with the official CPC criterion (≥5 consecutive overlapping seasons beyond ±0.5 °C). Data start in 1950. Use it for ENSO history, comparisons between events and identifying El Niño/La Niña years.",
    input_schema: {
      type: "object",
      properties: {
        from_year: { type: "integer", minimum: 1950, description: "First year (inclusive)." },
        to_year: { type: "integer", description: "Last year (inclusive). Defaults to the latest available." }
      },
      required: ["from_year"]
    }
  },
  {
    name: "get_nino_weekly",
    description: "Returns NOAA CPC weekly OISST v2.1 sea surface temperature anomalies (°C, base 1991–2020) for the Niño 1+2, 3, 3.4 and 4 regions — the most recent observed Pacific SST anomalies. Use for 'current Pacific temperature' questions.",
    input_schema: { type: "object", properties: { weeks: { type: "integer", minimum: 1, maximum: 260, description: "How many most recent weeks to return (default 12)." } }, required: [] }
  },
  {
    name: "get_mars_weather",
    description: "Returns daily weather measured by the REMS station on NASA's Curiosity rover in Gale Crater, Mars: min/max air and ground temperature (°C), pressure (Pa), atmospheric opacity, UV and Martian season, per sol. Observed data. The feed does not currently report wind or dust. Optionally summarizes the whole record.",
    input_schema: { type: "object", properties: { last_sols: { type: "integer", minimum: 1, maximum: 5000, description: "Number of most recent sols to return in detail (default 14)." } }, required: [] }
  },
  {
    name: "get_rover_status",
    description: "Returns mission metadata (landing date, site, status, instruments) for a Mars rover, plus the current official position (sol, latitude, longitude, distance driven) from NASA/JPL MMGIS waypoints for active rovers.",
    input_schema: { type: "object", properties: { rover: { type: "string", enum: ["curiosity", "perseverance", "opportunity", "spirit"] } }, required: ["rover"] }
  },
  {
    name: "get_brazil_capitals_now",
    description: "Returns current observed surface conditions (METAR) at Brazilian state-capital airports, redistributed by CPTEC/INPE: temperature °C, humidity %, pressure hPa, wind km/h and weather description.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_cptec_forecast",
    description: "Returns the official CPTEC/INPE 7-day weather forecast (max/min °C, condition, UV index) for a Brazilian municipality. Forecast data, not observations.",
    input_schema: { type: "object", properties: { city: { type: "string", description: "Municipality name, e.g. 'Campinas'." }, uf: { type: "string", description: "Optional two-letter state code to disambiguate, e.g. 'SP'." } }, required: ["city"] }
  },
  {
    name: "get_power_timeseries",
    description: "Returns NASA POWER daily data (MERRA-2 reanalysis — MODEL data, ~0.5° grid, not station observations) for one coordinate, aggregated by month, together with the POWER long-term monthly climatology and monthly anomalies. Parameters: T2M (°C), T2M_MAX, T2M_MIN, PRECTOTCORR (mm/day), PS (kPa), RH2M (%), WS10M (m/s), ALLSKY_SFC_SW_DWN. Period up to 5 years, from 1981. Use it to quantify temperature or precipitation in a Brazilian region during specific periods (e.g. El Niño years).",
    input_schema: {
      type: "object",
      properties: {
        latitude: { type: "number", minimum: -90, maximum: 90 },
        longitude: { type: "number", minimum: -180, maximum: 180 },
        place_label: { type: "string", description: "Human-readable name of the place, e.g. 'Porto Alegre'." },
        start: { type: "string", description: "YYYY-MM-DD" },
        end: { type: "string", description: "YYYY-MM-DD" },
        parameters: { type: "array", items: { type: "string" }, description: "POWER parameter codes." }
      },
      required: ["latitude", "longitude", "start", "end", "parameters"]
    }
  },
  {
    name: "search_nasa_datasets",
    description: "Searches the NASA Earthdata Common Metadata Repository (CMR) for official dataset collections by keyword (English). Returns titles, short names, providers, temporal coverage and summaries. Use when the user asks which datasets exist for a variable or region.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
  },
  {
    name: "search_nasa_reports",
    description: "Searches the NASA Technical Reports Server (NTRS) for scientific papers, technical reports and presentations (English keywords). Returns titles, authors, dates, abstracts and links. Use it to support explanations of physical mechanisms with citable literature; never cite a paper that was not returned here.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
  }
];

type Input = Record<string, unknown>;

export async function runTool(name: string, input: Input, reg: SourceRegistry): Promise<unknown> {
  switch (name) {
    case "get_enso_status": {
      const [st, oni] = await Promise.allSettled([cached("enso:status", 6 * 3600e3, getOfficialStatus), cached("enso:oni", 6 * 3600e3, getOni)]);
      const out: Record<string, unknown> = {};
      if (st.status === "fulfilled") {
        out.official = { source_id: reg.add({ title: "ENSO Diagnostic Discussion", institution: "NOAA Climate Prediction Center", dataset: "ENSO Alert System", kind: "FORECAST", url: ENSO_DISC_URL }), ...st.value.value };
      } else out.official_error = "CPC discussion temporarily unavailable";
      if (oni.status === "fulfilled") {
        out.latest_oni = { source_id: reg.add({ title: "Oceanic Niño Index", institution: "NOAA Climate Prediction Center", dataset: "ONI (ERSST.v5)", kind: "INDEX", url: ONI_URL }), unit: "°C", values: oni.value.value.slice(-8).map((r) => ({ season: `${r.season} ${r.year}`, anomaly: r.anomaly, condition: r.threshold, episode: r.episode })) };
      } else out.oni_error = "ONI temporarily unavailable";
      return out;
    }
    case "get_oni_series": {
      const rows = (await cached("enso:oni", 6 * 3600e3, getOni)).value;
      const from = Number(input.from_year) || 1950, to = Number(input.to_year) || 9999;
      const sel = rows.filter((r) => r.year >= from && r.year <= to);
      const episodes: { phase: string; start: string; end: string; peak: number; strength?: string }[] = [];
      for (let i = 0; i < sel.length;) {
        if (sel[i].episode === "Neutral") { i++; continue; }
        const ph = sel[i].episode; let j = i; let peak = 0; let s: string | undefined;
        while (j < sel.length && sel[j].episode === ph) { if (Math.abs(sel[j].anomaly) > Math.abs(peak)) { peak = sel[j].anomaly; s = sel[j].strength; } j++; }
        episodes.push({ phase: ph, start: `${sel[i].season} ${sel[i].year}`, end: `${sel[j - 1].season} ${sel[j - 1].year}`, peak, strength: s });
        i = j;
      }
      return {
        source_id: reg.add({ title: "Oceanic Niño Index", institution: "NOAA Climate Prediction Center", dataset: "ONI (ERSST.v5)", kind: "INDEX", url: ONI_URL }),
        unit: "°C", note: "Episode strength labels use conventional 0.5 °C bands, not an official CPC classification.",
        episodes,
        seasons: sel.length <= 180 ? sel.map((r) => [`${r.season} ${r.year}`, r.anomaly]) : "omitted (period too long) — see episodes"
      };
    }
    case "get_nino_weekly": {
      const rows = (await cached("enso:weekly", 6 * 3600e3, getWeekly)).value;
      const n = Math.min(260, Math.max(1, Number(input.weeks) || 12));
      return { source_id: reg.add({ title: "Weekly Niño-region SST anomalies", institution: "NOAA Climate Prediction Center", dataset: "OISST v2.1 weekly (base 1991–2020)", kind: "OBSERVED", url: WEEKLY_URL }), unit: "°C anomaly", weeks: rows.slice(-n) };
    }
    case "get_mars_weather": {
      const { sols } = (await cached("mars:msl:weather", 3 * 3600e3, getMslWeather)).value;
      const n = Math.min(5000, Math.max(1, Number(input.last_sols) || 14));
      const valid = (k: "minTemp" | "maxTemp" | "pressure") => sols.map((s) => s[k]).filter((v): v is number => v != null);
      const stat = (a: number[]) => (a.length ? { min: Math.min(...a), max: Math.max(...a), mean: round(a.reduce((x, y) => x + y, 0) / a.length, 1) } : null);
      return {
        source_id: reg.add({ title: "Curiosity REMS daily weather", institution: "NASA/JPL · Centro de Astrobiología (CAB)", dataset: "MSL REMS weather feed", kind: "OBSERVED", url: MSL_WEATHER_URL }),
        location: "Gale Crater, Mars", units: { temperature: "°C", pressure: "Pa" },
        caveat: "Outreach feed; values affected by rover position and shading. Full science data in the PDS. Wind and dust are not reported.",
        record: { first_sol: sols[0]?.sol, last_sol: sols.at(-1)?.sol, first_date: sols[0]?.terrestrialDate, last_date: sols.at(-1)?.terrestrialDate, sols_with_data: sols.length, air_min: stat(valid("minTemp")), air_max: stat(valid("maxTemp")), pressure: stat(valid("pressure")) },
        recent: sols.slice(-n).map((s) => ({ sol: s.sol, date: s.terrestrialDate, season: s.season, ls: s.ls, air_min: s.minTemp, air_max: s.maxTemp, ground_min: s.minGroundTemp, ground_max: s.maxGroundTemp, pressure: s.pressure, opacity: s.opacity, uv: s.uv }))
      };
    }
    case "get_rover_status": {
      const rover = String(input.rover) as RoverId;
      if (!(rover in ROVERS)) throw new Error("unknown rover");
      const meta = ROVERS[rover];
      const pos = await cached(`rover-pos:${rover}`, 2 * 3600e3, () => getRoverPosition(rover)).then((c) => c.value).catch(() => null);
      return {
        mission_source_id: reg.add({ title: `${meta.name} mission page`, institution: "NASA/JPL-Caltech", dataset: meta.mission, kind: "CATALOG", url: meta.url }),
        meta,
        position: pos ? { source_id: reg.add({ title: `${meta.name} current waypoint`, institution: "NASA/JPL MMGIS", dataset: "Rover waypoints", kind: "OBSERVED", url: pos.source }), sol: pos.sol, latitude: pos.lat, longitude_east: pos.lon, elevation_m: pos.elevation, distance_km: pos.distanceKm } : null
      };
    }
    case "get_brazil_capitals_now": {
      const { rows, url } = (await cached("cptec:capitals", 30 * 60e3, getCapitalsNow)).value;
      return { source_id: reg.add({ title: "Condições atuais nas capitais", institution: "CPTEC/INPE", dataset: "METAR capitais", kind: "OBSERVED", url: CPTEC_DOCS, detail: url }), units: { temperature: "°C", humidity: "%", pressure: "hPa", wind: "km/h" }, stations: rows };
    }
    case "get_cptec_forecast": {
      const city = String(input.city || "").trim();
      if (city.length < 2) throw new Error("city required");
      const list = (await cached(`cptec:cities:${city.toLowerCase()}`, 7 * 86400e3, () => searchCities(city))).value;
      const uf = String(input.uf || "").toUpperCase();
      const match = list.find((c) => !uf || c.uf === uf);
      if (!match) return { error: "CPTEC found no municipality with that name", candidates: list.slice(0, 10) };
      const fc = (await cached(`cptec:forecast:${match.id}`, 3 * 3600e3, () => getForecast7(match.id))).value;
      return { source_id: reg.add({ title: `Previsão 7 dias — ${fc.city}/${fc.uf}`, institution: "CPTEC/INPE", dataset: "Previsão municipal", kind: "FORECAST", url: CPTEC_DOCS, detail: fc.url }), city: fc.city, uf: fc.uf, issued: fc.issued, unit: "°C", days: fc.days };
    }
    case "get_power_timeseries": {
      const lat = Number(input.latitude), lon = Number(input.longitude);
      const start = String(input.start), end = String(input.end);
      const params = (Array.isArray(input.parameters) ? input.parameters : []).map(String).filter(isPowerParam) as PowerParam[];
      if (!params.length) throw new Error("no valid POWER parameters");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new Error("dates must be YYYY-MM-DD");
      const days = (Date.parse(end) - Date.parse(start)) / 86400e3;
      if (days < 0 || days > 366 * 5 || start < "1981-01-01") throw new Error("period must be within 1981–present and at most 5 years");
      const key = `ai:power:${lat.toFixed(2)}:${lon.toFixed(2)}:${start}:${end}:${params.join(",")}`;
      const { daily, clim } = (await cached(key, 12 * 3600e3, async () => ({ daily: await getPowerDaily(lat, lon, params, start, end), clim: await getPowerClimatology(lat, lon, params) }))).value;
      const label = String(input.place_label || `${lat.toFixed(2)}, ${lon.toFixed(2)}`);
      return {
        source_id: reg.add({ title: `NASA POWER — ${label}`, institution: "NASA Langley Research Center", dataset: "POWER Daily + Climatology (MERRA-2)", kind: "MODEL", url: "https://power.larc.nasa.gov/", detail: daily.url }),
        location: { label, latitude: lat, longitude: lon }, data_type: "MODEL (reanalysis), not station observations", climatology_period: clim.period,
        variables: daily.series.map((s, i) => {
          const c = clim.climatology[params[i]];
          const months = monthlyMeans(s.points);
          return {
            code: params[i], name: s.label, unit: s.unit,
            monthly: months.map((m) => {
              const base = c.monthly[Number(m.month.slice(5, 7)) - 1];
              return { ...m, climatology_mean: base, anomaly_of_mean: base == null || m.mean == null ? null : round(m.mean - base) };
            })
          };
        })
      };
    }
    case "search_nasa_datasets": {
      const q = String(input.query || "").trim();
      const r = (await cached(`search:cmr:${q}`, 6 * 3600e3, () => searchCollections(q, 8))).value;
      return {
        results: r.items.map((c) => ({
          source_id: reg.add({ title: c.title, institution: c.organizations[0] || c.dataCenter, dataset: `${c.shortName}${c.version ? ` v${c.version}` : ""}`, kind: "CATALOG", url: c.earthdataSearchUrl }),
          title: c.title, short_name: c.shortName, provider: c.dataCenter, organizations: c.organizations, time_start: c.timeStart, time_end: c.timeEnd ?? "ongoing", summary: c.summary.slice(0, 400)
        }))
      };
    }
    case "search_nasa_reports": {
      const q = String(input.query || "").trim();
      const r = (await cached(`search:ntrs:${q}`, 6 * 3600e3, () => searchNtrs(q, 8))).value;
      return {
        total: r.total,
        results: r.items.map((a) => ({
          source_id: reg.add({ title: a.title, institution: a.center || "NASA STI Program", dataset: a.stiType || "NTRS citation", kind: "CATALOG", url: a.url }),
          title: a.title, authors: a.authors, published: a.published?.slice(0, 10), type: a.stiType, abstract: a.abstract.slice(0, 600)
        }))
      };
    }
    default:
      throw new Error(`unknown tool ${name}`);
  }
}
