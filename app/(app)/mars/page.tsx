"use client";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { PageHeader } from "@/components/shell/AppShell";
import { useApi } from "@/hooks/useApi";
import { SeriesChart } from "@/components/charts/SeriesChart";
import { Provenance } from "@/components/ui/Provenance";
import { Empty, ErrorState, Loading } from "@/components/ui/DataState";
import { KindTag } from "@/components/ui/KindTag";
import { SaveActions } from "@/components/research/SaveToResearch";
import { MARS_LAYERS, type MarsLayerKey, type MarsMarker } from "@/components/mars/mars-layers";
import type { Series } from "@/types/science";

const MarsMap = dynamic(() => import("@/components/mars/MarsMap").then((m) => m.MarsMap), { ssr: false, loading: () => <div className="h-[460px] animate-pulse rounded-md bg-panel" /> });

interface Sol { sol: number; terrestrialDate: string; ls: number | null; season: string; minTemp: number | null; maxTemp: number | null; minGroundTemp: number | null; maxGroundTemp: number | null; pressure: number | null; pressureTrend: string; humidity: number | null; windSpeed: number | null; windDirection: string | null; opacity: string; uv: string; sunrise: string; sunset: string }
interface RoverResp {
  meta: { name: string; mission: string; landing: string; status: string; endDate?: string; site: string; landingLat: number; landingLon: number; url: string; instruments: string[] };
  images: { id: string; sol?: number; camera: string; takenAt?: string; title: string; thumb: string; full: string; credit: string; link: string }[];
  imagesError?: string;
  position: { sol: number; lat: number; lon: number; elevation?: number; distanceKm?: number; source: string } | null;
}
const ROVERS = ["curiosity", "perseverance", "opportunity", "spirit"] as const;
const COLORS: Record<string, string> = { curiosity: "#6FD3FF", perseverance: "#F2994A", opportunity: "#4CC38A", spirit: "#E8B04B" };

function MarsInner() {
  const [tab, setTab] = useState(useSearchParams().get("tab") || "weather");
  return (
    <div>
      <PageHeader title="Mars Lab" subtitle="Clima medido na superfície, mapa global e imagens dos rovers — direto das publicações da NASA/JPL." />
      <div role="tablist" className="mb-5 flex gap-1 border-b border-line">
        {[["weather", "Mars Weather"], ["map", "Mapa de Marte"], ["rovers", "Mars Rovers"]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-mars text-ink" : "border-transparent text-dim hover:text-ink"}`}>{l}</button>
        ))}
      </div>
      {tab === "weather" && <Weather />}
      {tab === "map" && <MapTab />}
      {tab === "rovers" && <Rovers />}
    </div>
  );
}

function Weather() {
  const r = useApi<{ sols: Sol[]; disclaimer: string }>("/api/mars/weather");
  const [span, setSpan] = useState(360);
  const sols = useMemo(() => (r.data?.sols || []).slice(-span), [r.data, span]);
  const s = r.data?.sols.at(-1);
  const mk = (id: string, label: string, unit: string, f: (x: Sol) => number | null): Series => ({ id, label, unit, kind: "OBSERVED", points: sols.map((x) => ({ t: `Sol ${x.sol}`, v: f(x) })) });
  const temps = [mk("tmax", "Ar — máx.", "°C", (x) => x.maxTemp), mk("tmin", "Ar — mín.", "°C", (x) => x.minTemp), mk("gmax", "Solo — máx.", "°C", (x) => x.maxGroundTemp), mk("gmin", "Solo — mín.", "°C", (x) => x.minGroundTemp)];
  const pressure = [mk("p", "Pressão", "Pa", (x) => x.pressure)];

  if (r.state === "loading") return <Loading label="Consultando o feed REMS do Curiosity…" />;
  if (r.state === "error") return <ErrorState error={r.env?.error} onRetry={r.retry} />;
  if (!s) return <Empty />;
  const cell = (label: string, value: React.ReactNode, note?: string) => (
    <div className="bg-panel p-3"><dt className="text-xs text-dim">{label}</dt><dd className="readout mt-1 text-lg">{value}</dd>{note && <dd className="text-[11px] text-faint">{note}</dd>}</div>
  );
  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-lg">Sol {s.sol}</h2><span className="text-sm text-dim">{new Date(s.terrestrialDate + "T12:00:00").toLocaleDateString("pt-BR", { dateStyle: "long" })} na Terra · Cratera Gale</span><KindTag kind="OBSERVED" /></div>
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-4 lg:grid-cols-8">
          {cell("Temperatura do ar", `${s.minTemp ?? "—"} / ${s.maxTemp ?? "—"} °C`, "mín / máx")}
          {cell("Temperatura do solo", `${s.minGroundTemp ?? "—"} / ${s.maxGroundTemp ?? "—"} °C`, "mín / máx")}
          {cell("Pressão", s.pressure != null ? `${s.pressure} Pa` : "—", s.pressureTrend ? `${s.pressureTrend === "Higher" ? "acima" : "abaixo"} da média` : undefined)}
          {cell("Vento", s.windSpeed != null ? `${s.windSpeed}` : "não medido", s.windDirection ?? "não reportado pelo feed REMS")}
          {cell("Atmosfera", s.opacity, "opacidade")}
          {cell("Poeira", "—", "sem medida de poeira no feed")}
          {cell("Estação", s.season, s.ls != null ? `Ls ${s.ls}°` : undefined)}
          {cell("UV · Sol", s.uv, `nascer ${s.sunrise} · pôr ${s.sunset}`)}
        </dl>
      </section>

      <div className="flex flex-wrap gap-1">
        {[90, 360, 1000, 99999].map((n) => <button key={n} onClick={() => setSpan(n)} aria-pressed={span === n} className={`btn text-xs ${span === n ? "border-accent" : ""}`}>{n === 99999 ? "Missão inteira" : `${n} sols`}</button>)}
      </div>
      <section className="panel p-4">
        <h3 className="font-medium">Temperatura ao longo dos sols</h3>
        <SeriesChart series={temps} height={340} provenance={r.env?.provenance} title="mars-gale-temperature" />
      </section>
      <section className="panel p-4">
        <h3 className="font-medium">Pressão atmosférica — ciclo sazonal do CO₂</h3>
        <SeriesChart series={pressure} type="area" height={280} provenance={r.env?.provenance} title="mars-gale-pressure" />
        <div className="mt-2"><SaveActions item={{ externalId: "nasa:msl-rems", title: "Curiosity REMS — clima diário na Cratera Gale", itemType: "timeseries", source: "NASA", institution: "NASA/JPL · CAB", kind: "OBSERVED", originalUrl: "https://mars.nasa.gov/msl/weather/", provenance: r.env?.provenance || {}, payload: { api: "/api/mars/weather" } }} /></div>
        <Provenance p={r.env?.provenance} storedAt={r.env?.cache?.storedAt} stale={r.env?.cache?.stale} />
        {r.data?.disclaimer && <p className="mt-3 text-[11px] leading-relaxed text-faint">Aviso da fonte: {r.data.disclaimer}</p>}
      </section>
    </div>
  );
}

function useRoverPositions() {
  const [markers, setMarkers] = useState<MarsMarker[]>([]);
  useEffect(() => {
    Promise.all(ROVERS.map((r) => fetch(`/api/mars/rovers/${r}`).then((x) => x.json()).then((j) => ({ r, j })).catch(() => null))).then((all) => {
      const mk: MarsMarker[] = [];
      for (const x of all) {
        if (!x?.j?.data) continue;
        const d = x.j.data as RoverResp;
        if (d.position) mk.push({ id: x.r, lat: d.position.lat, lon: d.position.lon, label: `${d.meta.name} — sol ${d.position.sol}`, color: COLORS[x.r], detail: `Posição atual (waypoint oficial)${d.position.distanceKm ? ` · ${d.position.distanceKm} km percorridos` : ""}` });
        else mk.push({ id: x.r, lat: d.meta.landingLat, lon: d.meta.landingLon, label: `${d.meta.name} — local de pouso`, color: COLORS[x.r], detail: `${d.meta.site} · ${d.meta.landing}` });
      }
      setMarkers(mk);
    });
  }, []);
  return markers;
}

function MapTab() {
  const markers = useRoverPositions();
  const [layer, setLayer] = useState<MarsLayerKey>("viking");
  const [region, setRegion] = useState<{ south: number; west: number; north: number; east: number } | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="label">Camada</span>
        {(Object.keys(MARS_LAYERS) as MarsLayerKey[]).map((k) => (
          <label key={k} className="flex items-center gap-1.5"><input type="radio" name="ml" checked={layer === k} onChange={() => setLayer(k)} /> {MARS_LAYERS[k].label}</label>
        ))}
      </div>
      <MarsMap markers={markers} layer={layer} onRegion={setRegion} />
      <div className="flex flex-wrap gap-3 text-xs text-dim">
        {markers.map((m) => <span key={m.id} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />{m.label}</span>)}
      </div>
      {region && (
        <div className="panel p-3 text-sm">
          <p>Região selecionada: <span className="readout">{region.south.toFixed(2)}° a {region.north.toFixed(2)}° N · {region.west.toFixed(2)}° a {region.east.toFixed(2)}° E</span></p>
          <div className="mt-2"><SaveActions item={{ externalId: `mars-region:${Object.values(region).map((n) => n.toFixed(2)).join(",")}`, title: `Região de Marte ${region.south.toFixed(1)}…${region.north.toFixed(1)}°N, ${region.west.toFixed(1)}…${region.east.toFixed(1)}°E`, itemType: "map", source: "NASA", institution: "NASA Solar System Treks", kind: "IMAGERY", originalUrl: "https://trek.nasa.gov/mars/", provenance: { dataset: MARS_LAYERS[layer].id }, payload: { region, layer } }} /></div>
        </div>
      )}
      <p className="text-xs text-dim">Mosaicos do NASA Mars Trek (WMTS, projeção equiretangular, longitude leste). Posições dos rovers ativos: camadas de waypoints MMGIS da NASA/JPL; rovers encerrados aparecem no local de pouso.</p>
    </div>
  );
}

function Rovers() {
  const [rover, setRover] = useState<(typeof ROVERS)[number]>("curiosity");
  const [solInput, setSolInput] = useState("");
  const [sol, setSol] = useState<string>("");
  const [open, setOpen] = useState<RoverResp["images"][number] | null>(null);
  const r = useApi<RoverResp>(`/api/mars/rovers/${rover}${sol ? `?sol=${sol}` : ""}`);
  const d = r.data;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {ROVERS.map((x) => <button key={x} aria-pressed={rover === x} onClick={() => { setRover(x); setSol(""); setSolInput(""); }} className={`btn capitalize ${rover === x ? "border-mars" : ""}`}>{x}</button>)}
        {(rover === "curiosity" || rover === "perseverance") && (
          <form className="ml-auto flex gap-2" onSubmit={(e) => { e.preventDefault(); setSol(solInput.trim()); }}>
            <input className="input w-28" inputMode="numeric" placeholder="Sol" value={solInput} onChange={(e) => setSolInput(e.target.value.replace(/\D/g, ""))} aria-label="Filtrar por sol" />
            <button className="btn">Filtrar</button>
          </form>
        )}
      </div>
      {r.state === "loading" && <Loading label="Consultando imagens e posição do rover…" />}
      {r.state === "error" && <ErrorState error={r.env?.error} onRetry={r.retry} />}
      {d && (
        <>
          <section className="panel grid gap-4 p-4 md:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="font-display text-xl">{d.meta.name}</h2>
              <p className="text-sm text-dim">{d.meta.mission}</p>
              <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-1 text-sm">
                <dt className="text-dim">Missão</dt><dd>{d.meta.status === "active" ? <span className="text-ok">ativa</span> : <span className="text-dim">encerrada — {d.meta.endDate}</span>}</dd>
                <dt className="text-dim">Pouso</dt><dd>{new Date(d.meta.landing + "T12:00:00").toLocaleDateString("pt-BR")} · {d.meta.site}</dd>
                {d.position ? (<>
                  <dt className="text-dim">Sol atual</dt><dd className="readout">{d.position.sol}</dd>
                  <dt className="text-dim">Latitude</dt><dd className="readout">{d.position.lat.toFixed(5)}°</dd>
                  <dt className="text-dim">Longitude</dt><dd className="readout">{d.position.lon.toFixed(5)}° E</dd>
                  {d.position.distanceKm != null && (<><dt className="text-dim">Percorrido</dt><dd className="readout">{d.position.distanceKm} km</dd></>)}
                </>) : (<>
                  <dt className="text-dim">Latitude</dt><dd className="readout">{d.meta.landingLat.toFixed(4)}° (pouso)</dd>
                  <dt className="text-dim">Longitude</dt><dd className="readout">{d.meta.landingLon.toFixed(4)}° E (pouso)</dd>
                </>)}
              </dl>
              <a href={d.meta.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-accent hover:underline">Página oficial da missão</a>
            </div>
            <div>
              <h3 className="text-sm text-dim">Instrumentos</h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">{d.meta.instruments.map((i) => <li key={i} className="rounded border border-line px-2 py-0.5 text-xs">{i}</li>)}</ul>
            </div>
          </section>

          {d.imagesError && <ErrorState error={d.imagesError} />}
          {d.images.length === 0 && !d.imagesError && <Empty>Nenhuma imagem publicada para este filtro.</Empty>}
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {d.images.map((img) => (
              <li key={img.id}>
                <button onClick={() => setOpen(img)} className="group block w-full text-left" aria-label={`Ampliar ${img.title}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.thumb} alt={img.title} loading="lazy" className="aspect-square w-full rounded border border-line object-cover group-hover:border-mars" />
                  <p className="mt-1 truncate text-[11px] text-dim">{img.sol != null ? `Sol ${img.sol} · ` : ""}{img.camera}</p>
                </button>
              </li>
            ))}
          </ul>
          <Provenance p={r.env?.provenance} storedAt={r.env?.cache?.storedAt} stale={r.env?.cache?.stale} />
        </>
      )}

      {open && (
        <div role="dialog" aria-modal="true" aria-label={open.title} className="fixed inset-0 z-50 flex flex-col bg-bg/95 p-4" onClick={() => setOpen(null)}>
          <div className="flex items-start justify-between gap-4 text-sm" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="font-medium">{open.title}</p>
              <p className="text-xs text-dim">{open.camera}{open.takenAt ? ` · ${new Date(open.takenAt).toLocaleString("pt-BR")} UTC` : ""} · {open.credit}</p>
            </div>
            <div className="flex items-center gap-3">
              <a href={open.link} target="_blank" rel="noreferrer" className="text-xs text-accent">View original source</a>
              <button onClick={() => setOpen(null)} aria-label="Fechar"><X size={20} /></button>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open.full || open.thumb} alt={open.title} className="mx-auto mt-3 min-h-0 flex-1 object-contain" />
        </div>
      )}
    </div>
  );
}

export default function MarsPage() {
  return <Suspense><MarsInner /></Suspense>;
}
