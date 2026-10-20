"use client";
import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shell/AppShell";
import { Loading } from "@/components/ui/DataState";
import { CATALOG, type SourceSheet } from "@/services/sources/catalog";

interface S { id: string; institution: string; api: string; dataset: string; docs: string; state: "connected" | "unavailable" | "key-required" | "pending"; latencyMs?: number; checkedAt: string; detail?: string }
const LABEL: Record<S["state"], [string, string]> = {
  connected: ["● Conectada", "text-ok"], unavailable: ["○ Temporariamente indisponível", "text-bad"],
  "key-required": ["○ Requer chave", "text-warn"], pending: ["○ Integração pendente", "text-dim"]
};
const AREAS: SourceSheet["area"][] = ["Clima", "Saúde", "Território", "Observação da Terra", "Espaço"];

export default function SourcesPage() {
  const [data, setData] = useState<{ data: S[]; cache: { storedAt: string } } | null>(null);
  const [area, setArea] = useState<SourceSheet["area"] | "Todas">("Todas");
  const load = () => { setData(null); fetch("/api/sources").then((r) => r.json()).then(setData).catch(() => setData({ data: [], cache: { storedAt: "" } })); };
  useEffect(load, []);
  const sheet = (id: string) => CATALOG.find((c) => c.id === id);
  const areaOf = (id: string): SourceSheet["area"] => sheet(id)?.area || (id.startsWith("nasa-m") || id.startsWith("nasa-r") || id.startsWith("nasa-t") || id.startsWith("nasa-p") || id === "nasa-apod" || id === "nasa-images" ? "Espaço" : "Observação da Terra");
  const list = (data?.data || []).filter((s) => area === "Todas" || areaOf(s.id) === area).sort((x, y) => AREAS.indexOf(areaOf(x.id)) - AREAS.indexOf(areaOf(y.id)));

  return (
    <div>
      <PageHeader title="Biblioteca de dados" subtitle="Cada fonte que a ASTRAE consulta: o que oferece, acesso, cobertura, frequência, limitações e como está integrada — com o status da última verificação (refeita a cada 10 minutos).">
        <button className="btn" onClick={load}><RefreshCw size={14} /> Verificar agora</button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(["Todas", ...AREAS] as const).map((a) => <button key={a} className="chip" aria-pressed={area === a} onClick={() => setArea(a)}>{a}</button>)}
      </div>

      {!data && <Loading label="Verificando a conexão com cada fonte…" />}
      {data && (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((s) => {
            const sh = sheet(s.id);
            return (
              <article key={s.id} className="bento p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="eyebrow text-[10px] text-faint">{areaOf(s.id)} · {s.institution}</p>
                    <a href={s.docs} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium hover:text-accent">{s.api} <ExternalLink size={12} /></a>
                    <p className="text-xs text-dim">{s.dataset}</p>
                  </div>
                  <div className="text-right text-xs">
                    <span className={LABEL[s.state][1]}>{LABEL[s.state][0]}</span>
                    {s.latencyMs != null && <span className="ml-1 font-mono text-[11px] text-faint">{s.latencyMs} ms</span>}
                    <p className="text-[11px] text-faint">{new Date(s.checkedAt).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
                {s.detail && <p className="mt-2 text-xs text-dim">{s.detail}</p>}
                {sh && (
                  <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                    <Field t="Dados" v={sh.data} /><Field t="Acesso" v={sh.auth} />
                    <Field t="Cobertura" v={sh.coverage} /><Field t="Atualização" v={sh.frequency} />
                    <Field t="Limitações" v={sh.limitations} wide /><Field t="Integração na ASTRAE" v={sh.integration} wide />
                  </dl>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ t, v, wide }: { t: string; v: string; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : ""}><dt className="text-faint">{t}</dt><dd className="mt-0.5 leading-relaxed text-dim">{v}</dd></div>;
}
