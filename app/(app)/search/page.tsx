"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookmarkPlus, ExternalLink, Search as SearchIcon } from "lucide-react";
import type { SearchResult } from "@/types/science";
import { KindTag } from "@/components/ui/KindTag";
import { Empty, ErrorState, Loading } from "@/components/ui/DataState";
import { SaveActions } from "@/components/research/SaveToResearch";
import { useUser } from "@/hooks/useUser";

interface Provider { provider: string; ok: boolean; count: number; error?: string; endpoint?: string }
interface Resp { status: string; query: string; translated: string; results: SearchResult[]; providers: Provider[]; accessedAt: string; error?: string }

type Filter = { key: string; label: string; test: (r: SearchResult) => boolean };
const FILTERS: Filter[] = [
  { key: "nasa", label: "NASA", test: (r) => r.source === "NASA" },
  { key: "br", label: "Instituições brasileiras", test: (r) => ["INPE", "INMET", "CEMADEN"].includes(r.source) || r.topics.includes("brazil") },
  { key: "article", label: "Artigos", test: (r) => r.type === "article" },
  { key: "dataset", label: "Datasets", test: (r) => r.type === "dataset" },
  { key: "image", label: "Imagens", test: (r) => r.type === "image" || r.type === "video" },
  { key: "map", label: "Mapas", test: (r) => r.type === "map" },
  { key: "timeseries", label: "Séries temporais", test: (r) => r.type === "timeseries" },
  { key: "document", label: "Documentos", test: (r) => r.type === "document" },
  { key: "climate", label: "Clima", test: (r) => r.topics.includes("climate") },
  { key: "mars", label: "Marte", test: (r) => r.topics.includes("mars") },
  { key: "earth", label: "Terra", test: (r) => r.topics.includes("earth") },
  { key: "atmosphere", label: "Atmosfera", test: (r) => r.topics.includes("atmosphere") },
  { key: "ocean", label: "Oceanos", test: (r) => r.topics.includes("ocean") }
];

const TYPE_LABEL: Record<string, string> = { dataset: "Dataset", article: "Artigo", image: "Imagem", map: "Mapa", timeseries: "Série temporal", document: "Documento", video: "Vídeo" };
const EXAMPLES = ["Marte atmosfera", "El Niño Brasil", "temperatura Pacífico 2026", "aerossóis Amazônia", "Mars atmospheric pressure"];

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") || "";
  const [input, setInput] = useState(q);
  const [resp, setResp] = useState<Resp | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(q ? "loading" : "idle");
  const [active, setActive] = useState<string[]>([]);
  const { sb, user } = useUser();
  const [savedSearch, setSavedSearch] = useState(false);

  useEffect(() => {
    setInput(q); setSavedSearch(false);
    if (!q) { setState("idle"); return; }
    setState("loading");
    fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((j: Resp) => { setResp(j); setState(j.status === "error" ? "error" : "done"); })
      .catch(() => setState("error"));
  }, [q]);

  const filtered = useMemo(() => {
    if (!resp) return [];
    const fs = FILTERS.filter((f) => active.includes(f.key));
    return resp.results.filter((r) => fs.every((f) => f.test(r)));
  }, [resp, active]);

  const submit = (v: string) => v.trim() && router.push(`/search?q=${encodeURIComponent(v.trim())}`);

  return (
    <div>
      <div className={`mx-auto max-w-3xl ${q ? "" : "pt-[12vh] text-center"}`}>
        {!q && <h1 className="font-display mb-6 text-3xl sm:text-4xl">O que você quer investigar?</h1>}
        <form onSubmit={(e) => { e.preventDefault(); submit(input); }} role="search" className="flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-2.5 focus-within:border-accent/70">
          <SearchIcon size={18} className="text-dim" />
          <input aria-label="Pesquisar dados científicos" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Marte temperatura atmosfera" autoFocus={!q} />
          <button className="btn-primary rounded-full px-4 py-1.5">Pesquisar</button>
        </form>
        {!q && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((e) => <button key={e} className="btn rounded-full text-xs" onClick={() => submit(e)}>{e}</button>)}
          </div>
        )}
      </div>

      {q && (
        <div className="mx-auto mt-5 max-w-5xl">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const on = active.includes(f.key);
              return (
                <button key={f.key} aria-pressed={on} onClick={() => setActive(on ? active.filter((x) => x !== f.key) : [...active, f.key])}
                  className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-accent bg-accent/10 text-ink" : "border-line text-dim hover:text-ink"}`}>{f.label}</button>
              );
            })}
          </div>

          {state === "loading" && <Loading label="Consultando NASA Earthdata, NTRS, Image Library e séries ao vivo…" />}
          {state === "error" && <div className="mt-4"><ErrorState error={resp?.error} onRetry={() => router.refresh()} /></div>}
          {state === "done" && resp && (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
                <span>{filtered.length} resultados{resp.translated !== resp.query.toLowerCase() && <> · consulta enviada às APIs da NASA: <span className="text-ink">“{resp.translated}”</span></>}</span>
                {resp.providers.map((p) => (
                  <span key={p.provider} title={p.error || p.endpoint} className="inline-flex items-center gap-1">
                    <span className={p.ok ? "text-ok" : "text-bad"}>{p.ok ? "●" : "○"}</span>{p.provider} ({p.count})
                  </span>
                ))}
                {user && (
                  <button className="ml-auto inline-flex items-center gap-1 hover:text-ink" disabled={savedSearch}
                    onClick={async () => { const { error } = await sb!.from("saved_searches").insert({ query: q, filters: { active } }); if (!error) setSavedSearch(true); }}>
                    <BookmarkPlus size={13} /> {savedSearch ? "Busca salva" : "Salvar esta busca"}
                  </button>
                )}
              </div>
              {filtered.length === 0 ? <Empty>Nenhum resultado com esses filtros. Remova um filtro ou reformule a busca.</Empty> : (
                <ol className="mt-4 space-y-3">
                  {filtered.map((r) => <ResultCard key={r.id} r={r} />)}
                </ol>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({ r }: { r: SearchResult }) {
  return (
    <li className="panel flex gap-4 p-4">
      {r.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.thumbnail} alt="" className="hidden h-24 w-24 shrink-0 rounded object-cover sm:block" loading="lazy" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-dim">
          <span className="text-ink">{r.source}</span><span>{r.institution}</span>
          <span className="rounded border border-line px-1.5">{TYPE_LABEL[r.type]}</span>
          <KindTag kind={r.kind} />
          {r.date && <span className="font-mono">{r.date}</span>}
        </div>
        <h3 className="mt-1.5 font-medium leading-snug">
          {r.openUrl ? <Link href={r.openUrl} className="hover:text-accent">{r.title}</Link> : <a href={r.originalUrl} target="_blank" rel="noreferrer" className="hover:text-accent">{r.title}</a>}
        </h3>
        {r.description && <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-dim">{r.description}</p>}
        {r.datasetName && <p className="mt-1.5 text-xs text-faint">Dataset: <span className="text-dim">{r.datasetName}</span></p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {r.openUrl
            ? <Link href={r.openUrl} className="btn text-xs">Abrir</Link>
            : <a href={r.originalUrl} target="_blank" rel="noreferrer" className="btn text-xs">Abrir</a>}
          <SaveActions item={{
            externalId: r.id, title: r.title, itemType: r.type, source: r.source, institution: r.institution,
            kind: r.kind, originalUrl: r.originalUrl, provenance: { dataset: r.datasetName || r.title, institution: r.institution, period: r.date }
          }} />
          <a href={r.originalUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-accent hover:underline">Link original <ExternalLink size={12} /></a>
        </div>
      </div>
    </li>
  );
}

export default function SearchPage() {
  return <Suspense><SearchInner /></Suspense>;
}
