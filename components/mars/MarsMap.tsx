"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Mapa global de Marte em projeção equiretangular (EPSG:4326 — matriz 2×1 no zoom 0),
 * exatamente o esquema de tiles declarado pelo WMTSCapabilities do NASA Mars Trek.
 */
import { MARS_LAYERS, type MarsLayerKey, type MarsMarker } from "./mars-layers";

const TREK = "https://trek.nasa.gov/tiles/Mars/EQ";

export function MarsMap({ markers, layer = "viking", onRegion }: { markers: MarsMarker[]; layer?: MarsLayerKey; onRegion?: (b: { south: number; west: number; north: number; east: number } | null) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const [cursor, setCursor] = useState<L.LatLng | null>(null);
  const [selecting, setSelecting] = useState(false);
  const firstCorner = useRef<L.LatLng | null>(null);
  const rect = useRef<L.Rectangle | null>(null);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { crs: L.CRS.EPSG4326, center: [0, 0], zoom: 1, minZoom: 0, maxZoom: 7, worldCopyJump: false, attributionControl: true });
    m.attributionControl.setPrefix(false).addAttribution("NASA Solar System Treks · USGS");
    markerLayer.current = L.layerGroup().addTo(m);
    m.on("mousemove", (e) => setCursor(e.latlng));
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current; if (!m) return;
    tiles.current?.remove();
    const l = MARS_LAYERS[layer];
    setTileError(false);
    tiles.current = L.tileLayer(`${TREK}/${l.id}/1.0.0/default/default028mm/{z}/{y}/{x}.${l.ext}`, { maxNativeZoom: l.maxZoom, maxZoom: 7, noWrap: true, bounds: [[-90, -180], [90, 180]] })
      .on("tileerror", () => setTileError(true))
      .addTo(m);
    tiles.current.bringToBack();
  }, [layer]);

  useEffect(() => {
    const g = markerLayer.current; if (!g) return;
    g.clearLayers();
    markers.forEach((mk) => {
      L.circleMarker([mk.lat, mk.lon], { radius: 7, color: "#fff", weight: 1.5, fillColor: mk.color, fillOpacity: 1 })
        .bindPopup(`<strong>${mk.label}</strong><br/>${mk.lat.toFixed(4)}°, ${mk.lon.toFixed(4)}°${mk.detail ? `<br/>${mk.detail}` : ""}`)
        .bindTooltip(mk.label, { direction: "top", offset: [0, -6] })
        .addTo(g);
    });
  }, [markers]);

  useEffect(() => {
    const m = map.current; if (!m) return;
    const click = (e: L.LeafletMouseEvent) => {
      if (!selecting) return;
      if (!firstCorner.current) { firstCorner.current = e.latlng; return; }
      const b = L.latLngBounds(firstCorner.current, e.latlng);
      rect.current?.remove();
      rect.current = L.rectangle(b, { color: "#6FD3FF", weight: 1.5, fillOpacity: 0.08 }).addTo(m);
      firstCorner.current = null;
      setSelecting(false);
      onRegion?.({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
    };
    m.on("click", click);
    m.getContainer().style.cursor = selecting ? "crosshair" : "";
    return () => { m.off("click", click); };
  }, [selecting, onRegion]);

  return (
    <div>
      <div className="relative">
        <div ref={el} className="h-[460px] w-full overflow-hidden rounded-md border border-line sm:h-[560px]" role="region" aria-label="Mapa de Marte" />
        <div className="pointer-events-none absolute bottom-6 left-2 z-[400] rounded bg-bg/80 px-2 py-1 font-mono text-[11px] text-dim">
          {cursor ? `${cursor.lat.toFixed(3)}°N, ${cursor.lng.toFixed(3)}°E (planetocêntrico)` : "lat, lon"}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-dim">
        <button className={`btn text-xs ${selecting ? "border-accent" : ""}`} onClick={() => { firstCorner.current = null; setSelecting(!selecting); }}>
          {selecting ? "Clique em dois cantos no mapa…" : "Selecionar região"}
        </button>
        <button className="btn text-xs" onClick={() => { rect.current?.remove(); rect.current = null; onRegion?.(null); }}>Limpar seleção</button>
        {tileError && <span className="text-warn">Alguns tiles do Mars Trek não carregaram — o serviço pode estar instável.</span>}
      </div>
    </div>
  );
}
