"use client";
import { useState } from "react";
import { PageHeader } from "@/components/shell/AppShell";
import { useApi } from "@/hooks/useApi";
import { Provenance } from "@/components/ui/Provenance";
import { Empty, ErrorState, Loading } from "@/components/ui/DataState";
import { SaveActions } from "@/components/research/SaveToResearch";

interface Apod { date: string; title: string; explanation: string; url: string; hdurl?: string; media_type: string; copyright?: string }
interface Media { nasaId: string; title: string; description: string; center?: string; dateCreated?: string; thumb?: string; detailsUrl: string }
const BODIES = ["Mercury", "Venus", "Moon", "Mars", "Jupiter", "Europa", "Saturn", "Titan", "Uranus", "Neptune", "Pluto", "asteroid", "comet", "exoplanet"];
const PT: Record<string, string> = { Mercury: "Mercúrio", Venus: "Vênus", Moon: "Lua", Mars: "Marte", Jupiter: "Júpiter", Europa: "Europa", Saturn: "Saturno", Titan: "Titã", Uranus: "Urano", Neptune: "Netuno", Pluto: "Plutão", asteroid: "Asteroides", comet: "Cometas", exoplanet: "Exoplanetas" };

export default function Planetary() {
  const [date, setDate] = useState("");
  const apod = useApi<Apod>(`/api/nasa/apod${date ? `?date=${date}` : ""}`);
  const [body, setBody] = useState("Jupiter");
  const media = useApi<{ items: Media[]; total: number }>(`/api/nasa/images?q=${encodeURIComponent(body)}`);
  const a = apod.data;

  return (
    <div>
      <PageHeader title="Planetary" subtitle="Sistemas planetários pelo acervo oficial da NASA: imagem astronômica do dia e coleção de imagens por corpo celeste." />

      <section className="panel grid gap-5 p-4 lg:grid-cols-[1.2fr_1fr]">
        <div>
          {apod.state === "loading" && <Loading />}
          {apod.state === "error" && <ErrorState error={apod.env?.error} onRetry={apod.retry} />}
          {a && (a.media_type === "image"
            // eslint-disable-next-line @next/next/no-img-element
            ? <a href={a.hdurl || a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.title} className="max-h-[520px] w-full rounded object-contain" /></a>
            : <iframe src={a.url} title={a.title} className="aspect-video w-full rounded" allowFullScreen />)}
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-dim">Astronomy Picture of the Day</span>
            <input type="date" className="input w-auto py-1 text-xs" min="1995-06-16" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data da APOD" />
          </div>
          {a && (
            <>
              <h2 className="font-display mt-2 text-xl">{a.title}</h2>
              <p className="text-xs text-dim">{a.date}{a.copyright ? ` · © ${a.copyright.trim()}` : ""}</p>
              <p className="mt-3 max-h-72 overflow-auto text-sm leading-relaxed text-dim">{a.explanation}</p>
              <div className="mt-3"><SaveActions item={{ externalId: `apod:${a.date}`, title: `APOD ${a.date} — ${a.title}`, itemType: "image", source: "NASA", institution: "NASA GSFC", kind: "IMAGERY", originalUrl: `https://apod.nasa.gov/apod/ap${a.date.slice(2).replaceAll("-", "")}.html`, provenance: { dataset: "APOD", period: a.date } }} /></div>
            </>
          )}
          <Provenance p={apod.env?.provenance} compact storedAt={apod.env?.cache?.storedAt} />
        </div>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap gap-1.5">
          {BODIES.map((b) => <button key={b} aria-pressed={body === b} onClick={() => setBody(b)} className={`rounded-full border px-2.5 py-1 text-xs ${body === b ? "border-accent bg-accent/10" : "border-line text-dim hover:text-ink"}`}>{PT[b]}</button>)}
        </div>
        {media.state === "loading" && <Loading />}
        {media.state === "error" && <ErrorState error={media.env?.error} onRetry={media.retry} />}
        {media.state === "empty" && <Empty />}
        {media.data && (
          <>
            <p className="mt-3 text-xs text-dim">{media.data.total.toLocaleString("pt-BR")} itens na NASA Image and Video Library para “{body}”.</p>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {media.data.items.filter((m) => m.thumb).map((m) => (
                <li key={m.nasaId} className="panel overflow-hidden">
                  <a href={m.detailsUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.thumb} alt={m.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  </a>
                  <div className="p-2.5">
                    <p className="line-clamp-2 text-sm">{m.title}</p>
                    <p className="mt-1 text-[11px] text-dim">{m.center ? `NASA ${m.center} · ` : ""}{m.dateCreated?.slice(0, 10)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Provenance p={media.env?.provenance} storedAt={media.env?.cache?.storedAt} />
          </>
        )}
      </section>

      <section className="panel mt-6 p-4 text-sm">
        <p className="text-warn">○ Integration pending — NASA Planetary Data System (PDS)</p>
        <p className="mt-1 text-dim">O PDS distribui os arquivos científicos completos das missões (PDS4). O adaptador para consultar índices e baixar produtos por missão está planejado; até lá, os links de cada página levam ao arquivo oficial.</p>
        <a className="mt-2 inline-block text-xs text-accent hover:underline" href="https://pds.nasa.gov/" target="_blank" rel="noreferrer">pds.nasa.gov</a>
      </section>
    </div>
  );
}
