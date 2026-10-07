"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/AppShell";
import { useApi } from "@/hooks/useApi";
import { SeriesChart } from "@/components/charts/SeriesChart";
import { Provenance } from "@/components/ui/Provenance";
import { Empty, ErrorState, Loading } from "@/components/ui/DataState";
import { KindTag } from "@/components/ui/KindTag";
import { SaveActions } from "@/components/research/SaveToResearch";
import type { Series } from "@/types/science";

const PLACES: Record<string, [number, number]> = {
  "São Paulo/SP": [-23.55, -46.63], "Rio de Janeiro/RJ": [-22.91, -43.17], "Brasília/DF": [-15.79, -47.88],
  "Manaus/AM": [-3.12, -60.02], "Belém/PA": [-1.46, -48.49], "Recife/PE": [-8.05, -34.88], "Salvador/BA": [-12.97, -38.5],
  "Fortaleza/CE": [-3.73, -38.52], "Porto Alegre/RS": [-30.03, -51.23], "Curitiba/PR": [-25.43, -49.27],
  "Cuiabá/MT": [-15.6, -56.1], "Belo Horizonte/MG": [-19.92, -43.94], "Campinas/SP": [-22.9, -47.06]
};
const PARAMS = [
  ["T2M", "Temperatura média"], ["T2M_MAX", "Temperatura máxima"], ["T2M_MIN", "Temperatura mínima"], ["PRECTOTCORR", "Precipitação"],
  ["PS", "Pressão"], ["RH2M", "Umidade relativa"], ["WS10M", "Vento a 10 m"], ["ALLSKY_SFC_SW_DWN", "Radiação solar"]
] as const;

const TABS = [["historical", "Histórico, climatologia e anomalias"], ["forecast", "Previsão CPTEC"], ["now", "Agora nas capitais"], ["providers", "Fontes brasileiras"]] as const;

function ClimateInner() {
  const [tab, setTab] = useState<string>(useSearchParams().get("tab") || "historical");
  return (
    <div>
      <PageHeader title="Climate" subtitle="Dados climáticos do Brasil: previsão oficial do CPTEC/INPE, observações das capitais e séries diárias desde 1981 para qualquer coordenada." />
      <div role="tablist" className="mb-5 flex flex-wrap gap-1 border-b border-line">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-accent text-ink" : "border-transparent text-dim hover:text-ink"}`}>{l}</button>
        ))}
      </div>
      {tab === "historical" && <Historical />}
      {tab === "forecast" && <Forecast />}
      {tab === "now" && <Capitals />}
      {tab === "providers" && <Providers />}
    </div>
  );
}

function Historical() {
  const [place, setPlace] = useState("São Paulo/SP");
  const [lat, setLat] = useState(-23.55);
  const [lon, setLon] = useState(-46.63);
  const [start, setStart] = useState("2026-01-01");
  const [end, setEnd] = useState(new Date(Date.now() - 5 * 86400e3).toISOString().slice(0, 10));
  const [params, setParams] = useState<string[]>(["T2M", "PRECTOTCORR"]);
  const [anomaly, setAnomaly] = useState(true);
  const [type, setType] = useState<"line" | "area" | "bar" | "scatter">("line");
  const url = params.length ? `/api/nasa/power?lat=${lat}&lon=${lon}&start=${start}&end=${end}&params=${params.join(",")}&anomaly=${anomaly ? 1 : 0}` : null;
  const r = useApi<{ series: Series[]; anomalies: Series[]; climatologyPeriod?: string }>(url);

  return (
    <div className="space-y-4">
      <div className="panel grid gap-3 p-3 md:grid-cols-6">
        <label className="md:col-span-2"><span className="label">Localização</span>
          <select className="input mt-1" value={place} onChange={(e) => { setPlace(e.target.value); const c = PLACES[e.target.value]; if (c) { setLat(c[0]); setLon(c[1]); } }}>
            {Object.keys(PLACES).map((p) => <option key={p}>{p}</option>)}
            <option value="custom">Coordenada personalizada</option>
          </select>
        </label>
        <label><span className="label">Latitude</span><input type="number" step="0.01" className="input mt-1" value={lat} onChange={(e) => { setPlace("custom"); setLat(Number(e.target.value)); }} /></label>
        <label><span className="label">Longitude</span><input type="number" step="0.01" className="input mt-1" value={lon} onChange={(e) => { setPlace("custom"); setLon(Number(e.target.value)); }} /></label>
        <label><span className="label">Início</span><input type="date" className="input mt-1" min="1981-01-01" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} /></label>
        <label><span className="label">Fim</span><input type="date" className="input mt-1" value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} /></label>
        <fieldset className="md:col-span-6"><legend className="label">Variáveis</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {PARAMS.map(([k, l]) => {
              const onp = params.includes(k);
              return <button key={k} aria-pressed={onp} onClick={() => setParams(onp ? params.filter((p) => p !== k) : [...params, k])}
                className={`rounded-full border px-2.5 py-1 text-xs ${onp ? "border-accent bg-accent/10" : "border-line text-dim"}`}>{l}</button>;
            })}
            <label className="ml-auto flex items-center gap-2 text-xs"><input type="checkbox" checked={anomaly} onChange={(e) => setAnomaly(e.target.checked)} /> Calcular anomalias</label>
            <select className="input w-auto py-1 text-xs" value={type} onChange={(e) => setType(e.target.value as typeof type)} aria-label="Tipo de gráfico">
              <option value="line">Linha</option><option value="area">Área</option><option value="bar">Barras</option><option value="scatter">Dispersão</option>
            </select>
          </div>
        </fieldset>
      </div>

      {r.state === "loading" && <Loading label="Consultando NASA POWER…" />}
      {r.state === "error" && <ErrorState error={r.env?.error} onRetry={r.retry} />}
      {r.state === "empty" && <Empty />}
      {r.state === "success" && r.data && (
        <>
          {groupByUnit(r.data.series).map((g) => (
            <div key={g.unit} className="panel p-4">
              <div className="flex items-center gap-2"><h3 className="font-medium">{g.series.map((s) => s.label).join(" · ")}</h3><KindTag kind="MODEL" /></div>
              <SeriesChart series={g.series} type={type} provenance={r.env?.provenance} title={`power-${g.series.map((s) => s.id).join("-")}`} />
            </div>
          ))}
          {anomaly && r.data.anomalies.length > 0 && (
            <div className="panel p-4">
              <h3 className="font-medium">Anomalias diárias em relação à climatologia mensal POWER {r.data.climatologyPeriod ? `(${r.data.climatologyPeriod})` : ""}</h3>
              <SeriesChart series={r.data.anomalies} type="bar" diverging={r.data.anomalies.length === 1} provenance={r.env?.provenance} title="power-anomalies" />
            </div>
          )}
          <SaveActions item={{
            externalId: `power:${lat}:${lon}:${start}:${end}:${params.join(",")}`, title: `NASA POWER — ${params.join(", ")} em ${place === "custom" ? `${lat}, ${lon}` : place} (${start} → ${end})`,
            itemType: "timeseries", source: "NASA", institution: "NASA Langley Research Center", kind: "MODEL",
            originalUrl: "https://power.larc.nasa.gov/", provenance: r.env?.provenance || {}, payload: { api: url }
          }} />
          <Provenance p={r.env?.provenance} storedAt={r.env?.cache?.storedAt} stale={r.env?.cache?.stale} />
        </>
      )}
    </div>
  );
}

function groupByUnit(series: Series[]) {
  const m = new Map<string, Series[]>();
  series.forEach((s) => m.set(s.unit, [...(m.get(s.unit) || []), s]));
  return [...m.entries()].map(([unit, s]) => ({ unit, series: s }));
}

function Forecast() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const [city, setCity] = useState<{ id: number; name: string; uf: string } | null>(null);
  const cities = useApi<{ id: number; name: string; uf: string }[]>(query ? `/api/brazil-climate/cities?q=${encodeURIComponent(query)}` : null);
  const fc = useApi<{ city: string; uf: string; issued: string; days: { date: string; condition: string; max: number | null; min: number | null; uv: number | null }[] }>(city ? `/api/brazil-climate/forecast?city=${city.id}` : null);
  const series: Series[] = useMemo(() => !fc.data ? [] : [
    { id: "max", label: "Máxima prevista", unit: "°C", kind: "FORECAST", points: fc.data.days.map((d) => ({ t: d.date, v: d.max })) },
    { id: "min", label: "Mínima prevista", unit: "°C", kind: "FORECAST", points: fc.data.days.map((d) => ({ t: d.date, v: d.min })) }
  ], [fc.data]);

  return (
    <div className="space-y-4">
      <form className="flex max-w-lg gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) { setQuery(q.trim()); setCity(null); } }}>
        <input className="input" placeholder="Município, ex.: Campinas" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Município" />
        <button className="btn-primary">Buscar</button>
      </form>
      {cities.state === "loading" && <Loading />}
      {cities.state === "error" && <ErrorState error={cities.env?.error} onRetry={cities.retry} />}
      {cities.state === "empty" && <Empty>O CPTEC não encontrou esse município. Tente sem acentos ou outro nome.</Empty>}
      {cities.data && !city && (
        <ul className="flex flex-wrap gap-2">{cities.data.map((c) => <li key={c.id}><button className="btn text-xs" onClick={() => setCity(c)}>{c.name}/{c.uf}</button></li>)}</ul>
      )}
      {fc.state === "loading" && <Loading label="Consultando a previsão do CPTEC/INPE…" />}
      {fc.state === "error" && <ErrorState error={fc.env?.error} onRetry={fc.retry} />}
      {fc.data && (
        <div className="panel p-4">
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{fc.data.city}/{fc.data.uf} — previsão de 7 dias</h3><KindTag kind="FORECAST" /><span className="text-xs text-dim">emitida em {fc.data.issued}</span></div>
          <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-4 lg:grid-cols-7">
            {fc.data.days.map((d) => (
              <div key={d.date} className="bg-panel p-3 text-sm">
                <p className="text-xs text-dim">{new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</p>
                <p className="readout mt-1">{d.max ?? "—"}° <span className="text-dim">/ {d.min ?? "—"}°</span></p>
                <p className="mt-1 text-xs leading-snug text-dim">{d.condition}</p>
                {d.uv != null && <p className="mt-1 text-[11px] text-faint">UV {d.uv}</p>}
              </div>
            ))}
          </div>
          <div className="mt-4"><SeriesChart series={series} provenance={fc.env?.provenance} height={240} title={`cptec-${fc.data.city}`} /></div>
          <Provenance p={fc.env?.provenance} storedAt={fc.env?.cache?.storedAt} stale={fc.env?.cache?.stale} />
        </div>
      )}
    </div>
  );
}

function Capitals() {
  const r = useApi<{ rows: { station: string; name: string; updated: string; temperature: number | null; humidity: number | null; pressure: number | null; windSpeed: number | null; windDir: number | null; condition: string }[] }>("/api/brazil-climate/capitals");
  if (r.state === "loading") return <Loading />;
  if (r.state === "error") return <ErrorState error={r.env?.error} onRetry={r.retry} />;
  if (r.state === "empty" || !r.data) return <Empty />;
  return (
    <div className="panel overflow-x-auto p-4">
      <div className="mb-2 flex items-center gap-2"><h3 className="font-medium">Condições atuais nas capitais</h3><KindTag kind="OBSERVED" /></div>
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs text-dim"><tr className="border-b border-line">
          <th className="py-2 pr-3 font-normal">Estação</th><th className="pr-3 font-normal">Temp. (°C)</th><th className="pr-3 font-normal">Umidade (%)</th>
          <th className="pr-3 font-normal">Pressão (hPa)</th><th className="pr-3 font-normal">Vento (km/h)</th><th className="pr-3 font-normal">Tempo</th><th className="font-normal">Atualização</th>
        </tr></thead>
        <tbody>
          {r.data.rows.map((x) => (
            <tr key={x.station} className="border-b border-line/60">
              <td className="py-1.5 pr-3">{x.name} <span className="font-mono text-[11px] text-faint">{x.station}</span></td>
              <td className="readout pr-3">{x.temperature ?? "—"}</td><td className="readout pr-3">{x.humidity ?? "—"}</td>
              <td className="readout pr-3">{x.pressure ?? "—"}</td><td className="readout pr-3">{x.windSpeed ?? "—"}{x.windDir != null ? ` · ${x.windDir}°` : ""}</td>
              <td className="pr-3 text-dim">{x.condition}</td><td className="text-xs text-dim">{x.updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Provenance p={r.env?.provenance} storedAt={r.env?.cache?.storedAt} stale={r.env?.cache?.stale} />
    </div>
  );
}

function Providers() {
  const [data, setData] = useState<{ providers: { id: string; institution: string; name: string; status: string; kind: string; variables: string[]; docs: string; notes: string }[] } | null>(null);
  useEffect(() => { fetch("/api/brazil-climate").then((r) => r.json()).then(setData).catch(() => setData({ providers: [] })); }, []);
  if (!data) return <Loading />;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {data.providers.map((p) => (
        <li key={p.id} className="panel p-4">
          <div className="flex items-center gap-2 text-xs">
            <span className={p.status === "live" ? "text-ok" : "text-warn"}>{p.status === "live" ? "● Connected" : "○ Integration pending"}</span>
            <KindTag kind={p.kind as never} />
          </div>
          <h3 className="mt-1 font-medium">{p.institution} — {p.name}</h3>
          <p className="mt-1 text-sm text-dim">{p.notes}</p>
          <p className="mt-2 text-xs text-faint">{p.variables.join(" · ")}</p>
          <a className="mt-2 inline-block text-xs text-accent hover:underline" href={p.docs} target="_blank" rel="noreferrer">Documentação oficial</a>
        </li>
      ))}
    </ul>
  );
}

export default function ClimatePage() {
  return <Suspense><ClimateInner /></Suspense>;
}
