"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/AppShell";
import { RequireAccount } from "@/components/research/RequireAccount";
import { Empty, Loading } from "@/components/ui/DataState";
import { useUser } from "@/hooks/useUser";

interface Project { id: string; title: string; description: string; hypothesis: string; updated_at: string; research_items: { count: number }[] }

function Projects() {
  const { sb } = useUser();
  const [list, setList] = useState<Project[] | null>(null);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = () => sb!.from("projects").select("id,title,description,hypothesis,updated_at,research_items(count)").order("updated_at", { ascending: false })
    .then(({ data, error }) => { if (error) setErr(error.message); setList((data as Project[]) || []); });
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const { error } = await sb!.from("projects").insert({ title: title.trim() });
    if (error) setErr(error.message); else { setTitle(""); load(); }
  }

  return (
    <>
      <form onSubmit={create} className="mb-5 flex max-w-xl gap-2">
        <input className="input" placeholder="Novo projeto — ex.: Atmosfera de Marte" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Título do projeto" />
        <button className="btn-primary shrink-0" disabled={!title.trim()}>Criar projeto</button>
      </form>
      {err && <p className="mb-3 text-sm text-bad">{err}</p>}
      {list === null && <Loading />}
      {list?.length === 0 && <Empty>Nenhum projeto ainda. Crie o primeiro acima ou use “Adicionar à pesquisa” em qualquer resultado.</Empty>}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list?.map((p) => (
          <li key={p.id}>
            <Link href={`/research/${p.id}`} className="panel block h-full p-4 hover:border-accent/60">
              <h3 className="font-medium">{p.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-dim">{p.hypothesis || p.description || "Sem hipótese definida."}</p>
              <p className="mt-3 text-xs text-faint">{p.research_items?.[0]?.count ?? 0} itens · atualizado em {new Date(p.updated_at).toLocaleDateString("pt-BR")}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function ResearchPage() {
  return (
    <div>
      <PageHeader title="My Research" subtitle="Seus projetos: descrição, hipótese, perguntas, dados, gráficos, mapas, notas e referências. Privados por padrão." />
      <RequireAccount><Projects /></RequireAccount>
    </div>
  );
}
