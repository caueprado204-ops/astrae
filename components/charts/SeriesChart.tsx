"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { EChartsOption } from "echarts";
import type { Provenance, Series } from "@/types/science";
import { download, seriesToCsv, seriesToJson, slug } from "@/utils/export";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false, loading: () => <div className="h-full animate-pulse rounded bg-panel2/50" /> });

export type ChartType = "line" | "area" | "bar" | "scatter";

function cssVar(name: string) {
  if (typeof window === "undefined") return "#888";
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `rgb(${v.split(" ").join(",")})` : "#888";
}

export const PALETTE = ["--accent", "--nino", "--ok", "--nina", "--warn", "--mars"];

interface Props {
  series: Series[];
  type?: ChartType;
  height?: number;
  provenance?: Provenance | null;
  title?: string;
  /** colore barras por sinal (ex.: ONI: positivo quente, negativo frio) */
  diverging?: boolean;
  thresholds?: { value: number; label: string }[];
  extra?: (o: EChartsOption) => EChartsOption;
}

export function SeriesChart({ series, type = "line", height = 320, provenance, title = "astrae-series", diverging, thresholds, extra }: Props) {
  const ref = useRef<{ getDataURL: (o: object) => string } | null>(null);
  const [theme, setTheme] = useState(0);
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme((t) => t + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const option = useMemo<EChartsOption>(() => {
    const ink = cssVar("--ink"), dim = cssVar("--dim"), line = cssVar("--line");
    const nino = cssVar("--nino"), nina = cssVar("--nina");
    const units = Array.from(new Set(series.map((s) => s.unit)));
    const twoAxes = units.length === 2;
    const o: EChartsOption = {
      animation: false,
      textStyle: { fontFamily: "Inter Tight, system-ui", color: dim },
      grid: { left: 52, right: twoAxes ? 52 : 18, top: 36, bottom: 64 },
      legend: { top: 0, textStyle: { color: dim }, icon: "roundRect", itemWidth: 10, itemHeight: 3 },
      tooltip: { trigger: "axis", backgroundColor: cssVar("--panel"), borderColor: line, textStyle: { color: ink, fontSize: 12 },
        valueFormatter: (v) => (v == null ? "—" : typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : String(v)) },
      toolbox: { right: 0, top: 0, iconStyle: { borderColor: dim }, feature: { dataZoom: { yAxisIndex: "none", title: { zoom: "Zoom", back: "Desfazer" } }, restore: { title: "Restaurar" } } },
      dataZoom: [{ type: "inside" }, { type: "slider", height: 18, bottom: 8, borderColor: line, textStyle: { color: dim }, fillerColor: "rgba(111,211,255,0.12)" }],
      xAxis: { type: "category", boundaryGap: type === "bar", axisLine: { lineStyle: { color: line } }, axisLabel: { color: dim }, data: Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.t)))) },
      yAxis: units.slice(0, 2).map((u, i) => ({
        type: "value", name: u, nameTextStyle: { color: dim }, position: i === 0 ? "left" : "right",
        splitLine: { show: i === 0, lineStyle: { color: line, type: "dashed" } }, axisLabel: { color: dim }, scale: true
      })),
      series: series.map((s, i) => {
        const yAxisIndex = twoAxes ? units.indexOf(s.unit) : 0;
        const color = cssVar(PALETTE[i % PALETTE.length]);
        const data = s.points.map((p) => p.v);
        const base = { name: `${s.label}${s.unit ? ` (${s.unit})` : ""}`, yAxisIndex, connectNulls: false };
        if (type === "bar") return { ...base, type: "bar" as const, data: diverging ? data.map((v) => ({ value: v, itemStyle: { color: v == null ? line : v >= 0 ? nino : nina } })) : data, itemStyle: { color }, barCategoryGap: "10%" };
        if (type === "scatter") return { ...base, type: "scatter" as const, data, symbolSize: 4, itemStyle: { color } };
        return {
          ...base, type: "line" as const, data, showSymbol: data.length < 60, symbolSize: 4, lineStyle: { width: 1.6, color }, itemStyle: { color },
          areaStyle: type === "area" ? { opacity: 0.12, color } : undefined,
          markLine: i === 0 && thresholds?.length ? { symbol: "none", silent: true, label: { color: dim, formatter: "{b}" }, lineStyle: { color: dim, type: "dotted" }, data: thresholds.map((t) => ({ yAxis: t.value, name: t.label })) } : undefined
        };
      })
    };
    return extra ? extra(o) : o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, type, diverging, thresholds, theme]);

  const name = slug(title);
  return (
    <div>
      <div style={{ height }}>
        <ReactECharts onChartReady={(inst: { getDataURL: (o: object) => string }) => { ref.current = inst; }} option={option} notMerge style={{ height: "100%", width: "100%" }} opts={{ renderer: "canvas" }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="btn text-xs" onClick={() => {
          const inst = ref.current;
          if (inst) download(`${name}.png`, dataUrlToBlob(inst.getDataURL({ pixelRatio: 2, backgroundColor: cssVar("--panel") })));
        }}><Download size={13} /> Download PNG</button>
        <button className="btn text-xs" onClick={() => download(`${name}.csv`, seriesToCsv(series, provenance), "text/csv")}><Download size={13} /> Download CSV</button>
        <button className="btn text-xs" onClick={() => download(`${name}.json`, seriesToJson(series, provenance), "application/json")}><Download size={13} /> Download JSON</button>
      </div>
    </div>
  );
}

function dataUrlToBlob(url: string) {
  const [meta, b64] = url.split(",");
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: meta.match(/:(.*?);/)?.[1] || "image/png" });
}
