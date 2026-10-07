import "server-only";
import { fetchJson } from "@/lib/http";
import { searchNasaMedia, largerImage } from "@/services/nasa/images";

export type RoverId = "curiosity" | "perseverance" | "opportunity" | "spirit";

/** Metadados históricos de referência das missões (fonte: páginas oficiais da NASA/JPL indicadas em `url`). */
export const ROVERS: Record<RoverId, {
  name: string; mission: string; landing: string; status: "active" | "complete"; endDate?: string;
  site: string; landingLat: number; landingLon: number; url: string; instruments: string[];
}> = {
  curiosity: {
    name: "Curiosity", mission: "Mars Science Laboratory (MSL)", landing: "2012-08-06", status: "active",
    site: "Cratera Gale", landingLat: -4.5895, landingLon: 137.4417,
    url: "https://science.nasa.gov/mission/msl-curiosity/",
    instruments: ["Mastcam", "ChemCam", "MAHLI", "APXS", "CheMin", "SAM", "REMS", "RAD", "DAN", "MARDI", "Navcam", "Hazcam"]
  },
  perseverance: {
    name: "Perseverance", mission: "Mars 2020", landing: "2021-02-18", status: "active",
    site: "Cratera Jezero", landingLat: 18.4447, landingLon: 77.4508,
    url: "https://science.nasa.gov/mission/mars-2020-perseverance/",
    instruments: ["Mastcam-Z", "SuperCam", "PIXL", "SHERLOC", "WATSON", "MOXIE", "MEDA", "RIMFAX", "Navcam", "Hazcam"]
  },
  opportunity: {
    name: "Opportunity", mission: "Mars Exploration Rover (MER-B)", landing: "2004-01-25", status: "complete",
    endDate: "2018-06-10 (último contato) · missão encerrada em 2019-02-13",
    site: "Meridiani Planum", landingLat: -1.9462, landingLon: 354.4734 - 360,
    url: "https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/",
    instruments: ["Pancam", "Mini-TES", "Mössbauer", "APXS", "Microscopic Imager", "RAT"]
  },
  spirit: {
    name: "Spirit", mission: "Mars Exploration Rover (MER-A)", landing: "2004-01-04", status: "complete",
    endDate: "2010-03-22 (último contato) · missão encerrada em 2011-05-25",
    site: "Cratera Gusev", landingLat: -14.5684, landingLon: 175.4726,
    url: "https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/",
    instruments: ["Pancam", "Mini-TES", "Mössbauer", "APXS", "Microscopic Imager", "RAT"]
  }
};

export interface RoverImage {
  id: string; sol?: number; camera: string; takenAt?: string; title: string;
  thumb: string; full: string; credit: string; link: string;
}

export interface RoverPosition { sol: number; lat: number; lon: number; elevation?: number; distanceKm?: number; source: string }

/** Curiosity raw images — https://mars.nasa.gov/msl/multimedia/raw-images/ (API JSON do próprio site). */
async function curiosityImages(sol?: number) {
  const q = new URLSearchParams({ order: "sol desc", per_page: "36", page: "0", condition_1: "msl:mission" });
  if (sol !== undefined) q.set("condition_2", `${sol}:sol:in`);
  const url = `https://mars.nasa.gov/api/v1/raw_image_items/?${q}`;
  const raw = await fetchJson<{ items: { id: number; imageid: string; sol: number; instrument: string; https_url: string; date_taken: string; title: string; image_credit: string; link: string }[] }>(url);
  const images: RoverImage[] = raw.items.map((i) => ({
    id: i.imageid, sol: i.sol, camera: i.instrument, takenAt: i.date_taken, title: i.title,
    thumb: i.https_url, full: i.https_url, credit: i.image_credit || "NASA/JPL-Caltech",
    link: `https://mars.nasa.gov${i.link}`
  }));
  return { images, url };
}

/** Perseverance raw images feed — https://mars.nasa.gov/mars2020/multimedia/raw-images/ */
async function perseveranceImages(sol?: number) {
  const q = new URLSearchParams({ feed: "raw_images", category: "mars2020", feedtype: "json", num: "36", page: "0", order: "sol desc" });
  if (sol !== undefined) q.set("sol", String(sol));
  const url = `https://mars.nasa.gov/rss/api/?${q}`;
  const raw = await fetchJson<{ images?: { imageid: string; sol: number; camera?: { instrument?: string }; image_files?: { small?: string; medium?: string; large?: string; full_res?: string }; date_taken_utc?: string; title?: string; credit?: string; link?: string }[] }>(url);
  if (!Array.isArray(raw.images)) throw new Error("Perseverance raw-image feed returned an unexpected format");
  const images: RoverImage[] = raw.images.map((i) => ({
    id: i.imageid, sol: i.sol, camera: i.camera?.instrument || "—", takenAt: i.date_taken_utc,
    title: i.title || i.imageid,
    thumb: i.image_files?.medium || i.image_files?.small || i.image_files?.full_res || "",
    full: i.image_files?.large || i.image_files?.full_res || "",
    credit: i.credit || "NASA/JPL-Caltech", link: i.link || "https://mars.nasa.gov/mars2020/multimedia/raw-images/"
  })).filter((i) => i.thumb);
  return { images, url };
}

/** Rovers encerrados: a Mars Rover Photos API foi arquivada pela NASA; usamos a NASA Image Library. */
async function archivedRoverImages(rover: "opportunity" | "spirit") {
  const r = await searchNasaMedia(`${rover} rover`, { mediaType: "image", pageSize: 36 });
  const images: RoverImage[] = r.items.filter((i) => i.thumb).map((i) => ({
    id: i.nasaId, camera: i.center || "NASA Image Library", takenAt: i.dateCreated, title: i.title,
    thumb: i.thumb!, full: largerImage(i.thumb)!, credit: i.photographer || "NASA", link: i.detailsUrl
  }));
  return { images, url: r.url };
}

export async function getRoverImages(rover: RoverId, sol?: number) {
  if (rover === "curiosity") return curiosityImages(sol);
  if (rover === "perseverance") return perseveranceImages(sol);
  return archivedRoverImages(rover);
}

/** Localização atual — camadas de waypoints publicadas pelo MMGIS da NASA/JPL. */
const WAYPOINTS: Partial<Record<RoverId, string>> = {
  curiosity: "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints_current.json",
  perseverance: "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints_current.json"
};

export async function getRoverPosition(rover: RoverId): Promise<RoverPosition | null> {
  const url = WAYPOINTS[rover];
  if (!url) return null;
  const raw = await fetchJson<{ features: { properties: { sol: number; lat: number; lon: number; elev_geoid?: number; dist_km?: number } }[] }>(url);
  const f = raw.features?.[raw.features.length - 1]?.properties;
  if (!f) return null;
  return { sol: f.sol, lat: f.lat, lon: f.lon, elevation: f.elev_geoid, distanceKm: f.dist_km, source: url };
}
