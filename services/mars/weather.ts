import "server-only";
import { fetchJson } from "@/lib/http";

/**
 * Curiosity (MSL) — REMS, via feed JSON público do site mars.nasa.gov (dados fornecidos pelo
 * Centro de Astrobiología, CAB/INTA-CSIC). O próprio feed declara finalidade de divulgação;
 * os dados científicos completos estão no PDS. A ASTRAE exibe esse aviso junto aos gráficos.
 */
export const MSL_WEATHER_URL = "https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json";
export const REMS_PDS_URL = "https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/MARS/curiosity/rems.html";

export interface MarsSol {
  sol: number; terrestrialDate: string; ls: number | null; season: string;
  minTemp: number | null; maxTemp: number | null;
  minGroundTemp: number | null; maxGroundTemp: number | null;
  pressure: number | null; pressureTrend: string;
  humidity: number | null; windSpeed: number | null; windDirection: string | null;
  opacity: string; uv: string; sunrise: string; sunset: string;
}

const num = (s: string | undefined) => (s === undefined || s === "--" || s === "" || isNaN(Number(s)) ? null : Number(s));
const str = (s: string | undefined) => (s === undefined || s === "--" ? null : s);

interface RawSol {
  terrestrial_date: string; sol: string; ls: string; season: string; min_temp: string; max_temp: string;
  pressure: string; pressure_string: string; abs_humidity: string; wind_speed: string; wind_direction: string;
  atmo_opacity: string; sunrise: string; sunset: string; local_uv_irradiance_index: string;
  min_gts_temp: string; max_gts_temp: string;
}

export async function getMslWeather() {
  const raw = await fetchJson<{ soles: RawSol[]; descriptions?: { disclaimer_en?: string } }>(MSL_WEATHER_URL, { timeoutMs: 25000 });
  const sols: MarsSol[] = raw.soles.map((s) => ({
    sol: Number(s.sol),
    terrestrialDate: s.terrestrial_date,
    ls: num(s.ls),
    season: s.season,
    minTemp: num(s.min_temp),
    maxTemp: num(s.max_temp),
    minGroundTemp: num(s.min_gts_temp),
    maxGroundTemp: num(s.max_gts_temp),
    pressure: num(s.pressure),
    pressureTrend: s.pressure_string,
    humidity: num(s.abs_humidity),
    windSpeed: num(s.wind_speed),
    windDirection: str(s.wind_direction),
    opacity: s.atmo_opacity,
    uv: s.local_uv_irradiance_index,
    sunrise: s.sunrise,
    sunset: s.sunset
  })).sort((a, b) => a.sol - b.sol);
  const disclaimer = (raw.descriptions?.disclaimer_en || "").replace(/\s+/g, " ").trim();
  return { sols, disclaimer };
}
