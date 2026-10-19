"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Cloud, FlaskConical, GraduationCap, Network, Orbit, Waves } from "lucide-react";
import { PageHeader } from "@/components/shell/AppShell";
import { useApi } from "@/hooks/useApi";
import { useUser } from "@/hooks/useUser";
import { SeriesChart } from "@/components/charts/SeriesChart";
import { Sparkline } from "@/components/charts/Sparkline";
import { Provenance } from "@/components/ui/Provenance";
import { Planet, Stars } from "@/components/visual/Space";
import type { Series } from "@/types/science";

interface Oni { season: string; year: number; centerMonth: string; anomaly: number; episode: string; strength?: string }
interface Weekly { week: string; nino34: number }
interface Sol { sol: number; terrestrialDate: string; season: string; minTemp: number | null; maxTemp: number | null; minGroundTemp: number | null; maxGroundTemp: number | null; pressure: number | null; opacity: string; uv: string }
interface SourceStatus { id: string; institution: string; api: string; dataset: string; docs: string; state: string; latencyMs?: number; checkedAt: string }
interface Capital { name: string; temperature: number | null; humidity: number | null }

const sign = (v: number, d = 2) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;
const na = (s: string) => (s === "error" ? "Indisponível" : s === "loading" ? "…" : "—");
const RANGES = [["5A", 5], ["10A", 10], ["30A", 30], ["Tudo", 999]] as const;
const STATE: Record<string, { label: string; cls: string }> = {
  connected: { label: "Conectada", cls: "text-ok" },
  unavailable: { label: "Indisponível", cls: "text-bad" },
  "key-required": { label: "Requer chave", cls: "text-warn" },
  pending: { label: "Pendente", cls: "text-dim" }
};

export default function Overview() {
  const oni = useApi<Oni[]>("/api/enso/oni");
  const weekly = useApi<Weekly[]>("/api/enso/weekly");
  const status = useApi<{ status: string; synopsis?: string }>("/api/enso/status");
  const mars = useApi<{ sols: Sol[] }>("/api/mars/weather");
  const caps = useApi<{ rows: Capital[] }>("/api/brazil-climate/capitals");
  const { sb, user } = useUser();
  const [sources, setSources] = useState<SourceStatus[] | null>(null);
  const [counts, setCounts] = useState<{ projects: number; saved: number; notes: number } | null>(null);
  const [range, setRange] = useState<number>(10);
  const [srcFilter, setSrcFilter] = useState<"all" | "connected" | "other">("all");

  useEffect(() => { fetch("/api/sources").then((r) => r.json()).then((j) => setSources(j.data || [])).catch(() => setSources([])); }, []);
  useEffect(() => {
    if (!sb || !user) return;
    Promise.all([
      sb.from("projects").select("id", { count: "exact", head: true }),
      sb.from("saved_datasets").select("id", { count: "exact", head: true }),
      sb.from("notes").select("id", { count: "exact", head: true })
    ]).then(([p, s, n]) => setCounts({ projects: p.count ?? 0, saved: s.count ?? 0, notes: n.count ?? 0 }));
  }, [sb, user]);

  const o = oni.data?.at(-1);
  const prev = oni.data?.at(-2);
  const w = weekly.data?.at(-1);
  const s = mars.data?.sols.at(-1);
  const hottest = caps.data?.rows.filter((r) => r.temperature != null).sort((a, b) => b.temperature! - a.temperature!)[0];
  const connected = sources?.filter((x) => x.state === "connected").length ?? 0;
  const lastEpisode = (phase: string) => {
    const rows = oni.data || [];
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].episode === phase) return `${rows[i].season} ${rows[i].year}`;
    return "—";
  };

  const oniPoints = useMemo(() => {
    if (!oni.data?.length) return [];
    const last = oni.data[oni.data.length - 1].year;
    return oni.data.filter((r) => r.year > last - range).map((r) => ({ t: `${r.season} ${r.year}`, v: r.anomaly }));
  }, [oni.data, range]);
  const marsSeries: Series[] = useMemo(() => !mars.data ? [] : [
    { id: "max", label: "Máx. do ar", unit: "°C", kind: "OBSERVED", points: mars.data.sols.slice(-120).map((x) => ({ t: `Sol ${x.sol}`, v: x.maxTemp })) },
    { id: "min", label: "Mín. do ar", unit: "°C", kind: "OBSERVED", points: mars.data.sols.slice(-120).map((x) => ({ t: `Sol ${x.sol}`, v: x.minTemp })) }
  ], [mars.data]);
  const shownSources = (sources || []).filter((x) => srcFilter === "all" || (srcFilter === "connected" ? x.state === "connected" : x.state !== "connected"));
  const firstName = user?.email?.split("@")[0];

  return (
    <div>
      <PageHeader title="Overview" subtitle={firstName ? `Bem-vindo de volta, ${firstName}. Cada leitura abaixo é consultada agora na fonte oficial.` : "Status geral — cada leitura é consultada agora na fonte oficial e leva o link de origem."} />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* ── Destaque: ONI ── */}
        <section className="bento tint tint-earth p-5 sm:p-6 lg:col-span-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-dim">Pacífico · Oceanic Niño Index</p>
              <p className="readout mt-3 text-[40px] font-medium leading-none tracking-tight sm:text-5xl">{o ? `${sign(o.anomaly)} °C` : na(oni.state)}</p>
              <p className="mt-2 text-sm text-dim">
                {o ? <>{o.season} {o.year} · <span className="tint-ink font-medium">{o.episode}{o.strength ? ` ${o.strength.toLowerCase()}` : ""}</span>{prev && <> · {sign(o.anomaly - prev.anomaly)} vs. trimestre anterior</>}</> : "NOAA Climate Prediction Center"}
              </p>
            </div>
            <Link href="/enso" aria-label="Abrir ENSO Monitor" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-panel/60 hover:border-accent"><ArrowUpRight size={16} /></Link>
          </div>
          <div className="tint-ink mt-5"><Sparkline points={oniPoints} unit=" °C" zero height={130} format={(v) => sign(v)} /></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">{RANGES.map(([l, n]) => <button key={l} className="chip" aria-pressed={range === n} onClick={() => setRange(n)}>{l}</button>)}</div>
            <p className="text-[11px] text-dim">Status CPC: <span className="text-ink">{status.data?.status || na(status.state)}</span></p>
          </div>
        </section>

        {/* ── Seus ambientes (cartões coloridos) ── */}
        <section className="lg:col-span-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg">Ambientes</h2><Link href="/sources" className="text-xs text-dim hover:text-ink">Fontes →</Link></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <MiniCard tone="tint-lilac" icon={<Waves size={17} />} href="/enso" label="Niño 3.4 semanal"
              value={w ? `${sign(w.nino34)} °C` : na(weekly.state)} note={w ? `Semana ${new Date(w.week).toLocaleDateString("pt-BR")}` : "NOAA CPC"} source="OISST · NOAA" />
            <MiniCard tone="tint-mars" icon={<Orbit size={17} />} href="/mars" label={s ? `Marte · Sol ${s.sol}` : "Marte · Cratera Gale"}
              value={s ? `${s.minTemp ?? "—"} / ${s.maxTemp ?? "—"} °C` : na(mars.state)} note={s?.pressure != null ? `${s.pressure} Pa · ${s.opacity}` : "Ar mín/máx"} source="REMS · NASA/JPL" />
            <MiniCard tone="tint-sand" icon={<Cloud size={17} />} href="/climate" label="Brasil agora · mais quente"
              value={hottest ? `${hottest.temperature} °C` : na(caps.state)} note={hottest ? hottest.name : "Capitais (METAR)"} source="CPTEC/INPE" />
            <MiniCard tone="tint-mint" icon={<Network size={17} />} href="/sources" label="Fontes conectadas"
              value={sources ? `${connected} / ${sources.length}` : "…"} note="NASA · NOAA · INPE" source="verificação a cada 10 min" />
          </div>
        </section>

        {/* ── Tabela de fontes ── */}
        <section className="bento p-5 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg">Fontes oficiais <span className="text-sm text-dim">· {connected} de {sources?.length ?? "…"} conectadas</span></h2>
            <div className="flex gap-1">
              {([["all", "Todas"], ["connected", "Conectadas"], ["other", "Outras"]] as const).map(([k, l]) => <button key={k} className="chip" aria-pressed={srcFilter === k} onClick={() => setSrcFilter(k)}>{l}</button>)}
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-faint"><th className="pb-2 font-normal">Fonte</th><th className="pb-2 font-normal">Dataset</th><th className="pb-2 font-normal">Status</th><th className="pb-2 text-right font-normal">Latência</th></tr></thead>
              <tbody>
                {!sources && <tr><td colSpan={4} className="py-6 text-dim">Verificando fontes…</td></tr>}
                {shownSources.slice(0, 8).map((x) => (
                  <tr key={x.id} className="border-t border-line/60">
                    <td className="py-2.5 pr-3">
                      <a href={x.docs} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-accent">
                        <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-xl bg-ink px-1.5 font-mono text-[9.5px] font-semibold text-bg">{x.institution.split(/[\s/]/)[0].slice(0, 5)}</span>
                        <span><span className="block leading-tight">{x.api}</span><span className="text-[11px] text-dim">{x.institution}</span></span>
                      </a>
                    </td>
                    <td className="py-2.5 pr-3 text-dim">{x.dataset}</td>
                    <td className={`py-2.5 pr-3 ${STATE[x.state]?.cls || "text-dim"}`}>● {STATE[x.state]?.label || x.state}</td>
                    <td className="readout py-2.5 text-right text-dim">{x.latencyMs != null ? `${x.latencyMs} ms` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sources && shownSources.length > 8 && <Link href="/sources" className="mt-3 inline-block text-xs text-accent hover:underline">Ver todas as {shownSources.length} fontes →</Link>}
        </section>

        {/* ── Coluna direita: Study + pesquisa ── */}
        <div className="grid gap-4 lg:col-span-4">
          <Link href="/study" className="space-scene group relative isolate block min-h-[220px] overflow-hidden rounded-3xl border border-white/10 p-6">
            <Stars count={40} seed={99} />
            <Planet tone="aurora" top="78%" left="80%" width="560px" />
            <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(3,7,15,.85), transparent 80%)" }} />
            <div className="relative">
              <p className="eyebrow text-white/55">Study</p>
              <h3 className="mt-2 text-2xl font-medium leading-snug text-white">Aprenda com <span className="rounded-full border border-white/40 px-2 italic">videoaulas</span><br />oficiais da NASA</h3>
              <p className="mt-2 max-w-[16rem] text-sm text-white/65">Trilhas por tema, transcrição e anotações direto no caderno.</p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#03070f] transition group-hover:gap-3">Começar <ArrowRight size={14} /></span>
            </div>
          </Link>

          <section className="bento p-5">
            <div className="flex items-center justify-between"><h2 className="font-display text-lg">Minha pesquisa</h2><FlaskConical size={16} className="text-dim" /></div>
            {user ? (
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                {([["Projetos", counts?.projects, "/research"], ["Salvos", counts?.saved, "/saved"], ["Notas", counts?.notes, "/notebook"]] as const).map(([l, v, h]) => (
                  <Link key={l} href={h} className="rounded-2xl bg-panel2/70 px-2 py-3 hover:bg-panel2"><dd className="readout text-2xl">{v ?? "…"}</dd><dt className="mt-0.5 text-[11px] text-dim">{l}</dt></Link>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-dim">Entre na sua conta para guardar projetos, dados e notas. <Link href="/login" className="text-accent hover:underline">Entrar</Link></p>
            )}
            <Link href="/study" className="mt-3 flex items-center gap-2 text-xs text-dim hover:text-ink"><GraduationCap size={13} /> Continuar estudando</Link>
          </section>
        </div>

        {/* ── Gráficos ── */}
        <section className="bento p-5 lg:col-span-8">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg">Temperatura do ar na Cratera Gale</h2>
            <span className="chip">últimos 120 sols</span>
          </div>
          {marsSeries.length > 0 && <SeriesChart series={marsSeries} height={250} provenance={mars.env?.provenance} title="gale-air-temp" />}
          {mars.state === "error" && <p className="py-10 text-sm text-dim">Fonte temporariamente indisponível.</p>}
          <Provenance p={mars.env?.provenance} compact storedAt={mars.env?.cache?.storedAt} stale={mars.env?.cache?.stale} />
        </section>

        <section className="bento p-5 lg:col-span-4">
          <h2 className="font-display text-lg">Episódios ENSO</h2>
          <p className="mt-1 text-xs text-dim">Pelo critério do CPC: 5 trimestres seguidos com ONI além de ±0,5 °C.</p>
          <div className="mt-4 grid gap-2">
            <div className="tint tint-mars rounded-2xl p-4"><p className="text-[11px] text-dim">Último trimestre de El Niño</p><p className="tint-ink readout mt-1 text-xl">{oni.data ? lastEpisode("El Niño") : na(oni.state)}</p></div>
            <div className="tint tint-earth rounded-2xl p-4"><p className="text-[11px] text-dim">Último trimestre de La Niña</p><p className="tint-ink readout mt-1 text-xl">{oni.data ? lastEpisode("La Niña") : na(oni.state)}</p></div>
          </div>
          <Provenance p={oni.env?.provenance} compact storedAt={oni.env?.cache?.storedAt} stale={oni.env?.cache?.stale} />
        </section>
      </div>
    </div>
  );
}

function MiniCard({ tone, icon, label, value, note, source, href }: { tone: string; icon: React.ReactNode; label: string; value: string; note: string; source: string; href: string }) {
  return (
    <Link href={href} className={`tint ${tone} group flex min-h-[150px] flex-col justify-between rounded-3xl p-4 transition hover:-translate-y-0.5`}>
      <div>
        <p className="readout text-xl font-medium leading-tight sm:text-2xl">{value}</p>
        <p className="mt-1 text-xs text-dim">{label}</p>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="tint-ink flex h-9 w-9 items-center justify-center rounded-xl bg-panel/80 shadow-sm">{icon}</span>
        <span className="text-right text-[11px] leading-tight text-dim"><span className="tint-ink block">{note}</span>{source}</span>
      </div>
    </Link>
  );
}
