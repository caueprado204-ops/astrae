"use client";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/AppShell";
import { useApi } from "@/hooks/useApi";
import { SeriesChart } from "@/components/charts/SeriesChart";
import { Provenance } from "@/components/ui/Provenance";
import { ErrorState, Loading } from "@/components/ui/DataState";
import { KindTag } from "@/components/ui/KindTag";
import { GibsMap } from "@/components/maps/GibsMap";
import { useGibsVariables } from "@/components/maps/useGibs";
import { Legend } from "@/components/maps/Legend";
import { REGIONS, daysAgo } from "@/components/maps/gibs-client";
import { SaveActions } from "@/components/research/SaveToResearch";
import type { Series } from "@/types/science";

interface Oni { season: string; year: number; centerMonth: string; total: number; anomaly: number; threshold: string; episode: "El Niño" | "La Niña" | "Neutral"; strength?: string }
interface Weekly { week: string; nino12: number; nino3: number; nino34: number; nino4: number }
const SEASONS = ["DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"];

const phaseColor = (p: string) => (p === "El Niño" ? "rgb(var(--nino))" : p === "La Niña" ? "rgb(var(--nina))" : "rgb(var(--dim))");

export default function EnsoMonitor() {
  const oni = useApi<Oni[]>("/api/enso/oni");
  const weekly = useApi<Weekly[]>("/api/enso/weekly");
  const status = useApi<{ status: string; synopsis?: string; issued?: string }>("/api/enso/status");
  const gibs = useGibsVariables();
  const [range, setRange] = useState<"all" | "30" | "10">("30");

  const last = oni.data?.at(-1);
  const series: Series[] = useMemo(() => {
    if (!oni.data) return [];
    const from = range === "all" ? 0 : new Date().getFullYear() - Number(range);
    return [{ id: "oni", label: "ONI", unit: "°C", kind: "INDEX", points: oni.data.filter((r) => r.year >= from).map((r) => ({ t: `${r.season} ${r.year}`, v: r.anomaly })) }];
  }, [oni.data, range]);

  const weeklySeries: Series[] = useMemo(() => {
    const w = (weekly.data || []).slice(-104);
    const mk = (k: keyof Weekly, label: string): Series => ({ id: k, label, unit: "°C", kind: "OBSERVED", points: w.map((x) => ({ t: x.week, v: x[k] as number })) });
    return w.length ? [mk("nino34", "Niño 3.4"), mk("nino12", "Niño 1+2"), mk("nino3", "Niño 3"), mk("nino4", "Niño 4")] : [];
  }, [weekly.data]);

  const episodes = useMemo(() => {
    const out: { phase: string; start: string; end: string; peak: number; strength?: string; ongoing: boolean }[] = [];
    const rows = oni.data || [];
    let i = 0;
    while (i < rows.length) {
      if (rows[i].episode === "Neutral") { i++; continue; }
      const ph = rows[i].episode; let j = i; let peak = 0; let str: string | undefined;
      while (j < rows.length && rows[j].episode === ph) { if (Math.abs(rows[j].anomaly) > Math.abs(peak)) { peak = rows[j].anomaly; str = rows[j].strength; } j++; }
      out.push({ phase: ph, start: `${rows[i].season} ${rows[i].year}`, end: `${rows[j - 1].season} ${rows[j - 1].year}`, peak, strength: str, ongoing: j === rows.length });
      i = j;
    }
    return out.reverse();
  }, [oni.data]);

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, []);

  const sstA = gibs.byKey.sst_anomaly?.layers[0];
  const base = gibs.byKey.base?.layers[0];

  return (
    <div>
      <PageHeader title="ENSO Monitor" subtitle="El Niño, La Niña e neutralidade a partir dos índices oficiais do NOAA Climate Prediction Center." />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="panel p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-dim"><span>Status oficial — ENSO Alert System (CPC)</span><KindTag kind="FORECAST" /></div>
          {status.state === "loading" && <Loading />}
          {status.state === "error" && <p className="mt-2 text-sm text-dim">Não foi possível ler a discussão diagnóstica do CPC agora. <a className="text-accent" href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml" target="_blank" rel="noreferrer">Abrir no site do CPC</a>.</p>}
          {status.data && (
            <>
              <p className="font-display mt-2 text-2xl">{status.data.status}</p>
              {status.data.synopsis && <p className="mt-2 text-sm leading-relaxed text-dim">{status.data.synopsis}</p>}
            </>
          )}
          <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded border border-line bg-line text-center">
            {(["La Niña", "Neutral", "El Niño"] as const).map((p) => {
              const activeP = last?.threshold === p;
              return (
                <div key={p} className="bg-panel p-3" style={activeP ? { boxShadow: `inset 0 -3px 0 ${phaseColor(p)}` } : undefined}>
                  <p className="text-sm" style={{ color: activeP ? phaseColor(p) : undefined }}>{p}</p>
                  <p className="text-[11px] text-faint">{p === "El Niño" ? "ONI ≥ +0,5" : p === "La Niña" ? "ONI ≤ −0,5" : "entre ±0,5"}</p>
                </div>
              );
            })}
          </div>
          {last && (
            <p className="mt-3 text-sm text-dim">
              ONI mais recente: <span className="readout">{last.season} {last.year} = {last.anomaly > 0 ? "+" : ""}{last.anomaly.toFixed(2)} °C</span>
              {last.episode !== "Neutral" ? ` · episódio de ${last.episode} (${last.strength?.toLowerCase()})` : " · sem episódio pelo critério de 5 trimestres"}
            </p>
          )}
          <Provenance p={status.env?.provenance} compact storedAt={status.env?.cache?.storedAt} />
        </section>

        <section className="panel p-5">
          <h2 className="font-medium">Timeline</h2>
          <p className="mt-1 text-xs text-dim">Trimestres móveis do ONI. Quadros vazios ainda não foram publicados.</p>
          <div className="mt-3 space-y-2">
            {years.map((y) => (
              <div key={y} className="grid grid-cols-[44px_repeat(12,1fr)] items-center gap-0.5">
                <span className="readout text-xs">{y}</span>
                {SEASONS.map((s) => {
                  const r = oni.data?.find((x) => x.year === y && x.season === s);
                  const a = r?.anomaly;
                  const bg = a == null ? "transparent" : `rgb(var(${a >= 0 ? "--nino" : "--nina"}) / ${0.12 + Math.min(1, Math.abs(a) / 2.5) * 0.88})`;
                  return (
                    <div key={s} title={r ? `${s} ${y}: ${a! > 0 ? "+" : ""}${a!.toFixed(2)} °C · ${r.episode}` : `${s} ${y}: sem dado`}
                      className="grid h-8 place-items-center rounded-sm border border-line/60 text-[9.5px] text-ink/80" style={{ background: bg }}>
                      {s.slice(1, 2)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-faint">Letra = mês central do trimestre (DJF → J).</p>
        </section>
      </div>

      <section className="panel mt-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium">ENSO Index — ONI</h2><KindTag kind="INDEX" />
          <div className="ml-auto flex gap-1">
            {(["10", "30", "all"] as const).map((r) => <button key={r} aria-pressed={range === r} onClick={() => setRange(r)} className={`btn text-xs ${range === r ? "border-accent" : ""}`}>{r === "all" ? "1950–hoje" : `${r} anos`}</button>)}
          </div>
        </div>
        {oni.state === "loading" && <Loading />}
        {oni.state === "error" && <ErrorState error={oni.env?.error} onRetry={oni.retry} />}
        {series.length > 0 && <SeriesChart series={series} type="bar" diverging height={340} provenance={oni.env?.provenance} title="oni" thresholds={[{ value: 0.5, label: "El Niño +0,5" }, { value: -0.5, label: "La Niña −0,5" }]} />}
        {oni.data && <div className="mt-2"><SaveActions item={{ externalId: "noaa:oni", title: "Oceanic Niño Index (ONI) — NOAA CPC", itemType: "timeseries", source: "NOAA", institution: "NOAA Climate Prediction Center", kind: "INDEX", originalUrl: "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/ONI_v5.php", provenance: oni.env?.provenance || {}, payload: { api: "/api/enso/oni" } }} /></div>}
        <Provenance p={oni.env?.provenance} storedAt={oni.env?.cache?.storedAt} stale={oni.env?.cache?.stale} />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="panel p-4">
          <div className="flex items-center gap-2"><h2 className="font-medium">Anomalias semanais — últimas 104 semanas</h2><KindTag kind="OBSERVED" /></div>
          {weekly.state === "loading" && <Loading />}
          {weekly.state === "error" && <ErrorState error={weekly.env?.error} onRetry={weekly.retry} />}
          {weeklySeries.length > 0 && <SeriesChart series={weeklySeries} height={300} provenance={weekly.env?.provenance} title="nino-weekly" thresholds={[{ value: 0, label: "0" }]} />}
          <Provenance p={weekly.env?.provenance} storedAt={weekly.env?.cache?.storedAt} stale={weekly.env?.cache?.stale} />
        </section>

        <section className="panel p-4">
          <div className="flex items-center gap-2"><h2 className="font-medium">Sea Surface Temperature Anomaly — Pacífico</h2><KindTag kind="MODEL" /></div>
          {gibs.state === "loading" && <Loading label="Carregando camadas do NASA GIBS…" />}
          {gibs.state === "error" && <ErrorState error={gibs.env?.error} onRetry={gibs.retry} />}
          {sstA ? (
            <>
              <GibsMap layers={[...(base ? [{ layer: base, opacity: 1 }] : []), { layer: sstA, opacity: 0.9 }]} date={daysAgo(2)} bounds={REGIONS.pacific.bounds} className="mt-2 h-[300px]" />
              <p className="mt-2 text-xs text-dim">{sstA.title} · último dado {sstA.defaultTime?.slice(0, 10)}. Região Niño 3.4: 5°N–5°S, 170°W–120°W.</p>
              <div className="mt-2"><Legend layer={sstA} /></div>
            </>
          ) : gibs.state === "success" && <p className="mt-3 text-sm text-dim">A camada de anomalia de TSM não está disponível no catálogo do GIBS agora.</p>}
        </section>
      </div>

      <section className="panel mt-4 overflow-x-auto p-4">
        <h2 className="font-medium">Episódios desde 1950</h2>
        <p className="mt-1 text-xs text-dim">Calculados a partir do ONI oficial pelo critério do CPC. A intensidade usa faixas convencionais de 0,5 °C sobre o pico.</p>
        <table className="mt-3 w-full min-w-[520px] text-sm">
          <thead className="text-left text-xs text-dim"><tr className="border-b border-line"><th className="py-2 font-normal">Fase</th><th className="font-normal">Início</th><th className="font-normal">Fim</th><th className="font-normal">Pico ONI</th><th className="font-normal">Intensidade</th></tr></thead>
          <tbody>
            {episodes.slice(0, 40).map((e) => (
              <tr key={e.start} className="border-b border-line/50">
                <td className="py-1.5" style={{ color: phaseColor(e.phase) }}>{e.phase}</td>
                <td className="readout">{e.start}</td><td className="readout">{e.ongoing ? "em curso" : e.end}</td>
                <td className="readout">{e.peak > 0 ? "+" : ""}{e.peak.toFixed(2)} °C</td><td className="text-dim">{e.strength}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
