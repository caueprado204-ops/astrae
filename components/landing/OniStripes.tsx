"use client";
import { useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";

interface Oni { season: string; year: number; anomaly: number; episode: string }

/** Faixas de ONI: cada coluna é um trimestre desde 1950, cor = anomalia (escala divergente). */
export function OniStripes({ height = 120 }: { height?: number }) {
  const { data, state, env } = useApi<Oni[]>("/api/enso/oni");
  const [hover, setHover] = useState<Oni | null>(null);
  const max = 2.6;
  const color = (a: number) => {
    const t = Math.max(-1, Math.min(1, a / max));
    const v = t >= 0 ? "--nino" : "--nina";
    return `rgb(var(${v}) / ${0.08 + Math.abs(t) * 0.92})`;
  };
  const last = data?.[data.length - 1];
  const decades = useMemo(() => (data || []).map((d, i) => ({ d, i })).filter(({ d }) => d.season === "DJF" && d.year % 10 === 0), [data]);

  return (
    <div className="relative">
      <div className="flex w-full items-end" style={{ height }} onMouseLeave={() => setHover(null)}>
        {state === "success" && data?.map((d, i) => (
          <div key={i} className="stripe h-full flex-1" style={{ background: color(d.anomaly), animationDelay: `${Math.min(i, 900) * 0.6}ms` }}
            onMouseEnter={() => setHover(d)} aria-hidden="true" />
        ))}
        {state === "loading" && <div className="h-full w-full animate-pulse bg-panel" />}
        {state === "error" && <div className="grid h-full w-full place-items-center text-sm text-dim">ONI indisponível agora — {env?.error?.slice(0, 80)}</div>}
      </div>
      {data && (
        <div className="relative h-5 text-[10px] text-faint">
          {decades.filter(({ i }) => i > 8).map(({ d, i }) => (
            <span key={d.year} className="absolute top-1 -translate-x-1/2 font-mono" style={{ left: `${(i / data.length) * 100}%` }}>{d.year}</span>
          ))}
        </div>
      )}
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-xs text-dim">
        <span>
          {hover
            ? <>Trimestre <span className="readout">{hover.season} {hover.year}</span> · ONI <span className="readout">{hover.anomaly > 0 ? "+" : ""}{hover.anomaly.toFixed(2)} °C</span> · {hover.episode}</>
            : <>Cada faixa é um trimestre desde 1950: anomalia da temperatura do Pacífico equatorial (Niño 3.4). Laranja, El Niño; azul, La Niña.</>}
        </span>
        {last && !hover && <span>Último: <span className="readout">{last.season} {last.year} · {last.anomaly > 0 ? "+" : ""}{last.anomaly.toFixed(2)} °C</span> — NOAA CPC</span>}
      </div>
    </div>
  );
}
