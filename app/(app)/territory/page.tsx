"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, Play, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/shell/AppShell";
import { MunicipalityPicker } from "@/components/analysis/MunicipalityPicker";
import { TerritoryMap, RAMP, type MapDatum } from "@/components/territory/TerritoryMap";
import { Provenance } from "@/components/ui/Provenance";
import { KindTag } from "@/components/ui/KindTag";
import { ErrorState, Loading } from "@/components/ui/DataState";
import { SaveActions } from "@/components/research/SaveToResearch";
import { minMax, quantile } from "@/lib/stats";
import { download, rowsToCsv } from "@/utils/export";
import type { ApiEnvelope, DataKind } from "@/types/science";

interface Indicator { id: string; label: string; unit: string; group: "clima" | "social" | "saude"; kind: DataKind; source: string; year: string; note: string; higherIsWorse: boolean }
interface MunInd { id: string; name: string; lat: number | null; lon: number | null; areaKm2: number | null; powerCell: string | null; values: Record<string, number | null>; errors: string[] }
interface TerritoryData { municipalities: MunInd[]; geojson: { type: "FeatureCollection"; features: { type: "Feature"; properties: Record<string, unknown>; geometry: unknown }[] }; indicators: Indicator[] }
interface Located { municipality: { id: string; name: string; uf: string }; region: { id: string; name: string; municipalities: { id: string; name: string }[] } | null }

const GROUP_LABEL = { clima: "Exposição climática", social: "Características sociais e demográficas", saude: "Saúde" };
const fmt = (v: number | null | undefined, unit = "") => v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: v > 100 ? 0 : 1 })}${unit === "%" ? "%" : ""}`;

export default function TerritoryPage() {
  const [ref, setRef] = useState({ id: "3509502", name: "Campinas", uf: "SP" });
  const [located, setLocated] = useState<Located | null>(null);
  const [selected, setSelected] = useState<{ id: string; name: string }[]>([]);
  const [env, setEnv] = useState<ApiEnvelope<TerritoryData> | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [mapInd, setMapInd] = useState("dengue_inc");
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [direction, setDirection] = useState<Record<string, boolean>>({}); // true = maior valor → mais prioridade
  const [sortKey, setSortKey] = useState<string>("name");

  // município de referência → municípios da mesma Região Geográfica Imediata (IBGE)
  useEffect(() => {
    let alive = true;
    setLocated(null);
    fetch(`/api/ibge/municipio?id=${ref.id}`).then((r) => r.json()).then((j: ApiEnvelope<Located>) => {
      if (!alive || !j.data) return;
      setLocated(j.data);
      const list = j.data.region?.municipalities?.length ? j.data.region.municipalities : [{ id: ref.id, name: ref.name }];
      setSelected(list.slice(0, 25));
    }).catch(() => setSelected([{ id: ref.id, name: ref.name }]));
    return () => { alive = false; };
  }, [ref.id, ref.name]);

  async function run() {
    setState("loading");
    try {
      const r = await fetch(`/api/territory?ids=${selected.map((m) => m.id).join(",")}`);
      const j = (await r.json()) as ApiEnvelope<TerritoryData>;
      setEnv(j); setState(j.status === "error" ? "error" : "done");
      if (j.data) {
        setWeights((w) => Object.keys(w).length ? w : { tmax_clim: 1, elderly: 1, density: 1, gdp_pc: 1 });
        setDirection((d) => Object.keys(d).length ? d : Object.fromEntries(j.data!.indicators.map((i) => [i.id, i.higherIsWorse])));
      }
    } catch (e) { setEnv({ status: "error", data: null, provenance: null, error: String(e) }); setState("error"); }
  }

  const data = env?.data;
  const inds = data?.indicators || [];
  const muns = data?.municipalities || [];

  // índice exploratório: média ponderada de indicadores normalizados (min–max no conjunto selecionado)
  const index = useMemo(() => {
    const active = inds.filter((i) => (weights[i.id] || 0) > 0);
    if (!active.length || !muns.length) return new Map<string, number | null>();
    const norm = Object.fromEntries(active.map((i) => [i.id, minMax(muns.map((m) => m.values[i.id]), !direction[i.id])]));
    const totalW = active.reduce((s, i) => s + weights[i.id], 0);
    return new Map(muns.map((m, k) => {
      const parts = active.map((i) => norm[i.id][k]);
      return [m.id, parts.some((v) => v == null) ? null : active.reduce((s, i, j) => s + (parts[j] as number) * weights[i.id], 0) / totalW];
    }));
  }, [inds, muns, weights, direction]);

  const mapValues = muns.map((m) => mapInd === "index" ? index.get(m.id) ?? null : m.values[mapInd]);
  const sorted = mapValues.filter((v): v is number => v != null).sort((a, b) => a - b);
  const breaks = [0.2, 0.4, 0.6, 0.8].map((q) => quantile(sorted, q) as number);
  const cls = (v: number | null) => v == null || !sorted.length ? null : breaks.filter((b) => v > b).length;
  const indMeta = inds.find((i) => i.id === mapInd);
  const mapData: MapDatum[] = muns.map((m, k) => ({ id: m.id, name: m.name, value: mapValues[k], cls: cls(mapValues[k]), label: mapInd === "index" ? `Índice exploratório: ${mapValues[k]?.toFixed(2) ?? "sem dado"}` : `${indMeta?.label}: ${fmt(mapValues[k], indMeta?.unit)} ${indMeta?.unit !== "%" ? indMeta?.unit ?? "" : ""}` }));
  const cells = new Set(muns.map((m) => m.powerCell).filter(Boolean)).size;

  const rows = [...muns].sort((a, b) => sortKey === "name" ? a.name.localeCompare(b.name, "pt-BR") : sortKey === "index" ? (index.get(b.id) ?? -1) - (index.get(a.id) ?? -1) : (b.values[sortKey] ?? -Infinity) - (a.values[sortKey] ?? -Infinity));
  const method = `Índice exploratório = média ponderada de indicadores normalizados por min–max dentro dos ${muns.length} municípios selecionados. Pesos: ${inds.filter((i) => weights[i.id] > 0).map((i) => `${i.label} ×${weights[i.id]} (${direction[i.id] ? "maior → mais prioridade" : "menor → mais prioridade"})`).join("; ") || "nenhum"}. Município sem algum indicador fica sem índice.`;

  function exportCsv() {
    const cols = [{ key: "id", label: "codigo_ibge" }, { key: "name", label: "municipio" }, ...inds.map((i) => ({ key: i.id, label: `${i.label} (${i.unit}) [${i.kind}; ${i.source}; ${i.year}]` })), { key: "index", label: "indice_exploratorio [ESTIMATE]" }, { key: "powerCell", label: "celula_grade_POWER" }];
    const r = muns.map((m) => ({ id: m.id, name: m.name, ...m.values, index: index.get(m.id)?.toFixed(4) ?? null, powerCell: m.powerCell }));
    download(`astrae-territorio-${ref.id}.csv`, rowsToCsv(cols, r, env?.provenance, [method, "Índice exploratório não é índice oficial de vulnerabilidade."]), "text/csv");
  }
  function exportGeo() {
    const by = new Map(muns.map((m) => [m.id, m]));
    const fc = { ...data!.geojson, features: data!.geojson.features.map((f) => { const m = by.get(String(f.properties.codarea)); return { ...f, properties: { ...f.properties, name: m?.name, ...m?.values, indice_exploratorio: m ? index.get(m.id) : null } }; }), metadata: { provenance: env?.provenance, method } };
    download(`astrae-territorio-${ref.id}.geojson`, JSON.stringify(fc), "application/geo+json");
  }

  return (
    <div>
      <PageHeader title="Território" subtitle="Eixo B — compare a exposição climática e as características sociais e de saúde entre municípios, e identifique, de forma exploratória e transparente, onde investigar primeiro." />

      <section className="bento p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
          <div>
            <MunicipalityPicker label="Município de referência" value={ref} onChange={(m) => setRef(m)} />
            <p className="mt-2 text-xs text-dim">{located?.region ? <>Pré-seleção: Região Geográfica Imediata de <span className="text-ink">{located.region.name}</span> (IBGE), {located.region.municipalities.length} municípios{located.region.municipalities.length > 25 ? " — limitado aos 25 primeiros" : ""}.</> : "Buscando a região imediata no IBGE…"}</p>
          </div>
          <div>
            <p className="label">Municípios selecionados ({selected.length}/25)</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {selected.map((m) => <span key={m.id} className="chip">{m.name}<button aria-label={`Remover ${m.name}`} onClick={() => setSelected(selected.filter((x) => x.id !== m.id))}><X size={12} /></button></span>)}
              <AddMunicipality onAdd={(m) => selected.length < 25 && !selected.some((x) => x.id === m.id) && setSelected([...selected, m])} />
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end"><button className="btn-primary" onClick={run} disabled={!selected.length || state === "loading"}><Play size={14} /> Calcular indicadores</button></div>
      </section>

      {state === "loading" && <Loading label={`Consultando IBGE (malhas e SIDRA), NASA POWER e InfoDengue para ${selected.length} municípios…`} />}
      {state === "error" && <div className="mt-4"><ErrorState error={env?.error} onRetry={run} /></div>}

      {data && state === "done" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-12">
          <section className="bento p-5 lg:col-span-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="block min-w-[260px]"><span className="label">Indicador no mapa</span>
                <select className="input mt-1" value={mapInd} onChange={(e) => setMapInd(e.target.value)}>
                  {inds.map((i) => <option key={i.id} value={i.id}>{i.label} ({i.unit})</option>)}
                  <option value="index">Índice exploratório de prioridade</option>
                </select>
              </label>
              {indMeta && <span className="flex items-center gap-2 text-xs text-dim"><KindTag kind={indMeta.kind} /> {indMeta.source} · {indMeta.year}</span>}
            </div>
            <div className="mt-3"><TerritoryMap geojson={data.geojson} data={mapData} /></div>
            <Legend breaks={sorted.length ? [sorted[0], ...breaks, sorted.at(-1)!] : []} unit={mapInd === "index" ? "" : indMeta?.unit || ""} />
            {indMeta?.group === "clima" && cells < muns.length && (
              <p className="mt-2 rounded-xl border border-warn/40 bg-warn/5 p-2.5 text-xs text-dim">Os {muns.length} municípios caem em apenas {cells} célula{cells === 1 ? "" : "s"} da grade do NASA POWER. Municípios na mesma célula recebem o mesmo valor climático: diferenças pequenas entre eles não são informativas nesta escala.</p>
            )}
            {indMeta && <p className="mt-2 text-xs text-dim">{indMeta.note}</p>}
          </section>

          <section className="bento p-5 lg:col-span-4">
            <h2 className="font-display text-lg">Índice exploratório de prioridade</h2>
            <p className="mt-1 text-xs leading-relaxed text-dim">Não é um índice oficial de vulnerabilidade. Ele combina os indicadores escolhidos por você para apontar onde vale investigar primeiro. Mude pesos e direções e veja como a ordem muda.</p>
            <ul className="mt-3 space-y-2">
              {inds.map((i) => (
                <li key={i.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-xs">
                  <span>{i.label}</span>
                  <select aria-label={`Peso de ${i.label}`} className="input w-16 py-1 text-xs" value={weights[i.id] || 0} onChange={(e) => setWeights({ ...weights, [i.id]: Number(e.target.value) })}>{[0, 1, 2, 3].map((w) => <option key={w} value={w}>×{w}</option>)}</select>
                  <button className="chip" disabled={!weights[i.id]} onClick={() => setDirection({ ...direction, [i.id]: !direction[i.id] })} title="Direção">{direction[i.id] ? "maior ↑" : "menor ↑"}</button>
                </li>
              ))}
            </ul>
            <ol className="mt-4 space-y-1 text-sm">
              {[...muns].filter((m) => index.get(m.id) != null).sort((a, b) => index.get(b.id)! - index.get(a.id)!).slice(0, 8).map((m, k) => (
                <li key={m.id} className="flex items-center justify-between gap-2"><span><span className="readout mr-2 text-faint">{k + 1}</span>{m.name}</span><span className="readout text-dim">{index.get(m.id)!.toFixed(2)}</span></li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] leading-relaxed text-faint">{method}</p>
          </section>

          <section className="bento p-5 lg:col-span-12">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg">Indicadores por município</h2>
              <div className="flex gap-2">
                <button className="btn text-xs" onClick={exportCsv}><Download size={13} /> CSV</button>
                <button className="btn text-xs" onClick={exportGeo}><Download size={13} /> GeoJSON</button>
              </div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[900px] text-xs">
                <thead>
                  <tr className="text-left align-bottom text-faint">
                    <th className="py-2 pr-3 font-normal"><button onClick={() => setSortKey("name")}>Município</button></th>
                    {inds.map((i) => <th key={i.id} className="pr-3 font-normal"><button className="text-left" onClick={() => setSortKey(i.id)} title={`${i.source} · ${i.year}`}>{i.label}<br /><span className="text-[10px]">{i.unit} · {GROUP_LABEL[i.group]}</span></button></th>)}
                    <th className="font-normal"><button onClick={() => setSortKey("index")}>Índice</button></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id} className="border-t border-line/60">
                      <td className="py-1.5 pr-3">{m.name}{m.errors.length > 0 && <span className="ml-1 text-warn" title={m.errors.join("\n")}>⚠</span>}</td>
                      {inds.map((i) => <td key={i.id} className="readout pr-3">{fmt(m.values[i.id], i.unit)}</td>)}
                      <td className="readout">{index.get(m.id)?.toFixed(2) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-faint">⚠ = algum indicador não pôde ser obtido (passe o cursor para ver o motivo). Clique no cabeçalho para ordenar.</p>
            <div className="mt-3">
              <SaveActions item={{ externalId: `analysis:territory:${selected.map((m) => m.id).join("-").slice(0, 120)}`, title: `Território — ${located?.region?.name || ref.name}: ${muns.length} municípios`, itemType: "map", source: "ASTRAE", institution: "IBGE · NASA POWER · InfoDengue", kind: "ESTIMATE",
                originalUrl: "https://apisidra.ibge.gov.br/", provenance: { dataset: "Indicadores municipais", methodology: method }, payload: { municipalities: muns.map((m) => ({ id: m.id, name: m.name, values: m.values, index: index.get(m.id) ?? null })), weights, direction } }} />
            </div>
            <Provenance p={env?.provenance} />
          </section>
        </div>
      )}

      <section className="bento mt-6 p-5 text-sm leading-relaxed text-dim">
        <h2 className="font-display text-lg text-ink">Método e limites deste eixo</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Nenhum município é classificado como “vulnerável” pela plataforma. O índice é exploratório, relativo ao conjunto escolhido e definido pelos pesos que você vê.</li>
          <li>Clima vem de reanálise em grade de ~50 km (NASA POWER): serve para comparar regiões, não bairros nem municípios vizinhos.</li>
          <li>Dados sociais vêm do Censo 2022 e do PIB dos Municípios (IBGE). Proporção de idosos e PIB per capita são calculados pela ASTRAE a partir das tabelas oficiais.</li>
          <li>Incidência de dengue usa casos notificados recentes, que ainda são revisados pela vigilância.</li>
          <li>Próximas camadas planejadas: setores censitários (renda, saneamento), focos de queimadas do INPE e estações do INMET.</li>
        </ul>
      </section>
    </div>
  );
}

function Legend({ breaks, unit }: { breaks: number[]; unit: string }) {
  if (breaks.length < 2) return null;
  const dark = typeof document !== "undefined" && document.documentElement.dataset.theme !== "light";
  const ramp = dark ? RAMP.dark : RAMP.light;
  const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: v > 100 ? 0 : 2 });
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-dim" aria-label="Legenda (quintis)">
      <span>Quintis{unit ? ` (${unit})` : ""}:</span>
      {ramp.map((c, i) => <span key={c} className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded-sm" style={{ background: c }} />{f(breaks[i])}–{f(breaks[i + 1])}</span>)}
      <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded-sm bg-line" />sem dado</span>
    </div>
  );
}

function AddMunicipality({ onAdd }: { onAdd: (m: { id: string; name: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ id: "", name: "", uf: "SP" });
  if (!open) return <button className="chip" onClick={() => setOpen(true)}><Plus size={12} /> Adicionar</button>;
  return (
    <div className="flex w-full items-end gap-2 sm:w-auto">
      <div className="min-w-[280px]"><MunicipalityPicker value={v} onChange={(m) => setV(m)} /></div>
      <button className="btn text-xs" disabled={!v.id} onClick={() => { onAdd({ id: v.id, name: v.name }); setOpen(false); }}>Incluir</button>
    </div>
  );
}
