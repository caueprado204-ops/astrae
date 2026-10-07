"use client";
import { useEffect, useRef } from "react";
import maplibregl, { type Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { snapTime, tileUrl, type GibsLayer } from "./gibs-client";

export interface ActiveLayer { layer: GibsLayer; opacity: number }

interface Props {
  layers: ActiveLayer[];          // ordem: de baixo para cima
  date: string;
  bounds?: [[number, number], [number, number]];
  className?: string;
  onReady?: (m: MLMap) => void;
  onCursor?: (lngLat: { lng: number; lat: number } | null) => void;
  marker?: { lng: number; lat: number } | null;
}

export function GibsMap({ layers, date, bounds, className = "h-[560px]", onReady, onCursor, marker }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#070B14" } }] },
      center: [-50, -12], zoom: 2, maxZoom: 9, renderWorldCopies: true, attributionControl: false
    });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    m.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Imagery: NASA GIBS / ESDIS" }));
    m.on("load", () => { loaded.current = true; sync(); onReady?.(m); });
    m.on("mousemove", (e) => onCursor?.(e.lngLat));
    m.on("mouseout", () => onCursor?.(null));
    map.current = m;
    return () => { m.remove(); map.current = null; loaded.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sync() {
    const m = map.current;
    if (!m || !loaded.current) return;
    const wanted = new Set<string>();
    layers.forEach(({ layer, opacity }) => {
      const time = snapTime(layer, date);
      const id = `gibs-${layer.id}`;
      wanted.add(id);
      const src = m.getSource(id) as maplibregl.RasterTileSource | undefined;
      const url = tileUrl(layer, time);
      if (src && (src as unknown as { _astraeUrl?: string })._astraeUrl !== url) {
        m.removeLayer(id); m.removeSource(id);
      }
      if (!m.getSource(id)) {
        m.addSource(id, { type: "raster", tiles: [url], tileSize: 256, maxzoom: layer.maxZoom });
        (m.getSource(id) as unknown as { _astraeUrl?: string })._astraeUrl = url;
        m.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": opacity, "raster-fade-duration": 0 } });
      } else {
        m.setPaintProperty(id, "raster-opacity", opacity);
      }
      m.moveLayer(id); // mantém a ordem pedida
    });
    for (const l of m.getStyle().layers || []) {
      if (l.id.startsWith("gibs-") && !wanted.has(l.id)) { m.removeLayer(l.id); m.removeSource(l.id); }
    }
  }

  useEffect(sync, [layers, date]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (bounds && map.current) map.current.fitBounds(bounds, { padding: 20, duration: 600 });
  }, [bounds]);

  useEffect(() => {
    markerRef.current?.remove();
    if (marker && map.current) {
      markerRef.current = new maplibregl.Marker({ color: "#6FD3FF" }).setLngLat([marker.lng, marker.lat]).addTo(map.current);
      map.current.flyTo({ center: [marker.lng, marker.lat], zoom: Math.max(map.current.getZoom(), 5) });
    }
  }, [marker]);

  return <div ref={el} className={`w-full overflow-hidden rounded-md border border-line ${className}`} role="region" aria-label="Mapa interativo" />;
}
