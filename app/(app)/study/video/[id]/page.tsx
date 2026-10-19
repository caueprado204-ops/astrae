"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookmarkCheck, Clock, ExternalLink, Loader2, MessageSquareText, NotebookPen, Search } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useUser } from "@/hooks/useUser";
import { Provenance } from "@/components/ui/Provenance";
import { Empty, ErrorState, Loading } from "@/components/ui/DataState";
import { SaveActions } from "@/components/research/SaveToResearch";

interface Cue { start: number; end: number; text: string }
interface Lesson {
  item: { nasaId: string; title: string; description: string; center?: string; dateCreated?: string; keywords: string[]; thumb?: string; detailsUrl: string; photographer?: string };
  files: { label: string; url: string }[];
  captionsUrl?: string;
  cues: Cue[];
}

const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(x).padStart(2, "0")}`;
};
const parseMark = (m: string) => m.split(":").map(Number).reduce((a, b) => a * 60 + b, 0);
const toVtt = (cues: Cue[]) => {
  const t = (s: number) => new Date(s * 1000).toISOString().slice(11, 23);
  return "WEBVTT\n\n" + cues.map((c) => `${t(c.start)} --> ${t(c.end)}\n${c.text}`).join("\n\n");
};
const uid = () => Math.random().toString(36).slice(2, 10);
const draftKey = (id: string) => `astrae:study-notes:${id}`;

export default function VideoLessonPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const { env, data, state, retry } = useApi<Lesson>(`/api/study/video?id=${encodeURIComponent(id)}`);
  const { user, configured, sb } = useUser();
  const video = useRef<HTMLVideoElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [quality, setQuality] = useState<string>("");
  const [now, setNow] = useState(0);
  const [filter, setFilter] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // rascunho das anotações fica neste navegador até ser salvo no caderno
  useEffect(() => { try { setNotes(localStorage.getItem(draftKey(id)) || ""); } catch { /* armazenamento indisponível */ } }, [id]);
  const updateNotes = (n: string) => {
    setNotes(n);
    try { if (n) localStorage.setItem(draftKey(id), n); else localStorage.removeItem(draftKey(id)); } catch { /* idem */ }
  };

  const src = useMemo(() => {
    if (!data?.files.length) return "";
    return (data.files.find((f) => f.label === quality) || data.files.find((f) => f.label === "medium") || data.files.find((f) => f.label === "small") || data.files[0]).url;
  }, [data, quality]);
  const vttUrl = useMemo(() => (data?.cues.length ? URL.createObjectURL(new Blob([toVtt(data.cues)], { type: "text/vtt" })) : ""), [data]);
  useEffect(() => () => { if (vttUrl) URL.revokeObjectURL(vttUrl); }, [vttUrl]);

  // ao trocar a qualidade, retoma do mesmo ponto
  const resumeAt = useRef(0);
  useEffect(() => { const v = video.current; if (v && resumeAt.current) { v.currentTime = resumeAt.current; resumeAt.current = 0; } }, [src]);

  const seek = (t: number) => { const v = video.current; if (!v) return; v.currentTime = t; v.play().catch(() => {}); };
  const active = data?.cues.findIndex((c) => now >= c.start && now < c.end) ?? -1;
  const shown = (data?.cues || []).map((c, i) => ({ c, i })).filter(({ c }) => !filter || c.text.toLowerCase().includes(filter.toLowerCase()));

  function insertMark(extra = "") {
    const ta = notesRef.current;
    const stamp = `[${fmt(video.current?.currentTime || 0)}] ${extra}`;
    const pos = ta?.selectionStart ?? notes.length;
    const before = notes.slice(0, pos), after = notes.slice(pos);
    const sep = before && !before.endsWith("\n") ? "\n" : "";
    const next = `${before}${sep}${stamp}${after}`;
    updateNotes(next);
    requestAnimationFrame(() => { if (ta) { ta.focus(); const p = (before + sep + stamp).length; ta.setSelectionRange(p, p); } });
  }

  const marks = useMemo(() => Array.from(notes.matchAll(/\[(\d{1,2}(?::\d{2}){1,2})\]\s*([^\n]*)/g)).map((m) => ({ t: parseMark(m[1]), label: m[1], text: m[2] })), [notes]);

  async function saveToNotebook() {
    if (!data) return;
    if (!sb || !user) { setMsg(configured ? "Entre na sua conta para salvar no caderno." : "Configure o Supabase para usar o caderno."); return; }
    setSaving(true); setMsg(null);
    const it = data.item;
    const paragraphs = notes.split(/\n{2,}|\n(?=\[\d)/).map((p) => p.trim()).filter(Boolean);
    const blocks = [
      { id: uid(), type: "heading", text: `Videoaula — ${it.title}` },
      { id: uid(), type: "link", url: it.detailsUrl, label: "Assistir na NASA Image and Video Library" },
      { id: uid(), type: "subheading", text: "Anotações" },
      ...(paragraphs.length ? paragraphs.map((p) => ({ id: uid(), type: "text", text: p })) : [{ id: uid(), type: "text", text: "" }]),
      { id: uid(), type: "subheading", text: "Referência" },
      { id: uid(), type: "reference", url: it.detailsUrl, text: `NASA${it.center ? ` ${it.center}` : ""}. ${it.title}. Vídeo${it.dateCreated ? `, ${it.dateCreated.slice(0, 4)}` : ""}. NASA Image and Video Library. Disponível em: ${it.detailsUrl}. Acesso em: ${new Date().toLocaleDateString("pt-BR")}.` }
    ];
    const { data: row, error } = await sb.from("notes").insert({ title: `Videoaula — ${it.title.slice(0, 80)}`, blocks }).select("id").single();
    setSaving(false);
    if (error || !row) { setMsg(error?.message || "Não foi possível salvar."); return; }
    setSavedNote(row.id as string);
    try { localStorage.removeItem(draftKey(id)); } catch { /* ok */ }
  }

  return (
    <div>
      <Link href="/study" className="mb-4 inline-flex items-center gap-1 text-sm text-dim hover:text-ink"><ArrowLeft size={14} /> Study</Link>
      {state === "loading" && <Loading label="Carregando vídeo e legendas da NASA…" />}
      {state === "error" && <ErrorState error={env?.error} onRetry={retry} />}
      {state === "empty" && <Empty>O item existe, mas não há arquivo de vídeo publicado no acervo.</Empty>}

      {data && (
        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <div className="min-w-0">
            {src && (
              <video ref={video} key={src} controls preload="metadata" poster={data.item.thumb} className="aspect-video w-full rounded-lg bg-black"
                onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}>
                <source src={src} type="video/mp4" />
                {vttUrl && <track kind="subtitles" srcLang="en" label="English (NASA)" src={vttUrl} default />}
              </video>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-dim">
              {data.files.length > 1 && (
                <label className="flex items-center gap-1">Qualidade
                  <select className="input w-auto py-1 text-xs" value={quality || (src && data.files.find((f) => f.url === src)?.label) || ""}
                    onChange={(e) => { resumeAt.current = video.current?.currentTime || 0; setQuality(e.target.value); }}>
                    {data.files.map((f) => <option key={f.label} value={f.label}>{f.label}</option>)}
                  </select>
                </label>
              )}
              <a href={data.item.detailsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">Página oficial <ExternalLink size={11} /></a>
            </div>

            <h1 className="font-display mt-4 text-xl leading-snug sm:text-2xl">{data.item.title}</h1>
            <p className="mt-1 text-xs text-dim">{[data.item.center && `NASA ${data.item.center}`, data.item.dateCreated?.slice(0, 10), data.item.photographer].filter(Boolean).join(" · ")}</p>
            <div className="mt-3"><SaveActions item={{ externalId: `nasa-video:${data.item.nasaId}`, title: data.item.title, itemType: "video", source: "NASA", institution: data.item.center ? `NASA ${data.item.center}` : "NASA", kind: "IMAGERY", originalUrl: data.item.detailsUrl, provenance: { dataset: "NASA Image and Video Library", period: data.item.dateCreated?.slice(0, 10) } }} /></div>
            {data.item.description && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-dim">{data.item.description}</p>}
            {data.item.keywords.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{data.item.keywords.slice(0, 12).map((k) => <span key={k} className="rounded border border-line px-1.5 py-0.5 text-[11px] text-dim">{k}</span>)}</div>}
            <Link href={`/ai?q=${encodeURIComponent(`Encontre relatórios técnicos da NASA sobre: ${data.item.title}`)}`} className="btn mt-4 text-xs"><MessageSquareText size={13} /> Aprofundar com o ASTRAE AI</Link>
            <Provenance p={env?.provenance} storedAt={env?.cache?.storedAt} />
          </div>

          <aside className="space-y-4">
            <section className="panel p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-medium"><NotebookPen size={14} /> Minhas anotações</h2>
                <button className="btn text-xs" onClick={() => insertMark()} title="Inserir o tempo atual do vídeo"><Clock size={13} /> Marcar tempo</button>
              </div>
              <textarea ref={notesRef} value={notes} onChange={(e) => updateNotes(e.target.value)} rows={8} className="input mt-2 font-[inherit] leading-relaxed"
                placeholder={"Anote ideias, dúvidas e trechos importantes.\nUse “Marcar tempo” para ligar a nota ao momento do vídeo."} />
              {marks.length > 0 && (
                <ul className="mt-2 max-h-32 space-y-0.5 overflow-auto">
                  {marks.map((m, i) => <li key={i}><button onClick={() => seek(m.t)} className="w-full truncate rounded px-1.5 py-0.5 text-left text-xs text-dim hover:bg-panel2 hover:text-ink"><span className="font-mono text-accent">{m.label}</span> {m.text}</button></li>)}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button className="btn-primary text-xs" onClick={saveToNotebook} disabled={saving || !notes.trim()}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <BookmarkCheck size={13} />} Salvar no caderno
                </button>
                {savedNote && <Link href={`/notebook?note=${savedNote}`} className="text-xs text-accent hover:underline">Abrir no caderno →</Link>}
              </div>
              {msg && <p className="mt-1 text-xs text-warn">{msg}</p>}
              <p className="mt-2 text-[11px] text-faint">O rascunho fica só neste navegador até você salvar; no caderno ele é privado da sua conta.</p>
            </section>

            <section className="panel p-3">
              <h2 className="text-sm font-medium">Transcrição</h2>
              {data.cues.length === 0 ? (
                <p className="mt-2 text-xs text-dim">A NASA não publicou legenda para este vídeo.</p>
              ) : (
                <>
                  <label className="relative mt-2 block">
                    <Search size={13} className="absolute left-2.5 top-2.5 text-faint" />
                    <input className="input py-1.5 pl-8 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar na transcrição" />
                  </label>
                  <ul className="mt-2 max-h-[420px] space-y-0.5 overflow-auto pr-1">
                    {shown.map(({ c, i }) => (
                      <li key={i} className={`group flex gap-2 rounded px-1.5 py-1 text-xs ${i === active ? "bg-accent/10 text-ink" : "text-dim hover:bg-panel2"}`}>
                        <button onClick={() => seek(c.start)} className="shrink-0 font-mono text-accent">{fmt(c.start)}</button>
                        <span className="flex-1 leading-relaxed">{c.text}</span>
                        <button onClick={() => { if (video.current) video.current.currentTime = c.start; insertMark(`“${c.text}”`); }} title="Citar este trecho nas anotações"
                          className="shrink-0 text-faint hover:text-ink">+ nota</button>
                      </li>
                    ))}
                    {shown.length === 0 && <li className="text-xs text-dim">Nada encontrado.</li>}
                  </ul>
                  <p className="mt-2 text-[11px] text-faint">Legenda oficial publicada pela NASA, no idioma do vídeo.</p>
                </>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
