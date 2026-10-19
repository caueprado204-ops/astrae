"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, BookOpenText, ExternalLink, GraduationCap, MessageSquareText, Search, Wrench } from "lucide-react";
import { PageHeader } from "@/components/shell/AppShell";
import { ReportList, VideoGrid } from "@/components/study/StudyLists";
import { TRACKS, type Track } from "@/services/study/tracks";

const TOPICS = ["El Nino", "hurricane", "Amazon", "climate change", "Earth science", "Mars", "Perseverance", "James Webb", "Jupiter", "Sun", "Moon", "International Space Station"];

export default function StudyPage() {
  const [tab, setTab] = useState<"tracks" | "videos">("tracks");
  const [track, setTrack] = useState<Track | null>(null);
  const [draft, setDraft] = useState("El Nino");
  const [query, setQuery] = useState("El Nino");

  return (
    <div>
      <PageHeader title="Study" subtitle="Videoaulas e conteúdos oficiais da NASA, NOAA e INPE para estudar um tema e levar o que aprender para as suas pesquisas. Assista com transcrição, anote com marcação de tempo e salve no caderno." />

      <div role="tablist" className="mb-5 flex gap-1 border-b border-line">
        {([["tracks", "Trilhas de estudo"], ["videos", "Videoteca NASA"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-accent text-ink" : "border-transparent text-dim hover:text-ink"}`}>{l}</button>
        ))}
      </div>

      {tab === "tracks" && !track && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TRACKS.map((t) => (
            <li key={t.id}>
              <button onClick={() => setTrack(t)} className="panel h-full w-full p-4 text-left transition hover:border-accent/60">
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-dim"><GraduationCap size={13} /> {t.area} · {t.level}</p>
                <h2 className="font-display mt-2 text-lg leading-snug">{t.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-dim">{t.summary}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === "tracks" && track && <TrackView t={track} onBack={() => setTrack(null)} />}

      {tab === "videos" && (
        <section>
          <form onSubmit={(e) => { e.preventDefault(); if (draft.trim()) setQuery(draft.trim()); }} className="flex max-w-xl gap-2">
            <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Tema em inglês, ex.: ocean temperature" aria-label="Buscar vídeos" />
            <button className="btn-primary"><Search size={14} /> Buscar</button>
          </form>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TOPICS.map((t) => <button key={t} aria-pressed={query === t} onClick={() => { setDraft(t); setQuery(t); }} className={`rounded-full border px-2.5 py-1 text-xs ${query === t ? "border-accent bg-accent/10" : "border-line text-dim hover:text-ink"}`}>{t}</button>)}
          </div>
          <p className="mt-2 text-[11px] text-faint">O acervo da NASA é catalogado em inglês; a maioria dos vídeos está em inglês e muitos têm legenda/transcrição oficial.</p>
          <div className="mt-4"><VideoGrid query={query} /></div>
        </section>
      )}
    </div>
  );
}

function TrackView({ t, onBack }: { t: Track; onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm text-dim hover:text-ink"><ArrowLeft size={14} /> Todas as trilhas</button>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <header>
            <p className="text-[11px] uppercase tracking-wide text-dim">{t.area} · {t.level}</p>
            <h2 className="font-display mt-1 text-2xl">{t.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dim">{t.summary}</p>
          </header>

          <section>
            <h3 className="font-display text-base">1 · Videoaulas</h3>
            <p className="mb-3 mt-1 text-xs text-dim">Vídeos oficiais da NASA sobre o tema. Abra um vídeo para assistir com transcrição e fazer anotações.</p>
            <VideoGrid query={t.videoQuery} limit={6} />
          </section>

          <section>
            <h3 className="font-display text-base">2 · Leituras técnicas (NASA NTRS)</h3>
            <p className="mb-3 mt-1 text-xs text-dim">Relatórios e artigos técnicos — use “Pesquisa” para guardá-los como referência em um projeto.</p>
            <ReportList query={t.reportQuery} />
          </section>
        </div>

        <aside className="space-y-4">
          <section className="panel p-4">
            <h3 className="text-sm font-medium">O que você vai aprender</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-dim">{t.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
          </section>

          <section className="panel p-4">
            <h3 className="flex items-center gap-2 text-sm font-medium"><BookOpenText size={14} /> Leituras oficiais</h3>
            <ul className="mt-2 space-y-2.5">
              {t.readings.map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-sm text-accent hover:underline">{r.title} <ExternalLink size={11} className="mt-1 shrink-0" /></a>
                  <p className="text-[11px] text-dim">{r.institution}{r.note ? ` — ${r.note}` : ""}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-4">
            <h3 className="flex items-center gap-2 text-sm font-medium"><Wrench size={14} /> Pratique com dados reais</h3>
            <div className="mt-2 flex flex-wrap gap-2">{t.tools.map((x) => <Link key={x.href} href={x.href} className="btn text-xs">{x.label}</Link>)}</div>
          </section>

          <section className="panel p-4">
            <h3 className="flex items-center gap-2 text-sm font-medium"><MessageSquareText size={14} /> Perguntas para investigar</h3>
            <p className="mt-1 text-[11px] text-dim">Abre o ASTRAE AI com a pergunta pronta; a resposta cita as fontes consultadas.</p>
            <ul className="mt-2 space-y-1.5">
              {t.questions.map((q) => <li key={q}><Link href={`/ai?q=${encodeURIComponent(q)}`} className="block rounded border border-line px-2.5 py-1.5 text-sm text-dim hover:border-accent/60 hover:text-ink">{q}</Link></li>)}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
