"use client";
import { useEffect, useState } from "react";
import { SeriesChart } from "@/components/charts/SeriesChart";
import { GibsMap } from "@/components/maps/GibsMap";
import { useGibsVariables } from "@/components/maps/useGibs";
import { REGIONS } from "@/components/maps/gibs-client";
import { Provenance } from "@/components/ui/Provenance";
import { ErrorState, Loading } from "@/components/ui/DataState";
import type { ApiEnvelope, Provenance as P, Series } from "@/types/science";

export type Block =
  | { id: string; type: "heading" | "subheading" | "text"; text: string }
  | { id: string; type: "list"; items: string[] }
  | { id: string; type: "table"; rows: string[][] }
  | { id: string; type: "image"; url: string; caption: string }
  | { id: string; type: "link"; url: string; label: string }
  | { id: string; type: "reference"; text: string; url: string }
  | { id: string; type: "chart"; source: ChartSource; lat?: number; lon?: number; param?: string; start?: string; end?: string }
  | { id: string; type: "map"; variable: string; date: string; region: string };

export type ChartSource = "oni" | "nino-weekly" | "rems-temp" | "rems-pressure" | "power";
export const CHART_SOURCES: Record<ChartSource, string> = {
  oni: "ENSO — ONI (NOAA CPC)", "nino-weekly": "Niño 3.4 semanal (NOAA CPC)", "rems-temp": "Marte — temperatura (REMS)",
  "rems-pressure": "Marte — pressão (REMS)", power: "Ponto na Terra — NASA POWER"
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newBlock(type: Block["type"]): Block {
  const id = uid();
  switch (type) {
    case "list": return { id, type, items: [""] };
    case "table": return { id, type, rows: [["", ""], ["", ""]] };
    case "image": return { id, type, url: "", caption: "" };
    case "link": return { id, type, url: "", label: "" };
    case "reference": return { id, type, text: "", url: "" };
    case "chart": return { id, type, source: "oni" };
    case "map": return { id, type, variable: "sst_anomaly", date: new Date(Date.now() - 2 * 86400e3).toISOString().slice(0, 10), region: "global" };
    default: return { id, type, text: "" };
  }
}

/** Carrega a série do gráfico incorporado direto das rotas oficiais — o caderno nunca guarda números copiados. */
function useChartData(b: Extract<Block, { type: "chart" }>) {
  const [res, setRes] = useState<{ series: Series[]; prov: P | null; storedAt?: string; error?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    setRes(null);
    const go = async () => {
      let env: ApiEnvelope<unknown>; let series: Series[] = [];
      if (b.source === "oni") {
        env = await (await fetch("/api/enso/oni")).json();
        series = [{ id: "oni", label: "ONI", unit: "°C", kind: "INDEX", points: ((env.data as { season: string; year: number; anomaly: number }[]) || []).filter((r) => r.year >= 1990).map((r) => ({ t: `${r.season} ${r.year}`, v: r.anomaly })) }];
      } else if (b.source === "nino-weekly") {
        env = await (await fetch("/api/enso/weekly")).json();
        series = [{ id: "n34", label: "Niño 3.4", unit: "°C", kind: "OBSERVED", points: ((env.data as { week: string; nino34: number }[]) || []).slice(-156).map((r) => ({ t: r.week, v: r.nino34 })) }];
      } else if (b.source === "power") {
        const q = `lat=${b.lat ?? -15.79}&lon=${b.lon ?? -47.88}&start=${b.start ?? "2025-01-01"}&end=${b.end ?? new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 10)}&params=${b.param ?? "T2M"}`;
        env = await (await fetch(`/api/nasa/power?${q}`)).json();
        series = (env.data as { series: Series[] } | null)?.series || [];
      } else {
        env = await (await fetch("/api/mars/weather")).json();
        const sols = ((env.data as { sols: { sol: number; maxTemp: number | null; minTemp: number | null; pressure: number | null }[] } | null)?.sols || []).slice(-669);
        series = b.source === "rems-temp"
          ? [{ id: "max", label: "Ar máx.", unit: "°C", kind: "OBSERVED", points: sols.map((s) => ({ t: `Sol ${s.sol}`, v: s.maxTemp })) },
             { id: "min", label: "Ar mín.", unit: "°C", kind: "OBSERVED", points: sols.map((s) => ({ t: `Sol ${s.sol}`, v: s.minTemp })) }]
          : [{ id: "p", label: "Pressão", unit: "Pa", kind: "OBSERVED", points: sols.map((s) => ({ t: `Sol ${s.sol}`, v: s.pressure })) }];
      }
      if (alive) setRes({ series, prov: env.provenance, storedAt: env.cache?.storedAt, error: env.status === "error" ? env.error : undefined });
    };
    go().catch((e) => alive && setRes({ series: [], prov: null, error: String(e) }));
    return () => { alive = false; };
  }, [b.source, b.lat, b.lon, b.param, b.start, b.end]);
  return res;
}

export function ChartBlockView({ b }: { b: Extract<Block, { type: "chart" }> }) {
  const r = useChartData(b);
  if (!r) return <Loading />;
  if (r.error) return <ErrorState error={r.error} />;
  return (
    <div>
      <SeriesChart series={r.series} type={b.source === "oni" ? "bar" : "line"} diverging={b.source === "oni"} height={260} provenance={r.prov} title={`notebook-${b.source}`} />
      <Provenance p={r.prov} compact storedAt={r.storedAt} />
    </div>
  );
}

export function MapBlockView({ b }: { b: Extract<Block, { type: "map" }> }) {
  const g = useGibsVariables();
  const v = g.byKey[b.variable];
  const base = g.byKey.base?.layers[0];
  if (g.state === "loading") return <Loading />;
  if (!v?.available) return <p className="text-sm text-dim">Camada indisponível no GIBS.</p>;
  return (
    <div>
      <GibsMap layers={[...(base ? [{ layer: base, opacity: 1 }] : []), { layer: v.layers[0], opacity: 0.88 }]} date={b.date} bounds={REGIONS[b.region]?.bounds} className="h-[300px]" />
      <p className="mt-1 text-xs text-dim">{v.layers[0].title} · {b.date} · NASA GIBS</p>
    </div>
  );
}
