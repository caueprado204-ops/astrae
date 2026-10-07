"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/AppShell";
import { useApi } from "@/hooks/useApi";
import { useUser } from "@/hooks/useUser";
import { SeriesChart } from "@/components/charts/SeriesChart";
import { Provenance } from "@/components/ui/Provenance";
import type { Series } from "@/types/science";

interface Oni { season: string; year: number; centerMonth: string; anomaly: number; episode: string; strength?: string }
interface Weekly { week: string; nino34: number }
interface Sol { sol: number; terrestrialDate: string; season: string; minTemp: number | null; maxTemp: number | null; minGroundTemp: number | null; maxGroundTemp: number | null; pressure: number | null; opacity: string; uv: string }
interface SourceStatus { id: string; state: string }
interface Capital { name: string; temperature: number | null; humidity: number | null }

function Cell({ label, value, note, href }: { label: string; value: React.ReactNode; note?: React.ReactNode; href?: string }) {
  const inner = (
    <>
      <dt className="text-xs text-dim">{label}</dt>
      <dd className="readout mt-1 text-lg leading-tight">{value}</dd>
      {note && <dd className="mt-1 text-xs text-dim">{note}</dd>}
    </>
  );
  return href ? <Link href={href} className="block bg-panel p-3.5 hover:bg-panel2">{inner}</Link> : <div className="bg-panel p-3.5">{inner}</div>;
}

function Group({ name, tone, children }: { name: string; tone: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-display text-sm tracking-[0.12em]"><span className="h-2 w-2 rounded-full" style={{ background: tone }} />{name}</h2>
      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">{children}</dl>
    </section>
  );
}

const fmtT = (v: number | null | undefined, u = "°C") => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)} ${u}`);
const na = (s: string) => (s === "error" ? "indisponível" : s === "loading" ? "…" : "—");

export default function Overview() {
  const oni = useApi<Oni[]>("/api/enso/oni");
  const weekly = useApi<Weekly[]>("/api/enso/weekly");
  const status = useApi<{ status: string; synopsis?: string }>("/api/enso/status");
  const mars = useApi<{ sols: Sol[] }>("/api/mars/weather");
  const caps = useApi<{ rows: Capital[] }>("/api/brazil-climate/capitals");
  const { sb, user } = useUser();
  const [sources, setSources] = useState<SourceStatus[] | null>(null);
  const [counts, setCounts] = useState<{ projects: number; saved: number } | null>(null);

  useEffect(() => { fetch("/api/sources").then((r) => r.json()).then((j) => setSources(j.data)).catch(() => setSources([])); }, []);
  useEffect(() => {
    if (!sb || !user) return;
    Promise.all([
      sb.from("projects").select("id", { count: "exact", head: true }),
      sb.from("saved_datasets").select("id", { count: "exact", head: true })
    ]).then(([p, s]) => setCounts({ projects: p.count ?? 0, saved: s.count ?? 0 }));
  }, [sb, user]);

  const o = oni.data?.at(-1);
  const w = weekly.data?.at(-1);
  const s = mars.data?.sols.at(-1);
  const lastEpisode = (phase: string) => {
    const rows = oni.data || [];
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].episode === phase) return `${rows[i].season} ${rows[i].year}`;
    return "—";
  };
  const hottest = caps.data?.rows.filter((r) => r.temperature != null).sort((a, b) => (b.temperature! - a.temperature!))[0];
  const connected = sources?.filter((x) => x.state === "connected").length;

  const oniSeries: Series[] = useMemo(() => !oni.data ? [] : [{
    id: "oni", label: "ONI", unit: "°C", kind: "INDEX",
    points: oni.data.filter((r) => r.year >= 2015).map((r) => ({ t: `${r.season} ${r.year}`, v: r.anomaly }))
  }], [oni.data]);
  const marsSeries: Series[] = useMemo(() => !mars.data ? [] : [
    { id: "max", label: "Máx. do ar", unit: "°C", kind: "OBSERVED", points: mars.data.sols.slice(-120).map((x) => ({ t: `Sol ${x.sol}`, v: x.maxTemp })) },
    { id: "min", label: "Mín. do ar", unit: "°C", kind: "OBSERVED", points: mars.data.sols.slice(-120).map((x) => ({ t: `Sol ${x.sol}`, v: x.minTemp })) }
  ], [mars.data]);

  return (
    <div>
      <PageHeader title="ASTRAE Monitor" subtitle="Status geral dos sistemas — cada leitura é consultada agora na fonte oficial e leva o link de origem." />

      <div className="grid gap-6">
        <Group name="EARTH" tone="rgb(var(--accent))">
          <Cell label="Climate · capitais agora" href="/climate"
            value={hottest ? `${hottest.temperature} °C` : na(caps.state)}
            note={hottest ? `Mais quente: ${hottest.name} · ${caps.data?.rows.length} estações METAR · CPTEC/INPE` : "CPTEC/INPE"} />
          <Cell label="Atmosphere · camadas de satélite" href="/earth" value="NASA GIBS"
            note="Temperatura, chuva, nuvens, aerossóis — abra o Earth Observatory" />
          <Cell label="Ocean · Niño 3.4 semanal" href="/enso" value={w ? fmtT(w.nino34) : na(weekly.state)}
            note={w ? `Semana de ${new Date(w.week).toLocaleDateString("pt-BR")} · OISST v2.1 · NOAA CPC` : "NOAA CPC"} />
        </Group>

        <Group name="MARS" tone="rgb(var(--mars))">
          <Cell label="Atmosphere · pressão" href="/mars" value={s?.pressure != null ? `${s.pressure} Pa` : na(mars.state)}
            note={s ? `Sol ${s.sol} · ${s.opacity} · REMS/Curiosity` : "REMS/Curiosity"} />
          <Cell label="Surface · temperatura do solo" href="/mars" value={s ? `${s.minGroundTemp ?? "—"} / ${s.maxGroundTemp ?? "—"} °C` : na(mars.state)}
            note="mín/máx do solo · Cratera Gale" />
          <Cell label="Weather · ar" href="/mars" value={s ? `${s.minTemp ?? "—"} / ${s.maxTemp ?? "—"} °C` : na(mars.state)}
            note={s ? `${s.season} marciano · UV ${s.uv} · ${s.terrestrialDate}` : undefined} />
        </Group>

        <Group name="CLIMATE" tone="rgb(var(--nino))">
          <Cell label="ENSO · status oficial (CPC)" href="/enso" value={status.data?.status || na(status.state)}
            note={o ? `ONI ${o.season} ${o.year}: ${fmtT(o.anomaly)}` : undefined} />
          <Cell label="El Niño · último trimestre em episódio" href="/enso" value={oni.data ? lastEpisode("El Niño") : na(oni.state)} note="critério: ≥5 trimestres ONI ≥ +0,5 °C" />
          <Cell label="La Niña · último trimestre em episódio" href="/enso" value={oni.data ? lastEpisode("La Niña") : na(oni.state)} note="critério: ≥5 trimestres ONI ≤ −0,5 °C" />
        </Group>

        <Group name="SCIENCE" tone="rgb(var(--ok))">
          <Cell label="Datasets salvos" href="/saved" value={counts ? counts.saved : user ? "…" : "—"} note={user ? "na sua conta" : "entre para salvar"} />
          <Cell label="Sources · conectadas" href="/sources" value={sources ? `${connected} / ${sources.length}` : "…"} note="NASA · NOAA · INPE" />
          <Cell label="Research · projetos" href="/research" value={counts ? counts.projects : user ? "…" : "—"} note="hipóteses, dados e referências" />
        </Group>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <div className="panel p-4">
          <h3 className="font-medium">ONI desde 2015</h3>
          {oniSeries.length > 0 && <SeriesChart series={oniSeries} type="bar" diverging height={260} provenance={oni.env?.provenance} title="oni-2015" thresholds={[{ value: 0.5, label: "+0,5" }, { value: -0.5, label: "−0,5" }]} />}
          <Provenance p={oni.env?.provenance} compact storedAt={oni.env?.cache?.storedAt} stale={oni.env?.cache?.stale} />
        </div>
        <div className="panel p-4">
          <h3 className="font-medium">Temperatura do ar na Cratera Gale — últimos 120 sols</h3>
          {marsSeries.length > 0 && <SeriesChart series={marsSeries} height={260} provenance={mars.env?.provenance} title="gale-air-temp" />}
          <Provenance p={mars.env?.provenance} compact storedAt={mars.env?.cache?.storedAt} stale={mars.env?.cache?.stale} />
        </div>
      </div>
    </div>
  );
}
