import "server-only";
import { cached } from "@/lib/cache";
import { areaAndCentroid, featureCode, getMunicipality, immediateRegionMunicipalities, stateMunicipalMesh } from "@/services/ibge";

/** Município + centróide calculado da malha oficial do IBGE + municípios da mesma Região Geográfica Imediata. */
export async function locateMunicipality(id: string) {
  const [mun, mesh] = await Promise.all([
    cached(`ibge:mun:${id}`, 30 * 86400e3, () => getMunicipality(id)),
    cached(`ibge:mesh:${id.slice(0, 2)}`, 30 * 86400e3, () => stateMunicipalMesh(id.slice(0, 2)))
  ]);
  const f = mesh.value.fc.features.find((x) => featureCode(x) === id);
  const geo = f ? areaAndCentroid(f) : null;
  let region: { id: string; name: string; municipalities: { id: string; name: string }[] } | null = null;
  const ri = mun.value.immediateRegion;
  if (ri) {
    try {
      const list = await cached(`ibge:ri:${ri.id}`, 30 * 86400e3, () => immediateRegionMunicipalities(ri.id));
      region = { ...ri, municipalities: list.value.map((m) => ({ id: m.id, name: m.name })) };
    } catch { region = { ...ri, municipalities: [] }; }
  }
  return {
    municipality: mun.value,
    lat: geo && Number.isFinite(geo.lat) ? geo.lat : null,
    lon: geo && Number.isFinite(geo.lon) ? geo.lon : null,
    areaKm2: geo?.areaKm2 ?? null,
    region,
    meshUrl: mesh.value.url
  };
}
