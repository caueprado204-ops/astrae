"use client";
import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false, loading: () => <div className="h-full animate-pulse rounded bg-panel2/50" /> });
const css = (n: string) => { if (typeof window === "undefined") return "#888"; const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v ? `rgb(${v.split(" ").join(",")})` : "#888"; };

/** Dispersão x × y (pares completos), com rótulos de eixo e unidades. */
export function ScatterChart({ points, xLabel, yLabel, height = 300 }: { points: [number, number][]; xLabel: string; yLabel: string; height?: number }) {
  const option = useMemo(() => {
    const dim = css("--dim"), line = css("--line");
    return {
      animation: false, grid: { left: 56, right: 18, top: 16, bottom: 48 },
      tooltip: { trigger: "item", backgroundColor: css("--panel"), borderColor: line, textStyle: { color: css("--ink"), fontSize: 12 }, formatter: (p: { value: [number, number] }) => `${xLabel}: ${p.value[0].toFixed(2)}<br/>${yLabel}: ${p.value[1].toFixed(2)}` },
      xAxis: { type: "value", name: xLabel, nameLocation: "middle", nameGap: 30, scale: true, axisLabel: { color: dim }, nameTextStyle: { color: dim }, splitLine: { lineStyle: { color: line, type: "dashed" } } },
      yAxis: { type: "value", name: yLabel, nameLocation: "middle", nameGap: 42, scale: true, axisLabel: { color: dim }, nameTextStyle: { color: dim }, splitLine: { lineStyle: { color: line, type: "dashed" } } },
      series: [{ type: "scatter", data: points, symbolSize: 5, itemStyle: { color: css("--accent"), opacity: 0.6 } }]
    };
  }, [points, xLabel, yLabel]);
  return <div style={{ height }}><ReactECharts option={option} notMerge style={{ height: "100%", width: "100%" }} /></div>;
}
