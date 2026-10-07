"use client";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";

interface Oni { season: string; year: number; anomaly: number; episode: string; strength?: string }
interface Sol { sol: number; terrestrialDate: string; minTemp: number | null; maxTemp: number | null; pressure: number | null }

/** Leituras ao vivo — cada número vem da API correspondente, com a fonte ao lado. */
export function LiveReadouts() {
  const oni = useApi<Oni[]>("/api/enso/oni");
  const mars = useApi<{ sols: Sol[] }>("/api/mars/weather");
  const o = oni.data?.[oni.data.length - 1];
  const s = mars.data?.sols?.[mars.data.sols.length - 1];
  const dash = <span className="text-faint">—</span>;
  const r0 = (v: number | null) => (v == null ? "—" : Math.round(v));

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line text-sm">
      <div className="bg-panel p-4">
        <dt className="text-xs text-dim">Pacífico · ONI {o ? `${o.season} ${o.year}` : ""}</dt>
        <dd className="readout mt-1 text-xl sm:text-2xl" style={{ color: o ? (o.anomaly >= 0.5 ? "rgb(var(--nino))" : o.anomaly <= -0.5 ? "rgb(var(--nina))" : undefined) : undefined }}>
          {o ? `${o.anomaly > 0 ? "+" : ""}${o.anomaly.toFixed(2)} °C` : oni.state === "error" ? <span className="font-sans text-base text-dim">Fonte indisponível agora</span> : dash}
        </dd>
        <dd className="mt-1 text-xs text-dim">{o ? `${o.episode}${o.strength ? ` (${o.strength.toLowerCase()})` : ""} · NOAA CPC` : "NOAA CPC"}</dd>
      </div>
      <div className="bg-panel p-4">
        <dt className="text-xs text-dim">Marte · Cratera Gale {s ? `· sol ${s.sol}` : ""}</dt>
        <dd className="readout mt-1 text-xl sm:text-2xl">{s ? `${r0(s.minTemp)} / ${r0(s.maxTemp)} °C` : mars.state === "error" ? <span className="font-sans text-base text-dim">Fonte indisponível agora</span> : dash}</dd>
        <dd className="mt-1 text-xs text-dim">{s ? `mín/máx do ar · ${s.pressure ?? "—"} Pa · Curiosity REMS` : "Curiosity REMS"}</dd>
      </div>
      <Link href="/sources" className="col-span-2 bg-panel px-4 py-2.5 text-xs text-dim hover:text-ink">
        Ver o status de conexão de todas as fontes oficiais
      </Link>
    </dl>
  );
}
