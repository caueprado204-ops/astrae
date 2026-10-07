"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/AppShell";
import { SeriesChart, type ChartType } from "@/components/charts/SeriesChart";
import { Provenance } from "@/components/ui/Provenance";
import { Empty, ErrorState, Loading } from "@/components/ui/DataState";
import { KindTag } from "@/components/ui/KindTag";
import { SaveActions } from "@/components/research/SaveToResearch";
import { GibsMap } from "@/components/maps/GibsMap";
import { useGibsVariables } from "@/components/maps/useGibs";
import { REGIONS } from "@/components/maps/gibs-client";
import type { ApiEnvelope, Provenance as P, Series } from "@/types/science";

const MarsMap = dynamic(() => import("@/components/mars/MarsMap").then((m) => m.MarsMap), { ssr: false });

type DatasetId = "power" | "oni" | "weekly" | "rems";
interface DatasetDef { id: DatasetId; source: string; label: string; variables: [string, string][]; region: "point" | "fixed"; regionLabel?: string; periodKind: "date" | "year" | "sol" }

const DATASETS: DatasetDef[] = [
  { id: "power", source: "NASA", label: "POWER Daily — Terra (reanálise)", region: "point", periodKind: "date",
    variables: [["T2M", "Temperatura média 2 m"], ["T2M_MAX", "Temperatura máxima"], ["T2M_MIN", "Temperatura mínima"], ["PRECTOTCORR", "Precipitação"], ["PS", "Pressão"], ["RH2M", "Umidade relativa"], ["WS10M", "Vento 10 m"], ["ALLSKY_SFC_SW_DWN", "Radiação solar"]] },
  { id: "rems", source: "NASA", label: "Mars — Curiosity REMS", region: "fixed", regionLabel: "Cratera Gale, Marte", periodKind: "date",
    variables: [["maxTemp", "Temperatura do ar máx."], ["minTemp", "Temperatura do ar mín."], ["maxGroundTemp", "Temperatura do solo máx."], ["minGroundTemp", "Temperatura do solo mín."], ["pressure", "Pressão"]] },
  { id: "oni", source: "NOAA", label: "Oceanic Niño Index (ONI)", region: "fixed", regionLabel: "Niño 3.4", periodKind: "year", variables: [["anomaly", "Anomalia ONI"], ["total", "TSM absoluta Niño 3.4"]] },
  { id: "weekly", source: "NOAA", label: "Anomalias semanais OISST — regiões Niño", region: "fixed", regionLabel: "Pacífico equatorial", periodKind: "date",
    variables: [["nino34", "Niño 3.4"], ["nino12", "Niño 1+2"], ["nino3", "Niño 3"], ["nino4", "Niño 4"]] }
];

const PLACES: Record<string, [number, number]> = { "Brasília": [-15.79, -47.88], "São Paulo": [-23.55, -46.63], "Manaus": [-3.12, -60.02], "Porto Alegre": [-30.03, -51.23], "Recife": [-8.05, -34.88], "Belém": [-1.46, -48.49] };
const UNIT: Record<string, string> = { maxTemp: "°C", minTemp: "°C", maxGroundTemp: "°C", minGroundTemp: "°C", pressure: "Pa", anomaly: "°C", total: "°C", nino34: "°C", nino12: "°C", nino3: "°C", nino4: "°C" };

export default function DataExplorer() {
  const [source, setSource] = useState("NASA");
  const [dsId, setDsId] = useState<DatasetId>("power");
  const ds = DATASETS.find((d) => d.id === dsId)!;
  const [vars, setVars] = useState<string[]>(["T2M"]);
  const [place, setPlace] = useState("Brasília");
  const [start, setStart] = useState("2025-01-01");
  const [end, setEnd] = useState(new Date(Date.now() - 6 * 86400e3).toISOString().slice(0, 10));
  const [chart, setChart] = useState<ChartType>("line");
  const [result, setResult] = useState<{ series: Series[]; prov: P | null; storedAt?: string } | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error" | "empty">("idle");
  const [error, setError] = useState<string>();
  const gibs = useGibsVariables();

  useEffect(() => { const d = DATASETS.find((x) => x.source === source)!; setDsId(d.id); }, [source]);
  useEffect(() => {
    setVars([ds.variables[0][0]]);
    if (ds.periodKind === "year") { setStart("2000-01-01"); }
  }, [dsId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run() {
    setState("loading"); setError(undefined);
    try {
      let series: Series[] = []; let env: ApiEnvelope<unknown>;
      if (ds.id === "power") {
        const [lat, lon] = PLACES[place];
        env = await (await fetch(`/api/nasa/power?lat=${lat}&lon=${lon}&start=${start}&end=${end}&params=${vars.join(",")}`)).json();
        series = (env.data as { series: Series[] } | null)?.series || [];
      } else if (ds.id === "rems") {
        env = await (await fetch("/api/mars/weather")).json();
        const sols = ((env.data as { sols: Record<string, number | string | null>[] } | null)?.sols || []).filter((s) => String(s.terrestrialDate) >= start && String(s.terrestrialDate) <= end);
        series = vars.map((v) => ({ id: v, label: ds.variables.find((x) => x[0] === v)![1], unit: UNIT[v], kind: "OBSERVED", points: sols.map((s) => ({ t: `Sol ${s.sol} (${s.terrestrialDate})`, v: s[v] as number | null })) }));
      } else if (ds.id === "oni") {
        env = await (await fetch("/api/enso/oni")).json();
        const rows = ((env.data as Record<string, number | string>[] | null) || []).filter((r) => Number(r.year) >= Number(start.slice(0, 4)) && Number(r.year) <= Number(end.slice(0, 4)));
        series = vars.map((v) => ({ id: v, label: ds.variables.find((x) => x[0] === v)![1], unit: "°C", kind: "INDEX", points: rows.map((r) => ({ t: `${r.season} ${r.year}`, v: r[v] as number })) }));
      } else {
        env = await (await fetch("/api/enso/weekly")).json();
        const rows = ((env.data as Record<string, number | string>[] | null) || []).filter((r) => String(r.week) >= start && String(r.week) <= end);
        series = vars.map((v) => ({ id: v, label: ds.variables.find((x) => x[0] === v)![1], unit: "°C", kind: "OBSERVED", points: rows.map((r) => ({ t: String(r.week), v: r[v] as number })) }));
      }
      if (env.status === "error") { setError(env.error); setState("error"); return; }
      const prov = env.provenance ? { ...env.provenance, period: `${start} → ${end}`, location: ds.region === "point" ? `${place} (${PLACES[place].join(", ")})` : ds.regionLabel } : null;
      setResult({ series, prov, storedAt: env.cache?.storedAt });
      setState(series.some((s) => s.points.length) ? "success" : "empty");
    } catch (e) { setError(String((e as Error).message)); setState("error"); }
  }

  const table = useMemo(() => {
    if (!result) return [];
    const ts = Array.from(new Set(result.series.flatMap((s) => s.points.map((p) => p.t))));
    const maps = result.series.map((s) => new Map(s.points.map((p) => [p.t, p.v])));
    return ts.map((t) => [t, ...maps.map((m) => m.get(t))] as const);
  }, [result]);

  const sstA = gibs.byKey.sst_anomaly?.layers[0], base = gibs.byKey.base?.layers[0], temp = gibs.byKey.temperature?.layers[0];

  return (
    <div>
      <PageHeader title="Data Explorer" subtitle="Escolha fonte, dataset, variável, região e período. A plataforma consulta a fonte oficial e gera tabela, gráfico e mapa." />

      <div className="panel grid gap-3 p-3 md:grid-cols-5">
        <label><span className="label">Source</span>
          <select className="input mt-1" value={source} onChange={(e) => setSource(e.target.value)}>{Array.from(new Set(DATASETS.map((d) => d.source))).map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <label><span className="label">Dataset</span>
          <select className="input mt-1" value={dsId} onChange={(e) => setDsId(e.target.value as DatasetId)}>{DATASETS.filter((d) => d.source === source).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select>
        </label>
        <label><span className="label">Region</span>
          {ds.region === "point"
            ? <select className="input mt-1" value={place} onChange={(e) => setPlace(e.target.value)}>{Object.keys(PLACES).map((p) => <option key={p}>{p}</option>)}</select>
            : <input className="input mt-1" value={ds.regionLabel} readOnly />}
        </label>
        <label><span className="label">Period — início</span><input type="date" className="input mt-1" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} /></label>
        <label><span className="label">Period — fim</span><input type="date" className="input mt-1" value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} /></label>
        <fieldset className="md:col-span-5"><legend className="label">Variable</legend>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {ds.variables.map(([k, l]) => {
              const on = vars.includes(k);
              return <button key={k} aria-pressed={on} onClick={() => setVars(on ? vars.filter((v) => v !== k) : [...vars, k])} className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-accent bg-accent/10" : "border-line text-dim"}`}>{l}</button>;
            })}
            <select className="input ml-auto w-auto py-1 text-xs" value={chart} onChange={(e) => setChart(e.target.value as ChartType)} aria-label="Tipo de gráfico">
              <option value="line">Linha</option><option value="area">Área</option><option value="bar">Barras</option><option value="scatter">Dispersão</option>
            </select>
            <button className="btn-primary" onClick={run} disabled={!vars.length}>Gerar</button>
          </div>
        </fieldset>
      </div>

      <div className="mt-4">
        {state === "idle" && <Empty>Defina os parâmetros e clique em Gerar.</Empty>}
        {state === "loading" && <Loading />}
        {state === "error" && <ErrorState error={error} onRetry={run} />}
        {state === "empty" && <Empty>A fonte não tem dados para este período.</Empty>}
        {state === "success" && result && (
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <section className="panel p-4">
              <div className="flex items-center gap-2"><h2 className="font-medium">Gráfico</h2>{result.prov && <KindTag kind={result.prov.kind} />}</div>
              <SeriesChart series={result.series} type={chart} diverging={dsId === "oni" && chart === "bar" && vars.length === 1} provenance={result.prov} title={`explorer-${dsId}`} />
              <div className="mt-3"><SaveActions item={{ externalId: `explorer:${dsId}:${vars.join(",")}:${start}:${end}:${place}`, title: `${ds.label} — ${vars.join(", ")} (${start} → ${end})`, itemType: "chart", source: ds.source, institution: result.prov?.institution, kind: result.prov?.kind || "CATALOG", originalUrl: result.prov?.originalUrl || "", provenance: result.prov || {}, payload: { dataset: dsId, vars, start, end, place, chart } }} /></div>
              <Provenance p={result.prov} storedAt={result.storedAt} />
            </section>
            <section className="panel p-4">
              <h2 className="font-medium">Mapa</h2>
              <div className="mt-2">
                {ds.id === "rems" && <MarsMap markers={[{ id: "msl", lat: -4.59, lon: 137.44, label: "Curiosity — Cratera Gale", color: "#C4552B" }]} />}
                {ds.id === "power" && base && <GibsMap layers={[{ layer: base, opacity: 1 }, ...(temp ? [{ layer: temp, opacity: 0.7 }] : [])]} date={end} bounds={REGIONS.brazil.bounds} marker={{ lng: PLACES[place][1], lat: PLACES[place][0] }} className="h-[360px]" />}
                {(ds.id === "oni" || ds.id === "weekly") && base && <GibsMap layers={[{ layer: base, opacity: 1 }, ...(sstA ? [{ layer: sstA, opacity: 0.9 }] : [])]} date={end} bounds={REGIONS.nino34.bounds} className="h-[360px]" />}
              </div>
              <p className="mt-2 text-xs text-dim">{ds.id === "power" ? "Ponto consultado sobre temperatura MERRA-2 do mês (GIBS)." : ds.id === "rems" ? "Local de medição do REMS." : "Anomalia de TSM mais próxima da data final (GIBS)."}</p>
            </section>
            <section className="panel overflow-auto p-4 xl:col-span-2" style={{ maxHeight: 420 }}>
              <h2 className="font-medium">Tabela <span className="text-xs text-dim">({table.length} linhas)</span></h2>
              <table className="mt-2 w-full text-sm">
                <thead className="sticky top-0 bg-panel text-left text-xs text-dim"><tr><th className="py-1.5 font-normal">Tempo</th>{result.series.map((s) => <th key={s.id} className="font-normal">{s.label} ({s.unit})</th>)}</tr></thead>
                <tbody>{table.map(([t, ...vs]) => <tr key={t} className="border-t border-line/50"><td className="py-1 font-mono text-xs">{t}</td>{vs.map((v, i) => <td key={i} className="readout">{v ?? "—"}</td>)}</tr>)}</tbody>
              </table>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
