"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MLMap } from "maplibre-gl";
import { Pause, Play, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/AppShell";
import { GibsMap, type ActiveLayer } from "@/components/maps/GibsMap";
import { useGibsVariables } from "@/components/maps/useGibs";
import { Legend } from "@/components/maps/Legend";
import { REGIONS, daysAgo, snapTime } from "@/components/maps/gibs-client";
import { ErrorState, Loading } from "@/components/ui/DataState";
import { KindTag } from "@/components/ui/KindTag";
import { Provenance } from "@/components/ui/Provenance";

const DATA_VARS = ["temperature", "lst", "sst", "sst_anomaly", "precipitation", "clouds", "humidity", "pressure", "wind", "aerosols", "truecolor"];

function stepsBetween(start: string, end: string, monthly: boolean) {
  const out: string[] = [];
  const d = new Date(start + "T00:00:00Z"), e = new Date(end + "T00:00:00Z");
  if (monthly) d.setUTCDate(1);
  while (d <= e && out.length < 400) {
    out.push(d.toISOString().slice(0, 10));
    if (monthly) d.setUTCMonth(d.getUTCMonth() + 1); else d.setUTCDate(d.getUTCDate() + Math.max(1, Math.ceil((e.getTime() - new Date(start).getTime()) / 86400e3 / 60)));
  }
  return out;
}

export default function MapLab() {
  const gibs = useGibsVariables();
  const [variable, setVariable] = useState("temperature");
  const [layerIdx, setLayerIdx] = useState(0);
  const [region, setRegion] = useState("brazil");
  const [start, setStart] = useState("2026-01-01");
  const [end, setEnd] = useState(daysAgo(2));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [compare, setCompare] = useState(false);
  const [dateB, setDateB] = useState("2025-01-01");
  const [geoQ, setGeoQ] = useState("");
  const [geo, setGeo] = useState<{ name: string; lat: number; lon: number }[]>([]);
  const [marker, setMarker] = useState<{ lng: number; lat: number } | null>(null);
  const maps = useRef<MLMap[]>([]);

  const v = gibs.byKey[variable];
  const layer = v?.layers[layerIdx] ?? v?.layers[0];
  const base = gibs.byKey.base?.layers[0];
  const labels = gibs.byKey.labels?.layers[0];
  const monthly = layer?.periodicity === "P1M";
  const steps = useMemo(() => stepsBetween(start, end, monthly), [start, end, monthly]);
  const date = steps[Math.min(idx, steps.length - 1)] || end;

  useEffect(() => { setIdx(steps.length - 1); }, [steps.length]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % steps.length), 1400);
    return () => clearInterval(t);
  }, [playing, steps.length]);

  const stack = (l = layer): ActiveLayer[] => [
    ...(base && variable !== "truecolor" ? [{ layer: base, opacity: 1 }] : []),
    ...(l ? [{ layer: l, opacity: 0.88 }] : []),
    ...(labels ? [{ layer: labels, opacity: 1 }] : [])
  ];

  // sincroniza movimento entre os dois mapas no modo comparação
  function register(m: MLMap) {
    maps.current.push(m);
    m.on("move", () => {
      if ((m as unknown as { _syncing?: boolean })._syncing) return;
      for (const other of maps.current) if (other !== m) {
        (other as unknown as { _syncing?: boolean })._syncing = true;
        other.jumpTo({ center: m.getCenter(), zoom: m.getZoom() });
        (other as unknown as { _syncing?: boolean })._syncing = false;
      }
    });
  }

  async function searchPlace(e: React.FormEvent) {
    e.preventDefault();
    if (geoQ.trim().length < 2) return;
    const r = await fetch(`/api/geocode?q=${encodeURIComponent(geoQ)}`).then((x) => x.json());
    setGeo(r.data || []);
  }

  const bounds = REGIONS[region].bounds;

  return (
    <div>
      <PageHeader title="Map Lab" subtitle="Escolha variável, região e período; avance no tempo ou compare duas datas lado a lado." />
      {gibs.state === "loading" && <Loading label="Lendo o catálogo de camadas do NASA GIBS…" />}
      {gibs.state === "error" && <ErrorState error={gibs.env?.error} onRetry={gibs.retry} />}

      {gibs.state === "success" && (
        <>
          <div className="panel grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-6">
            <label className="block"><span className="label">Variable</span>
              <select className="input mt-1" value={variable} onChange={(e) => { setVariable(e.target.value); setLayerIdx(0); }}>
                {DATA_VARS.map((k) => gibs.byKey[k]).filter(Boolean).map((x) => <option key={x.key} value={x.key} disabled={!x.available}>{x.label}{x.available ? "" : " (indisponível)"}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Layer</span>
              <select className="input mt-1" value={layerIdx} onChange={(e) => setLayerIdx(Number(e.target.value))}>
                {v?.layers.map((l, i) => <option key={l.id} value={i}>{l.title}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Region</span>
              <select className="input mt-1" value={region} onChange={(e) => setRegion(e.target.value)}>
                {Object.entries(REGIONS).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Time range — início</span>
              <input type="date" className="input mt-1" value={start} min="2000-03-01" max={end} onChange={(e) => e.target.value && setStart(e.target.value)} />
            </label>
            <label className="block"><span className="label">Time range — fim</span>
              <input type="date" className="input mt-1" value={end} min={start} max={daysAgo(0)} onChange={(e) => e.target.value && setEnd(e.target.value)} />
            </label>
            <form onSubmit={searchPlace} className="block"><span className="label">Localização</span>
              <div className="mt-1 flex gap-1"><input className="input" placeholder="Cidade, lugar…" value={geoQ} onChange={(e) => setGeoQ(e.target.value)} /><button className="btn" aria-label="Buscar local"><Search size={14} /></button></div>
            </form>
          </div>
          {geo.length > 0 && (
            <ul className="panel mt-2 divide-y divide-line text-sm">
              {geo.map((g) => <li key={g.name}><button className="w-full px-3 py-1.5 text-left hover:bg-panel2" onClick={() => { setMarker({ lng: g.lon, lat: g.lat }); setGeo([]); }}>{g.name}</button></li>)}
              <li className="px-3 py-1 text-[11px] text-faint">Geocodificação © OpenStreetMap contributors (Nominatim)</li>
            </ul>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className="btn" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pausar animação" : "Animar período"}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? "Pausar" : "Animar"}</button>
            <input type="range" min={0} max={Math.max(0, steps.length - 1)} value={Math.min(idx, steps.length - 1)} onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }} className="min-w-[160px] flex-1" aria-label="Data no período" />
            <span className="readout text-sm">Date: {layer ? snapTime(layer, date) : date}</span>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={compare} onChange={(e) => { setCompare(e.target.checked); maps.current = []; }} /> Comparar datas</label>
            {compare && <input type="date" className="input w-auto" value={dateB} min="2000-03-01" max={daysAgo(0)} onChange={(e) => e.target.value && setDateB(e.target.value)} />}
            {v && <KindTag kind={v.kind} />}
          </div>

          <div className={`mt-3 grid gap-3 ${compare ? "md:grid-cols-2" : ""}`}>
            <div>
              {compare && <p className="mb-1 text-xs text-dim">A — {layer ? snapTime(layer, date) : date}</p>}
              <GibsMap key={`a-${compare}`} layers={stack()} date={date} bounds={bounds} onReady={register} marker={marker} className={compare ? "h-[420px]" : "h-[460px] sm:h-[600px]"} />
            </div>
            {compare && (
              <div>
                <p className="mb-1 text-xs text-dim">B — {layer ? snapTime(layer, dateB) : dateB}</p>
                <GibsMap key="b" layers={stack()} date={dateB} bounds={bounds} onReady={register} marker={marker} className="h-[420px]" />
              </div>
            )}
          </div>

          <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="text-xs text-dim">
              {layer && <p><span className="text-ink">{layer.title}</span> · <span className="font-mono">{layer.id}</span> · último dado publicado: {layer.defaultTime?.slice(0, 10) ?? "estático"} · resolução temporal {layer.periodicity ?? "—"}</p>}
              {v?.note && <p className="mt-1">{v.note}</p>}
              <p className="mt-1">Datas posteriores ao último dado publicado são ajustadas automaticamente para a mais recente disponível.</p>
            </div>
            {layer && <Legend layer={layer} />}
          </div>
          <Provenance p={gibs.env?.provenance ? { ...gibs.env.provenance, dataset: layer?.title || gibs.env.provenance.dataset, kind: v?.kind || "IMAGERY", period: `${start} → ${end}` } : null} storedAt={gibs.env?.cache?.storedAt} />
        </>
      )}
    </div>
  );
}
