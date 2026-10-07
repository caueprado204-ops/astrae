"use client";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, ExternalLink, Loader2, Send } from "lucide-react";
import { PageHeader } from "@/components/shell/AppShell";
import { KindTag } from "@/components/ui/KindTag";
import { ErrorState } from "@/components/ui/DataState";
import { useUser } from "@/hooks/useUser";
import { uid } from "@/components/notebook/blocks";
import type { DataKind } from "@/types/science";

interface Source { id: string; title: string; institution: string; dataset: string; kind: DataKind; url: string; accessedAt: string; cited: boolean }
interface Trace { tool: string; input: unknown; ok: boolean; error?: string; ms: number }
interface Answer { answer: string; sources: Source[]; trace: Trace[]; model: string; removedCitations: string[]; answeredAt: string }
type Turn = { role: "user"; content: string } | { role: "assistant"; content: string; meta: Answer };

const EXAMPLES = [
  "Como o El Niño altera a precipitação no Brasil?",
  "Compare a atmosfera de Marte e da Terra.",
  "Mostre os dados de temperatura de Marte.",
  "Quais foram as principais anomalias climáticas?",
  "Qual é o status atual do ENSO e o que diz o último ONI?"
];

const TOOL_LABEL: Record<string, string> = {
  get_enso_status: "Status ENSO (NOAA CPC)", get_oni_series: "Série ONI (NOAA CPC)", get_nino_weekly: "Niño semanal (NOAA CPC)",
  get_mars_weather: "Clima em Marte (REMS)", get_rover_status: "Status do rover (NASA/JPL)", get_brazil_capitals_now: "Capitais agora (CPTEC)",
  get_cptec_forecast: "Previsão CPTEC", get_power_timeseries: "Série NASA POWER", search_nasa_datasets: "Datasets NASA Earthdata", search_nasa_reports: "Relatórios NASA NTRS"
};

/** Renderização mínima e segura (sem HTML): parágrafos, listas, **negrito** e citações [S#]. */
function RichText({ text, sources }: { text: string; sources: Source[] }) {
  const byId = Object.fromEntries(sources.map((s) => [s.id, s]));
  const inline = (s: string, k: string) => s.split(/(\*\*[^*]+\*\*|\[S\d+(?:\s*,\s*S\d+)*\])/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`${k}${i}`} className="font-medium text-ink">{part.slice(2, -2)}</strong>;
    const m = part.match(/^\[(S\d+(?:\s*,\s*S\d+)*)\]$/);
    if (m) return (
      <sup key={`${k}${i}`} className="ml-0.5">
        {m[1].split(/\s*,\s*/).map((id, j) => byId[id] ? (
          <a key={id} href={byId[id].url} target="_blank" rel="noreferrer" title={`${byId[id].institution} — ${byId[id].dataset}`} className="font-mono text-[10.5px] text-accent hover:underline">{j > 0 ? "," : ""}{id}</a>
        ) : null)}
      </sup>
    );
    return <Fragment key={`${k}${i}`}>{part}</Fragment>;
  });
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-ink/90">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          const ordered = /^\s*\d+\./.test(lines[0]);
          const items = lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""), `${i}-${j}-`)}</li>);
          return ordered ? <ol key={i} className="list-decimal space-y-1 pl-5">{items}</ol> : <ul key={i} className="list-disc space-y-1 pl-5">{items}</ul>;
        }
        if (/^#{1,3}\s/.test(b)) return <h3 key={i} className="font-display text-base text-ink">{b.replace(/^#{1,3}\s/, "")}</h3>;
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, `${i}-${j}-`)}</Fragment>)}</p>;
      })}
    </div>
  );
}

export default function AstraeAI() {
  const [cfg, setCfg] = useState<{ configured: boolean; provider: string | null; model: string | null } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { sb, user, configured: dbConfigured } = useUser();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch("/api/ai").then((r) => r.json()).then(setCfg).catch(() => setCfg({ configured: false, provider: null, model: null })); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, busy]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: question }];
    setTurns(next); setInput(""); setBusy(true); setError(null);
    try {
      const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.map((t) => ({ role: t.role, content: t.content })) }) });
      const j = await r.json();
      if (j.status !== "ok") throw new Error(j.error || "Falha na consulta");
      setTurns([...next, { role: "assistant", content: j.answer, meta: j }]);
    } catch (e) {
      setError((e as Error).message);
      setTurns(next.slice(0, -1)); setInput(question);
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="ASTRAE AI" subtitle="Pergunte em linguagem natural. O assistente consulta as fontes oficiais da plataforma, responde só com o que encontrou e cita cada dado." />

      {cfg && !cfg.configured && (
        <div className="panel p-5 text-sm">
          <p className="text-warn">○ ASTRAE AI ainda não configurado</p>
          <p className="mt-2 text-dim">Opção gratuita: crie uma chave em <span className="text-ink">aistudio.google.com</span> e adicione <code className="font-mono text-ink">GEMINI_API_KEY</code> nas variáveis de ambiente do servidor (na Vercel: Settings → Environment Variables, depois Redeploy).</p>
          <p className="mt-2 text-dim">Opção paga: <code className="font-mono text-ink">ANTHROPIC_API_KEY</code> (console.anthropic.com).</p>
        </div>
      )}

      {cfg?.configured && (
        <>
          {turns.length === 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {EXAMPLES.map((e) => <button key={e} className="btn rounded-full text-left text-xs" onClick={() => ask(e)}>{e}</button>)}
            </div>
          )}

          <div className="space-y-6">
            {turns.map((t, i) => t.role === "user" ? (
              <div key={i} className="flex justify-end"><p className="max-w-[85%] rounded-lg bg-panel2 px-4 py-2.5 text-sm">{t.content}</p></div>
            ) : (
              <AnswerCard key={i} question={(turns[i - 1] as Turn)?.content || ""} a={t.meta} canSave={Boolean(dbConfigured && user)} onSave={async () => {
                const cited = t.meta.sources.filter((s) => s.cited);
                const blocks = [
                  { id: uid(), type: "heading", text: (turns[i - 1] as Turn)?.content || "Pergunta" },
                  { id: uid(), type: "text", text: t.content.replace(/\*\*/g, "") },
                  { id: uid(), type: "subheading", text: "Fontes consultadas" },
                  ...cited.map((s) => ({ id: uid(), type: "reference", url: s.url, text: `[${s.id}] ${s.institution}. ${s.dataset} — ${s.title}. Disponível em: ${s.url}. Acesso em: ${new Date(s.accessedAt).toLocaleDateString("pt-BR")}.` })),
                  { id: uid(), type: "text", text: `Gerado pelo ASTRAE AI (${t.meta.model}) em ${new Date(t.meta.answeredAt).toLocaleString("pt-BR")} a partir das fontes acima.` }
                ];
                const { data } = await sb!.from("notes").insert({ title: `ASTRAE AI — ${((turns[i - 1] as Turn)?.content || "").slice(0, 60)}`, blocks }).select("id").single();
                return data?.id as string | undefined;
              }} />
            ))}
            {busy && <p className="flex items-center gap-2 text-sm text-dim"><Loader2 size={15} className="animate-spin" /> Consultando fontes oficiais e analisando…</p>}
            {error && <ErrorState error={error} />}
            <div ref={end} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="sticky bottom-3 mt-6 flex items-end gap-2 rounded-xl border border-line bg-panel p-2 focus-within:border-accent/70">
            <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ex.: Como estava a chuva em Porto Alegre nos anos de El Niño forte?"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
              className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-faint" aria-label="Pergunta" />
            <button className="btn-primary" disabled={busy || !input.trim()} aria-label="Enviar pergunta"><Send size={15} /></button>
          </form>
          <p className="mt-2 text-center text-[11px] text-faint">Respostas geradas por IA a partir dos dados consultados. Confira sempre a fonte original antes de usar em trabalhos.{cfg.model ? ` Modelo: ${cfg.model}${cfg.provider === "gemini" ? " (Google)" : " (Anthropic)"}.` : ""}</p>
        </>
      )}
    </div>
  );
}

function AnswerCard({ a, onSave, canSave }: { question: string; a: Answer; onSave: () => Promise<string | undefined>; canSave: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const cited = a.sources.filter((s) => s.cited);
  const shown = showAll ? a.sources : cited;
  return (
    <article className="panel p-5">
      <RichText text={a.answer} sources={a.sources} />
      {a.removedCitations.length > 0 && <p className="mt-3 text-xs text-warn">Citações removidas por não corresponderem a fontes consultadas: {a.removedCitations.join(", ")}.</p>}

      <div className="mt-5 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-dim">
          <span>{cited.length} fontes citadas · {a.sources.length} consultadas</span>
          {a.sources.length > cited.length && <button className="hover:text-ink" onClick={() => setShowAll(!showAll)}>{showAll ? "Mostrar só as citadas" : "Mostrar todas"}</button>}
          <span className="ml-auto flex items-center gap-2">
            {canSave && (noteId
              ? <Link href={`/notebook?note=${noteId}`} className="text-ok hover:underline">Salvo no caderno — abrir</Link>
              : <button className="btn text-xs" onClick={async () => setNoteId((await onSave()) || null)}><BookOpen size={13} /> Salvar no caderno</button>)}
          </span>
        </div>
        {shown.length > 0 && (
          <ol className="mt-3 space-y-2">
            {shown.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-xs">
                <span className="readout w-7 shrink-0 text-accent">{s.id}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-ink">{s.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-dim"><KindTag kind={s.kind} /><span>{s.institution}</span><span>Dataset: {s.dataset}</span><span>Acesso: {new Date(s.accessedAt).toLocaleString("pt-BR")}</span></p>
                </div>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-accent" aria-label="View original source"><ExternalLink size={13} /></a>
              </li>
            ))}
          </ol>
        )}
        <details className="mt-3 text-xs text-dim">
          <summary className="flex cursor-pointer list-none items-center gap-1 hover:text-ink"><ChevronDown size={13} /> Consultas realizadas ({a.trace.length})</summary>
          <ul className="mt-2 space-y-1">
            {a.trace.map((t, i) => (
              <li key={i} className="font-mono text-[11px]">
                <span className={t.ok ? "text-ok" : "text-bad"}>{t.ok ? "●" : "○"}</span> {TOOL_LABEL[t.tool] || t.tool} <span className="text-faint">{JSON.stringify(t.input)} · {t.ms} ms</span>{t.error && <span className="text-bad"> — {t.error}</span>}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </article>
  );
}
