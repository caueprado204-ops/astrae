"use client";
import { useId, useState } from "react";

/** Gráfico de área compacto para os cartões do painel, com leitura do ponto sob o cursor/dedo. */
export function Sparkline({ points, unit = "", height = 120, zero = false, format = (v: number) => v.toFixed(2) }:
  { points: { t: string; v: number | null }[]; unit?: string; height?: number; zero?: boolean; format?: (v: number) => string }) {
  const id = useId().replace(/:/g, "");
  const data = points.filter((p): p is { t: string; v: number } => p.v != null && Number.isFinite(p.v));
  const [hover, setHover] = useState<number | null>(null);
  if (data.length < 2) return <div style={{ height }} />;

  const W = 600, H = height, pad = 8;
  const vs = data.map((d) => d.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (hi === lo) { hi += 1; lo -= 1; }
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (H - pad * 2);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.v).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const i = hover ?? data.length - 1;
  const d = data[i];

  return (
    <div className="relative select-none" style={{ height }}
      onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(data.length - 1, Math.round(((e.clientX - r.left) / r.width) * (data.length - 1))))); }}
      onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label={`Série: último valor ${format(data[data.length - 1].v)} ${unit}`}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity=".35" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {zero && <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity=".25" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />}
        <path d={area} fill={`url(#g${id})`} />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <line x1={x(i)} x2={x(i)} y1={y(d.v)} y2={H} stroke="currentColor" strokeOpacity=".35" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-current shadow"
        style={{ left: `${(x(i) / W) * 100}%`, top: y(d.v) }} />
      <span className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 font-mono text-[11px] text-bg shadow-lg"
        style={{ left: `clamp(48px, ${(x(i) / W) * 100}%, calc(100% - 48px))`, top: Math.max(0, y(d.v) - 34) }}>
        {format(d.v)}{unit} · {d.t}
      </span>
    </div>
  );
}
