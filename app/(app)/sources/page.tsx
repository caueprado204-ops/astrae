"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shell/AppShell";
import { Loading } from "@/components/ui/DataState";

interface S { id: string; institution: string; api: string; dataset: string; docs: string; state: "connected" | "unavailable" | "key-required" | "pending"; latencyMs?: number; checkedAt: string; detail?: string }
const LABEL: Record<S["state"], [string, string]> = {
  connected: ["● Connected", "text-ok"], unavailable: ["○ Temporarily unavailable", "text-bad"],
  "key-required": ["○ API key required", "text-warn"], pending: ["○ Integration pending", "text-dim"]
};

export default function SourcesPage() {
  const [data, setData] = useState<{ data: S[]; cache: { storedAt: string } } | null>(null);
  const load = () => { setData(null); fetch("/api/sources").then((r) => r.json()).then(setData); };
  useEffect(load, []);
  return (
    <div>
      <PageHeader title="Sources" subtitle="Cada fonte oficial que a ASTRAE consulta, com o status da última verificação (refeita a cada 10 minutos).">
        <button className="btn" onClick={load}><RefreshCw size={14} /> Atualizar</button>
      </PageHeader>
      {!data && <Loading label="Verificando a conexão com cada fonte…" />}
      {data && (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-dim"><tr className="border-b border-line">
              <th className="px-4 py-2.5 font-normal">Instituição</th><th className="font-normal">API</th><th className="font-normal">Dataset</th><th className="font-normal">Status</th><th className="pr-4 font-normal">Última verificação</th>
            </tr></thead>
            <tbody>
              {data.data.map((s) => (
                <tr key={s.id} className="border-b border-line/60 align-top">
                  <td className="px-4 py-2.5">{s.institution}</td>
                  <td className="py-2.5"><a href={s.docs} target="_blank" rel="noreferrer" className="hover:text-accent">{s.api}</a></td>
                  <td className="py-2.5 text-dim">{s.dataset}</td>
                  <td className="py-2.5">
                    <span className={LABEL[s.state][1]}>{LABEL[s.state][0]}</span>
                    {s.latencyMs != null && <span className="ml-2 font-mono text-[11px] text-faint">{s.latencyMs} ms</span>}
                    {s.detail && <p className="mt-0.5 max-w-xs text-xs text-dim">{s.detail}</p>}
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-dim">{new Date(s.checkedAt).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
