import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

export function Loading({ label = "Consultando a fonte oficial…" }: { label?: string }) {
  return <div role="status" className="flex items-center gap-2 py-8 text-sm text-dim"><Loader2 size={16} className="animate-spin" /> {label}</div>;
}

export function ErrorState({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-start gap-3 rounded-md border border-bad/40 bg-bad/5 p-3 text-sm">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-bad" />
      <div className="min-w-0 flex-1">
        <p className="text-ink">Data source temporarily unavailable.</p>
        {error && <p className="mt-0.5 break-words text-xs text-dim">{error.replace("Data source temporarily unavailable. ", "")}</p>}
      </div>
      {onRetry && <button className="btn" onClick={onRetry}>Tentar de novo</button>}
    </div>
  );
}

export function Empty({ children = "A fonte respondeu, mas não há dados para este filtro." }: { children?: React.ReactNode }) {
  return <div className="flex items-center gap-2 py-6 text-sm text-dim"><Inbox size={16} /> {children}</div>;
}
