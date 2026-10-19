"use client";
import Link from "next/link";
import { FileText, PlayCircle } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { Provenance } from "@/components/ui/Provenance";
import { Empty, ErrorState, Loading } from "@/components/ui/DataState";
import { SaveActions } from "@/components/research/SaveToResearch";

interface Media { nasaId: string; title: string; description: string; center?: string; dateCreated?: string; thumb?: string; detailsUrl: string }
interface Report { id: number; title: string; abstract: string; stiType?: string; authors: string[]; center?: string; published?: string; pdfUrl?: string; url: string }

/** Videoaulas: vídeos do acervo oficial da NASA para uma busca. */
export function VideoGrid({ query, limit }: { query: string; limit?: number }) {
  const v = useApi<{ items: Media[]; total: number }>(query ? `/api/nasa/images?media_type=video&q=${encodeURIComponent(query)}` : null);
  if (v.state === "loading") return <Loading label="Buscando vídeos no acervo da NASA…" />;
  if (v.state === "error") return <ErrorState error={v.env?.error} onRetry={v.retry} />;
  if (v.state === "empty") return <Empty>Nenhum vídeo da NASA para “{query}”. Tente termos em inglês.</Empty>;
  if (!v.data) return null;
  const items = v.data.items.slice(0, limit ?? v.data.items.length);
  return (
    <>
      <p className="text-xs text-dim">{v.data.total.toLocaleString("pt-BR")} vídeos na NASA Image and Video Library para “{query}”.</p>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((m) => (
          <li key={m.nasaId} className="panel group overflow-hidden">
            <Link href={`/study/video/${encodeURIComponent(m.nasaId)}`} className="block">
              <div className="relative aspect-video bg-panel2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.thumb && <img src={m.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
                <PlayCircle size={40} className="absolute inset-0 m-auto text-white/85 drop-shadow transition group-hover:scale-110" />
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm text-ink">{m.title}</p>
                <p className="mt-1 text-[11px] text-dim">{m.center ? `NASA ${m.center} · ` : ""}{m.dateCreated?.slice(0, 10)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Provenance p={v.env?.provenance} compact storedAt={v.env?.cache?.storedAt} />
    </>
  );
}

/** Leituras técnicas: relatórios do NASA Technical Reports Server. */
export function ReportList({ query, limit = 6 }: { query: string; limit?: number }) {
  const r = useApi<{ items: Report[]; total: number }>(`/api/nasa/ntrs?q=${encodeURIComponent(query)}`);
  if (r.state === "loading") return <Loading label="Buscando relatórios no NTRS…" />;
  if (r.state === "error") return <ErrorState error={r.env?.error} onRetry={r.retry} />;
  if (r.state === "empty") return <Empty />;
  if (!r.data) return null;
  return (
    <>
      <ul className="space-y-3">
        {r.data.items.slice(0, limit).map((x) => (
          <li key={x.id} className="rounded-md border border-line p-3">
            <a href={x.url} target="_blank" rel="noreferrer" className="flex gap-2 text-sm text-ink hover:text-accent">
              <FileText size={15} className="mt-0.5 shrink-0 text-dim" /> <span>{x.title}</span>
            </a>
            <p className="mt-1 text-[11px] text-dim">
              {[x.authors.slice(0, 3).join(", ") + (x.authors.length > 3 ? " et al." : ""), x.center, x.published?.slice(0, 4), x.stiType].filter(Boolean).join(" · ")}
            </p>
            {x.abstract && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-dim">{x.abstract}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {x.pdfUrl && <a href={x.pdfUrl} target="_blank" rel="noreferrer" className="btn text-xs">PDF</a>}
              <SaveActions compact item={{ externalId: `ntrs:${x.id}`, title: x.title, itemType: "article", source: "NASA", institution: x.center || "NASA STI Program", kind: "CATALOG", originalUrl: x.url, provenance: { dataset: "NTRS", period: x.published?.slice(0, 10) }, payload: { authors: x.authors } }} />
            </div>
          </li>
        ))}
      </ul>
      <Provenance p={r.env?.provenance} compact storedAt={r.env?.cache?.storedAt} />
    </>
  );
}
