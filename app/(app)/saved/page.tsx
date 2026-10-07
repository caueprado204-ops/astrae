"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell/AppShell";
import { RequireAccount } from "@/components/research/RequireAccount";
import { Empty, Loading } from "@/components/ui/DataState";
import { KindTag } from "@/components/ui/KindTag";
import { useUser } from "@/hooks/useUser";
import type { DataKind } from "@/types/science";

interface Saved { id: string; title: string; source: string; institution: string | null; kind: DataKind; original_url: string; provenance: { dataset?: string; accessedAt?: string; period?: string }; created_at: string }
interface SavedSearch { id: string; query: string; created_at: string }

function List() {
  const { sb } = useUser();
  const [items, setItems] = useState<Saved[] | null>(null);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  useEffect(() => {
    sb!.from("saved_datasets").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems((data as Saved[]) || []));
    sb!.from("saved_searches").select("id,query,created_at").order("created_at", { ascending: false }).limit(20).then(({ data }) => setSearches((data as SavedSearch[]) || []));
  }, [sb]);
  if (!items) return <Loading />;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <section className="panel p-4">
        {items.length === 0 ? <Empty>Nenhum dataset salvo. Use “Salvar” nos resultados da busca, gráficos e mapas.</Empty> : (
          <ul className="divide-y divide-line">
            {items.map((it) => (
              <li key={it.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{it.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-dim">
                    <KindTag kind={it.kind} /><span>Source: {it.source}</span>{it.institution && <span>{it.institution}</span>}
                    {it.provenance?.dataset && <span>Dataset: {it.provenance.dataset}</span>}
                    <span>Acesso: {new Date(it.provenance?.accessedAt || it.created_at).toLocaleDateString("pt-BR")}</span>
                  </p>
                </div>
                <a href={it.original_url} target="_blank" rel="noreferrer" className="text-accent" aria-label="View original source"><ExternalLink size={14} /></a>
                <button aria-label="Remover" className="text-dim hover:text-bad" onClick={async () => { await sb!.from("saved_datasets").delete().eq("id", it.id); setItems(items.filter((x) => x.id !== it.id)); }}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside className="panel h-fit p-4">
        <h2 className="font-medium">Buscas salvas</h2>
        {searches.length === 0 ? <p className="mt-2 text-sm text-dim">Nenhuma ainda.</p> : (
          <ul className="mt-2 space-y-1">{searches.map((s) => <li key={s.id}><Link href={`/search?q=${encodeURIComponent(s.query)}`} className="block rounded px-2 py-1 text-sm hover:bg-panel2">{s.query}</Link></li>)}</ul>
        )}
      </aside>
    </div>
  );
}

export default function SavedPage() {
  return (
    <div>
      <PageHeader title="Saved datasets" subtitle="Datasets, séries, imagens e referências que você salvou — cada um com fonte e data de acesso." />
      <RequireAccount><List /></RequireAccount>
    </div>
  );
}
