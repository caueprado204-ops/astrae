"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, FlaskConical, Play } from "lucide-react";
import { PageHeader } from "@/components/shell/AppShell";
import { SeriesChart } from "@/components/charts/SeriesChart";
import { ScatterChart } from "@/components/analysis/ScatterChart";
import { MunicipalityPicker } from "@/components/analysis/MunicipalityPicker";
import { Provenance } from "@/components/ui/Provenance";
import { KindTag } from "@/components/ui/KindTag";
import { ErrorState, Loading } from "@/components/ui/DataState";
import { SaveActions } from "@/components/research/SaveToResearch";
import { pairs, strength, type Describe } from "@/lib/stats";
import { runAnalysis, seasonalProfile, type AnalysisParams, type Row } from "@/lib/healthAnalysis";
import { download, rowsToCsv } from "@/utils/export";
import type { ApiEnvelope, Series } from "@/types/science";

const CLIMATE: Record<string, { label: string; unit: string }> = {
  tmean: { label: "Temperatura média", unit: "°C" }, tmax: { label: "Temperatura máxima", unit: "°C" }, tmin: { label: "Temperatura mínima", unit: "°C" },
  prec: { label: "Precipitação semanal", unit: "mm" }, rh: { label: "Umidade relativa", unit: "%" }
};
const OUTCOME = { cases: { label: "Casos notificados", unit: "casos/semana" }, incidence: { label: "Incidência estimada", unit: "/100 mil" } } as const;
const DISEASES = { dengue: "Dengue", chikungunya: "Chikungunya", zika: "Zika" } as const;
const THIS_YEAR = new Date().getFullYear();

/** Configuração do estudo piloto (documentada em docs/PILOTO_CAMPINAS.md). */
const PILOT: AnalysisParams = { geocode: "3509502", place: "Campinas (SP)", disease: "dengue", from: 2015, to: 2025, climateVar: "tmean", outcome: "cases", maxLag: 12, method: "spearman", logOutcome: true, deseasonalize: false, dropRecentWeeks: 0 };

interface Weekly { rows: Row[]; lat: number; lon: number; place?: string; urls: string[] }

export default function HealthPage() {
  const [p, setP] = useState<AnalysisParams>(PILOT);
  const [mun, setMun] = useState({ id: PILOT.geocode, name: "Campinas", uf: "SP" });
  const [env, setEnv] = useState<ApiEnvelope<Weekly> | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [lagPick, setLagPick] = useState<number | null>(null);
  const set = (patch: Partial<AnalysisParams>) => setP((x) => ({ ...x, ...patch }));

  async function run() {
    setState("loading"); setLagPick(null);
    try {
      const r = await fetch(`/api/health/weekly?geocode=${p.geocode}&disease=${p.disease}&from=${p.from}&to=${p.to}`);
      const j = (await r.json()) as ApiEnvelope<Weekly>;
      setEnv(j); setState(j.status === "error" ? "error" : "done");
      if (j.data?.place) set({ place: j.data.place });
    } catch (e) { setEnv({ status: "error", data: null, provenance: null, error: String(e) }); setState("error"); }
  }

  const rows = env?.data?.rows || [];
  const raw = useMemo(() => rows.length ? runAnalysis(rows, { ...p, deseasonalize: false }) : null, [rows, p]);
  const des = useMemo(() => rows.length ? runAnalysis(rows, { ...p, deseasonalize: true }) : null, [rows, p]);
  const lag = lagPick ?? raw?.peak?.lag ?? 0;
  const c = CLIMATE[p.climateVar], o = OUTCOME[p.outcome];
  const yName = `${p.logOutcome ? "log(1 + " : ""}${o.label}${p.logOutcome ? ")" : ""}`;

  const series: Series[] = rows.length ? [
    { id: "out", label: o.label, unit: o.unit, kind: "OBSERVED", points: rows.map((r) => ({ t: `${r.year}-SE${String(r.week).padStart(2, "0")}`, v: r[p.outcome] as number | null })) },
    { id: "clim", label: c.label, unit: c.unit, kind: "MODEL", points: rows.map((r) => ({ t: `${r.year}-SE${String(r.week).padStart(2, "0")}`, v: r[p.climateVar] as number | null })) }
  ] : [];
  const lagSeries: Series[] = raw && des ? [
    { id: "raw", label: "Séries brutas", unit: "r", kind: "ESTIMATE", points: raw.lags.map((l) => ({ t: `${l.lag} sem`, v: l.r == null ? null : Math.round(l.r * 1000) / 1000 })) },
    { id: "des", label: "Sem sazonalidade média", unit: "r", kind: "ESTIMATE", points: des.lags.map((l) => ({ t: `${l.lag} sem`, v: l.r == null ? null : Math.round(l.r * 1000) / 1000 })) }
  ] : [];
  const profile: Series[] = rows.length ? [
    { id: "po", label: `${o.label} (média por SE)`, unit: o.unit, kind: "ESTIMATE", points: seasonalProfile(rows, p.outcome).map((x) => ({ t: `SE ${x.week}`, v: x.v == null ? null : Math.round(x.v * 10) / 10 })) },
    { id: "pc", label: `${c.label} (média por SE)`, unit: c.unit, kind: "ESTIMATE", points: seasonalProfile(rows, p.climateVar).map((x) => ({ t: `SE ${x.week}`, v: x.v == null ? null : Math.round(x.v * 10) / 10 })) }
  ] : [];
  const scatter = useMemo(() => {
    if (!raw) return [] as [number, number][];
    const [a, b] = pairs(raw.x.slice(0, raw.x.length - lag), raw.y.slice(lag));
    return a.map((v, i) => [v, b[i]] as [number, number]);
  }, [raw, lag]);

  const missingClimate = rows.filter((r) => r[p.climateVar] == null).length;
  const result = raw && des ? {
    params: p, generatedAt: new Date().toISOString(), weeks: raw.usedWeeks, years: raw.years,
    rawLags: raw.lags, deseasonalizedLags: des.lags, peakRaw: raw.peak, peakDeseasonalized: des.peak,
    descriptive: raw.stats, climatePoint: env?.data ? { lat: env.data.lat, lon: env.data.lon } : null, sources: env?.data?.urls
  } : null;

  function exportCsv() {
    const cols = [{ key: "se", label: "semana_epidemiologica" }, { key: "start", label: "inicio_semana" }, { key: "cases", label: "casos_notificados [OBSERVED]" },
      { key: "incidence", label: "incidencia_100mil [ESTIMATE]" }, { key: "population", label: "populacao" }, { key: "tmean", label: "t2m_media_C [MODEL]" },
      { key: "tmax", label: "t2m_max_media_C [MODEL]" }, { key: "tmin", label: "t2m_min_media_C [MODEL]" }, { key: "prec", label: "precip_semana_mm [MODEL]" }, { key: "rh", label: "umidade_rel_% [MODEL]" }];
    download(`astrae-clima-saude-${p.geocode}-${p.disease}-${p.from}-${p.to}.csv`, rowsToCsv(cols, rows, env?.provenance,
      ["Semanas com menos de 5 dias válidos de clima ficam vazias.", "Casos das semanas mais recentes ainda são revisados pela fonte."]), "text/csv");
  }

  return (
    <div>
      <PageHeader title="Clima e Saúde" subtitle="Eixo A — investigue associações entre condições climáticas e indicadores públicos de saúde, com dados agregados por município e semana epidemiológica." />

      <section className="bento tint tint-sand mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="eyebrow text-dim">Estudo piloto · em andamento</p>
            <h2 className="mt-1 text-lg font-medium">Temperatura e casos de dengue em Campinas (SP), 2015–2025</h2>
            <p className="mt-1 text-sm leading-relaxed text-dim">Pergunta: a temperatura semanal está associada ao número de casos notificados de dengue nas semanas seguintes (defasagem de 0 a 12 semanas)? Desenho ecológico de séries temporais, exploratório. Associação não implica causalidade.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn text-xs" onClick={() => { setP(PILOT); setMun({ id: PILOT.geocode, name: "Campinas", uf: "SP" }); }}>Usar configuração do piloto</button>
            <a href="#protocolo" className="btn text-xs">Ler o protocolo</a>
          </div>
        </div>
      </section>

      <section className="bento p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <MunicipalityPicker value={mun} onChange={(m) => { setMun(m); set({ geocode: m.id, place: `${m.name} (${m.uf})` }); }} />
          <div className="grid grid-cols-3 gap-2">
            <label className="block"><span className="label">Agravo</span>
              <select className="input mt-1" value={p.disease} onChange={(e) => set({ disease: e.target.value })}>{Object.entries(DISEASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="block"><span className="label">De</span><input type="number" className="input mt-1" min={2010} max={THIS_YEAR} value={p.from} onChange={(e) => set({ from: Number(e.target.value) })} /></label>
            <label className="block"><span className="label">Até</span><input type="number" className="input mt-1" min={2010} max={THIS_YEAR} value={p.to} onChange={(e) => set({ to: Number(e.target.value) })} /></label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="label">Variável climática</span>
              <select className="input mt-1" value={p.climateVar} onChange={(e) => set({ climateVar: e.target.value })}>{Object.entries(CLIMATE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
            <label className="block"><span className="label">Indicador de saúde</span>
              <select className="input mt-1" value={p.outcome} onChange={(e) => set({ outcome: e.target.value as AnalysisParams["outcome"] })}>{Object.entries(OUTCOME).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="label">Defasagem máx. (semanas)</span><input type="number" className="input mt-1" min={0} max={26} value={p.maxLag} onChange={(e) => set({ maxLag: Math.max(0, Math.min(26, Number(e.target.value))) })} /></label>
            <label className="block"><span className="label">Correlação</span>
              <select className="input mt-1" value={p.method} onChange={(e) => set({ method: e.target.value as AnalysisParams["method"] })}><option value="spearman">Spearman (postos)</option><option value="pearson">Pearson (linear)</option></select></label>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={p.logOutcome} onChange={(e) => set({ logOutcome: e.target.checked })} /> Usar log(1 + indicador)</label>
          <label className="flex items-center gap-2">Excluir as últimas <input type="number" className="input w-16 py-1" min={0} max={26} value={p.dropRecentWeeks} onChange={(e) => set({ dropRecentWeeks: Number(e.target.value) })} /> semanas (notificação incompleta)</label>
          <button className="btn-primary ml-auto" onClick={run} disabled={state === "loading" || p.to < p.from || p.to - p.from > 11}><Play size={14} /> Analisar</button>
        </div>
        {p.to - p.from > 11 && <p className="mt-2 text-xs text-warn">Período máximo: 12 anos por consulta.</p>}
      </section>

      {state === "loading" && <Loading label="Consultando InfoDengue, NASA POWER e IBGE… (pode levar até 1 minuto na primeira vez)" />}
      {state === "error" && <div className="mt-4"><ErrorState error={env?.error} onRetry={run} /></div>}
      {state === "done" && rows.length === 0 && <p className="mt-4 text-sm text-dim">A fonte não retornou semanas para este município e período.</p>}

      {raw && des && rows.length > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-12">
          <section className="bento p-5 lg:col-span-12">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg">{p.place} · {DISEASES[p.disease as keyof typeof DISEASES]} × {c.label.toLowerCase()}</h2>
              <div className="flex gap-2"><KindTag kind="OBSERVED" /><KindTag kind="MODEL" /></div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label="Semanas analisadas" value={`${raw.usedWeeks}`} note={`${raw.years} anos`} />
              <Stat label="Semanas sem clima" value={`${missingClimate}`} note="< 5 dias válidos ou fora da cobertura" />
              <Stat label="Ponto climático (centróide)" value={`${env!.data!.lat.toFixed(2)}, ${env!.data!.lon.toFixed(2)}`} note="grade POWER ~0,5° × 0,625°" />
              <Stat label="Maior |r| (séries brutas)" value={raw.peak?.r != null ? raw.peak.r.toFixed(2) : "—"} note={raw.peak ? `defasagem ${raw.peak.lag} sem · ${raw.peakStrength} · n=${raw.peak.n}` : ""} />
            </dl>
            {/* dois gráficos alinhados (mesmo eixo de tempo) em vez de um gráfico com dois eixos verticais */}
            <p className="mt-4 text-xs text-dim">{o.label} por semana</p>
            <SeriesChart series={series.slice(0, 1)} type="bar" height={210} provenance={env?.provenance} title={`saude-${p.geocode}`} />
            <p className="mt-3 text-xs text-dim">{c.label} por semana</p>
            <SeriesChart series={series.slice(1)} height={190} provenance={env?.provenance} title={`clima-${p.geocode}`} />
            <Provenance p={env?.provenance} />
          </section>

          <section className="bento p-5 lg:col-span-7">
            <h2 className="font-display text-lg">Correlação por defasagem</h2>
            <p className="mt-1 text-xs leading-relaxed text-dim">{p.method === "spearman" ? "Spearman" : "Pearson"} entre {c.label.toLowerCase()} na semana t e {yName.toLowerCase()} na semana t + k. A série “sem sazonalidade” subtrai a média de cada semana epidemiológica em todos os anos — isso reduz correlações que existem só porque calor e epidemias acontecem na mesma estação.</p>
            <div className="mt-3"><SeriesChart series={lagSeries} type="bar" height={260} title={`defasagens-${p.geocode}`} /></div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-xs">
                <thead><tr className="text-left text-faint"><th className="py-1 font-normal">k (sem)</th><th className="font-normal">r bruto</th><th className="font-normal">r sem sazonalidade</th><th className="font-normal">n</th><th className="font-normal">leitura (bruto)</th></tr></thead>
                <tbody>{raw.lags.map((l, i) => (
                  <tr key={l.lag} className={`cursor-pointer border-t border-line/60 ${l.lag === lag ? "bg-accent/10" : "hover:bg-panel2"}`} onClick={() => setLagPick(l.lag)}>
                    <td className="py-1 readout">{l.lag}</td><td className="readout">{l.r?.toFixed(3) ?? "—"}</td><td className="readout">{des.lags[i].r?.toFixed(3) ?? "—"}</td><td className="readout">{l.n}</td><td>{strength(l.r)}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </section>

          <section className="bento p-5 lg:col-span-5">
            <h2 className="font-display text-lg">Dispersão na defasagem de {lag} semana{lag === 1 ? "" : "s"}</h2>
            <p className="mt-1 text-xs text-dim">Cada ponto é uma semana. Clique numa linha da tabela para trocar a defasagem.</p>
            <ScatterChart points={scatter} xLabel={`${c.label} (${c.unit})`} yLabel={yName} />
          </section>

          <section className="bento p-5 lg:col-span-7">
            <h2 className="font-display text-lg">Perfil sazonal médio</h2>
            <p className="mt-1 text-xs text-dim">Média de cada semana epidemiológica em {raw.years} anos. Mostra quando, no ano, cada variável costuma subir.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <SeriesChart series={profile.slice(0, 1)} type="bar" height={220} title={`perfil-saude-${p.geocode}`} />
              <SeriesChart series={profile.slice(1)} height={220} title={`perfil-clima-${p.geocode}`} />
            </div>
          </section>

          <section className="bento p-5 lg:col-span-5">
            <h2 className="font-display text-lg">Estatísticas descritivas</h2>
            <DescTable rows={[[`${o.label} (${o.unit})`, raw.stats.outcome], [`${c.label} (${c.unit})`, raw.stats.climate]]} />
            <div className="mt-4 rounded-2xl border border-warn/40 bg-warn/5 p-3 text-xs leading-relaxed text-dim">
              <p className="font-medium text-ink">Como ler (texto gerado pela plataforma — revise antes de usar)</p>
              <p className="mt-1">No período, a maior correlação entre {c.label.toLowerCase()} e {o.label.toLowerCase()} foi {raw.peak?.r?.toFixed(2) ?? "—"} ({raw.peakStrength}) com defasagem de {raw.peak?.lag ?? "—"} semanas nas séries brutas, e {des.peak?.r?.toFixed(2) ?? "—"} ({des.peakStrength}) com defasagem de {des.peak?.lag ?? "—"} semanas após remover a sazonalidade média. Isto descreve associação em dados agregados; não mostra causa, não controla outros fatores (chuva, imunidade da população, sorotipos, ações de controle, mudanças na notificação) e não tem teste de significância válido para séries autocorrelacionadas.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn text-xs" onClick={exportCsv}><Download size={13} /> Dados semanais (CSV)</button>
              <button className="btn text-xs" onClick={() => download(`astrae-analise-${p.geocode}-${p.disease}.json`, JSON.stringify({ provenance: env?.provenance, result }, null, 2), "application/json")}><Download size={13} /> Análise (JSON)</button>
            </div>
            <div className="mt-3">
              <SaveActions item={{ externalId: `analysis:health:${p.geocode}:${p.disease}:${p.climateVar}:${p.outcome}:${p.from}-${p.to}`, title: `Análise — ${p.place}: ${DISEASES[p.disease as keyof typeof DISEASES]} × ${c.label} (${p.from}–${p.to})`,
                itemType: "chart", source: "ASTRAE", institution: "InfoDengue · NASA POWER · IBGE", kind: "ESTIMATE", originalUrl: "https://info.dengue.mat.br/services/api/doc",
                provenance: { dataset: env?.provenance?.dataset, period: `${p.from}–${p.to}`, location: env?.provenance?.location, methodology: env?.provenance?.methodology }, payload: { analysis: result } }} />
            </div>
          </section>
        </div>
      )}

      <section id="protocolo" className="mt-6 grid gap-4 lg:grid-cols-12">
        <div className="bento p-5 lg:col-span-7">
          <h2 className="font-display text-lg">Protocolo do estudo piloto</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <P t="Pergunta">Em Campinas (SP), entre 2015 e 2025, a temperatura semanal está associada aos casos notificados de dengue nas semanas seguintes?</P>
            <P t="Desenho">Ecológico de séries temporais, exploratório, unidade = município × semana epidemiológica.</P>
            <P t="Dados">Casos notificados semanais (InfoDengue, a partir do SINAN); temperatura, chuva e umidade diárias do NASA POWER (reanálise) no centróide da malha municipal do IBGE, agregadas nas mesmas semanas.</P>
            <P t="Método">Estatísticas descritivas; perfil sazonal; correlação de Spearman entre clima em t e log(1 + casos) em t + k, k = 0…12, nas séries brutas e sem a sazonalidade média; n efetivo informado em cada defasagem.</P>
            <P t="Por que dengue">Mortalidade e internações (SIM/SIH, DATASUS) não têm API pública: são arquivos por UF e ano que exigem processamento. A dengue tem série semanal municipal pronta e é uma doença sensível ao clima — serve para validar o método antes de incluir os desfechos de calor.</P>
            <P t="Próxima etapa">Mortalidade diária por todas as causas e por causas cardiorrespiratórias em Campinas (SIM), com o roteiro em <code className="font-mono text-xs">scripts/datasus/</code>, comparando semanas de calor extremo com as demais.</P>
          </dl>
        </div>
        <div className="bento p-5 lg:col-span-5">
          <h2 className="font-display text-lg">Indicadores de saúde na plataforma</h2>
          <ul className="mt-3 space-y-3 text-sm">
            <Src name="Arboviroses — dengue, chikungunya, zika" inst="InfoDengue (Fiocruz/FGV), a partir do SINAN" state="ok" note="Semanal por município, via API. Casos recentes são revisados." href="https://info.dengue.mat.br/services/api/doc" />
            <Src name="Mortalidade (SIM)" inst="DATASUS / Ministério da Saúde" state="pending" note="Arquivos DBC por UF e ano, sem API. Roteiro de agregação diária pronto, ainda não executado." href="https://pysus.readthedocs.io/en/latest/databases/SIM.html" />
            <Src name="Internações (SIH/SUS)" inst="DATASUS / Ministério da Saúde" state="pending" note="Arquivos mensais por UF; só internações financiadas pelo SUS." href="https://pysus.readthedocs.io/en/latest/databases/data-sources.html" />
          </ul>
          <Link href="/sources" className="mt-4 inline-flex items-center gap-1.5 text-xs text-accent hover:underline"><FlaskConical size={13} /> Biblioteca de dados: cobertura e limitações de cada fonte</Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="rounded-2xl bg-panel2/60 p-3"><dt className="text-[11px] text-dim">{label}</dt><dd className="readout mt-1 text-lg">{value}</dd>{note && <dd className="text-[11px] text-dim">{note}</dd>}</div>;
}
function P({ t, children }: { t: string; children: React.ReactNode }) {
  return <div><dt className="text-xs text-faint">{t}</dt><dd className="mt-0.5 leading-relaxed text-dim">{children}</dd></div>;
}
function Src({ name, inst, state, note, href }: { name: string; inst: string; state: "ok" | "pending"; note: string; href: string }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noreferrer" className="font-medium hover:text-accent">{name}</a>
      <span className={`ml-2 text-xs ${state === "ok" ? "text-ok" : "text-warn"}`}>● {state === "ok" ? "Conectado" : "Integração pendente"}</span>
      <p className="text-xs text-dim">{inst} — {note}</p>
    </li>
  );
}
function DescTable({ rows }: { rows: [string, Describe][] }) {
  const f = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
  const stats: [string, (d: Describe) => string][] = [
    ["n (semanas com valor)", (d) => String(d.n)], ["faltantes", (d) => String(d.missing)], ["média", (d) => f(d.mean)], ["desvio-padrão", (d) => f(d.sd)],
    ["mediana", (d) => f(d.median)], ["p25 – p75", (d) => `${f(d.p25)} – ${f(d.p75)}`], ["mín – máx", (d) => `${f(d.min)} – ${f(d.max)}`]
  ];
  return (
    <table className="mt-3 w-full text-xs">
      <thead><tr className="text-left text-faint"><th className="py-1 font-normal" />{rows.map(([l]) => <th key={l} className="px-2 font-normal">{l}</th>)}</tr></thead>
      <tbody>{stats.map(([label, get]) => (
        <tr key={label} className="border-t border-line/60"><td className="py-1.5 pr-2 text-dim">{label}</td>{rows.map(([l, d]) => <td key={l} className="readout px-2">{get(d)}</td>)}</tr>
      ))}</tbody>
    </table>
  );
}
