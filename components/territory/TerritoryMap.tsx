"use client";
import { useEffect, useRef } from "react";
import maplibregl, { type Map as MLMap, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/** Escala sequencial de um só matiz (azul), 5 classes — passos escolhidos separadamente para o tema claro e o escuro. */
export const RAMP = {
  light: ["#b7d3f6", "#6da7ec", "#3987e5", "#256abf", "#104281"],
  dark: ["#104281", "#256abf", "#3987e5", "#6da7ec", "#b7d3f6"]
};
export const NODATA = { light: "#e4e6ea", dark: "#2a2f3a" };

type Geo = { type: "FeatureCollection"; features: { type: "Feature"; properties: Record<string, unknown>; geometry: unknown }[] };
export interface MapDatum { id: string; name: string; value: number | null; label: string; cls: number | null }

const isDark = () => typeof document !== "undefined" && document.documentElement.dataset.theme !== "light";

export function TerritoryMap({ geojson, data, className = "h-[460px]" }: { geojson: Geo; data: MapDatum[]; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const popup = useRef(new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 }));
  const ready = useRef(false);

  function colored(): Geo {
    const dark = isDark(), ramp = dark ? RAMP.dark : RAMP.light;
    const by = new Map(data.map((d) => [d.id, d]));
    return {
      type: "FeatureCollection",
      features: geojson.features.map((f) => {
        const id = String(f.properties.codarea ?? f.properties.id ?? "");
        const d = by.get(id);
        return { ...f, properties: { ...f.properties, id, name: d?.name ?? id, label: d?.label ?? "sem dado", fill: d?.cls == null ? (dark ? NODATA.dark : NODATA.light) : ramp[d.cls] } };
      })
    };
  }

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": isDark() ? "#0b1120" : "#f4f6fa" } }] },
      center: [-47, -22.9], zoom: 7, attributionControl: false
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Malha municipal: IBGE" }));
    m.on("load", () => {
      m.addSource("mun", { type: "geojson", data: colored() as never });
      m.addLayer({ id: "mun-fill", type: "fill", source: "mun", paint: { "fill-color": ["get", "fill"], "fill-opacity": 0.92 } });
      // contorno na cor da superfície = espaçador de 2 px entre polígonos vizinhos
      m.addLayer({ id: "mun-line", type: "line", source: "mun", paint: { "line-color": isDark() ? "#0b1120" : "#ffffff", "line-width": 1.5 } });
      m.addLayer({ id: "mun-hover", type: "line", source: "mun", paint: { "line-color": isDark() ? "#ffffff" : "#0d1424", "line-width": 2 }, filter: ["==", ["get", "id"], ""] });
      ready.current = true;
      fit(m);
    });
    m.on("mousemove", "mun-fill", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      m.getCanvas().style.cursor = "pointer";
      m.setFilter("mun-hover", ["==", ["get", "id"], f.properties.id]);
      popup.current.setLngLat(e.lngLat).setHTML(`<strong>${f.properties.name}</strong><br/>${f.properties.label}`).addTo(m);
    });
    m.on("mouseleave", "mun-fill", () => { m.getCanvas().style.cursor = ""; m.setFilter("mun-hover", ["==", ["get", "id"], ""]); popup.current.remove(); });
    map.current = m;
    return () => { m.remove(); map.current = null; ready.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fit(m: MLMap) {
    const b = new maplibregl.LngLatBounds();
    const walk = (c: unknown): void => { if (Array.isArray(c) && typeof c[0] === "number") b.extend(c as [number, number]); else if (Array.isArray(c)) c.forEach(walk); };
    geojson.features.forEach((f) => walk((f.geometry as { coordinates: unknown }).coordinates));
    if (!b.isEmpty()) m.fitBounds(b, { padding: 24, duration: 0 });
  }

  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource("mun") as GeoJSONSource).setData(colored() as never);
    fit(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojson, data]);

  return <div ref={el} className={`w-full overflow-hidden rounded-2xl border border-line ${className}`} role="region" aria-label="Mapa coroplético dos municípios selecionados" />;
}
