"use client";
import { useState } from "react";
import { ExternalLink, Info } from "lucide-react";
import type { Provenance as P } from "@/types/science";
import { KindTag } from "./KindTag";

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" }) : "—");

/** Bloco de rastreabilidade: SOURCE / DATASET / ACCESS DATE / ORIGINAL SOURCE. */
export function Provenance({ p, compact = false, storedAt, stale }: { p: P | null | undefined; compact?: boolean; storedAt?: string; stale?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!p) return null;
  const rows: [string, string | undefined][] = [
    ["Source", p.source], ["Institution", p.institution], ["Dataset", p.dataset],
    ["Unit", p.unit], ["Location", p.location], ["Period", p.period],
    ["Access date", fmt(p.accessedAt)], ["Data retrieved", storedAt ? fmt(storedAt) : undefined]
  ];
  return (
    <div className="mt-3 border-t border-line pt-2.5 text-xs text-dim">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <KindTag kind={p.kind} />
        <span><span className="text-faint">Source</span> <span className="text-ink">{p.source}</span></span>
        <span className="min-w-0 truncate"><span className="text-faint">Dataset</span> <span className="text-ink">{p.dataset}</span></span>
        {stale && <span className="text-warn">Mostrando a última versão disponível ({fmt(storedAt)}) — fonte indisponível agora.</span>}
        <span className="ml-auto flex items-center gap-2">
          {!compact && (
            <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              <Info size={13} /> Metadados
            </button>
          )}
          <a className="inline-flex items-center gap-1 text-accent hover:underline" href={p.originalUrl} target="_blank" rel="noreferrer">
            View original source <ExternalLink size={12} />
          </a>
        </span>
      </div>
      {open && (
        <dl className="mt-2 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-faint">{k}</dt><dd className="text-ink">{v}</dd></div>
          ))}
          {p.apiEndpoint && (<><dt className="text-faint">API endpoint</dt><dd className="break-all font-mono text-[11px]">{p.apiEndpoint}</dd></>)}
          {p.methodology && (<><dt className="text-faint">Methodology</dt><dd className="text-ink/90">{p.methodology}</dd></>)}
          {p.notes && (<><dt className="text-faint">Notes</dt><dd className="text-ink/90">{p.notes}</dd></>)}
        </dl>
      )}
    </div>
  );
}
