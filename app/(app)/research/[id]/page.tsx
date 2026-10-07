"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { RequireAccount } from "@/components/research/RequireAccount";
import { KindTag } from "@/components/ui/KindTag";
import { Loading } from "@/components/ui/DataState";
import { useUser } from "@/hooks/useUser";
import type { DataKind } from "@/types/science";

interface Project { id: string; title: string; description: string; hypothesis: string; questions: string[]; is_public: boolean }
interface Item { id: string; item_type: string; title: string; source: string; institution: string | null; original_url: string; provenance: { kind?: DataKind; dataset?: string; accessedAt?: string; period?: string }; payload: Record<string, unknown> | null; created_at: string }
interface Note { id: string; title: string; updated_at: string }

const GROUPS: [string, string[]][] = [
  ["Dados e séries", ["timeseries", "dataset"]], ["Gráficos", ["chart"]], ["Mapas", ["map"]],
  ["Imagens", ["image", "video"]], ["Referências", ["article", "document", "reference"]]
];

function Detail() {
  const { id } = useParams<{ id: string }>();
  const { sb } = useUser();
  const router = useRouter();
  const [p, setP] = useState<Project | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    sb!.from("projects").select("*").eq("id", id).single().then(({ data }) => setP(data as Project));
    sb!.from("research_items").select("*").eq("project_id", id).order("created_at", { ascending: false }).then(({ data }) => setItems((data as Item[]) || []));
    sb!.from("notes").select("id,title,updated_at").eq("project_id", id).order("updated_at", { ascending: false }).then(({ data }) => setNotes((data as Note[]) || []));
  }, [id, sb]);

  async function save() {
    if (!p) return;
    setSaving("saving");
    await sb!.from("projects").update({ title: p.title, description: p.description, hypothesis: p.hypothesis, questions: p.questions.filter(Boolean) }).eq("id", p.id);
    setSaving("saved");
  }
  async function removeItem(itemId: string) {
    await sb!.from("research_items").delete().eq("id", itemId);
    setItems(items.filter((i) => i.id !== itemId));
  }
  async function newNote() {
    const { data } = await sb!.from("notes").insert({ title: `Nota — ${p?.title}`, project_id: id, blocks: [] }).select("id").single();
    if (data) router.push(`/notebook?note=${data.id}`);
  }
  async function deleteProject() {
    if (!confirm("Excluir este projeto e todos os itens salvos nele? Notas vinculadas são mantidas.")) return;
    await sb!.from("projects").delete().eq("id", id);
    router.push("/research");
  }

  if (!p) return <Loading />;
  const set = (patch: Partial<Project>) => { setP({ ...p, ...patch }); setSaving("idle"); };

  return (
    <div>
      <Link href="/research" className="text-xs text-dim hover:text-ink">← My Research</Link>
      <input className="font-display mt-2 w-full bg-transparent text-2xl outline-none sm:text-3xl" value={p.title} onChange={(e) => set({ title: e.target.value })} aria-label="Título do projeto" />

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <section className="panel space-y-3 p-4">
            <label className="block"><span className="label">Descrição</span><textarea className="input mt-1 min-h-[80px]" value={p.description} onChange={(e) => set({ description: e.target.value })} /></label>
            <label className="block"><span className="label">Hipótese</span><textarea className="input mt-1 min-h-[70px]" value={p.hypothesis} onChange={(e) => set({ hypothesis: e.target.value })} /></label>
            <div>
              <span className="label">Perguntas de pesquisa</span>
              <ol className="mt-1 space-y-1.5">
                {[...p.questions, ""].map((q, i) => (
                  <li key={i} className="flex items-center gap-2"><span className="readout w-5 text-xs text-faint">{i + 1}</span>
                    <input className="input" value={q} placeholder={i === p.questions.length ? "Nova pergunta…" : ""} onChange={(e) => { const qs = [...p.questions]; qs[i] = e.target.value; set({ questions: qs }); }} />
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex items-center gap-3">
              <button className="btn-primary" onClick={save} disabled={saving === "saving"}>{saving === "saved" ? "Alterações salvas" : "Salvar alterações"}</button>
              <button className="ml-auto inline-flex items-center gap-1 text-xs text-dim hover:text-bad" onClick={deleteProject}><Trash2 size={13} /> Excluir projeto</button>
            </div>
          </section>

          {GROUPS.map(([label, types]) => {
            const list = items.filter((i) => types.includes(i.item_type));
            return (
              <section key={label} className="panel p-4">
                <h2 className="font-medium">{label} <span className="text-xs text-dim">({list.length})</span></h2>
                {list.length === 0 ? <p className="mt-2 text-sm text-dim">Nada salvo aqui. Use “Adicionar à pesquisa” nos resultados, gráficos e mapas.</p> : (
                  <ul className="mt-2 divide-y divide-line">
                    {list.map((it) => (
                      <li key={it.id} className="flex items-start gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">{it.title}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-dim">
                            {it.provenance?.kind && <KindTag kind={it.provenance.kind} />}
                            <span>{it.source}{it.institution ? ` · ${it.institution}` : ""}</span>
                            {it.provenance?.dataset && <span>Dataset: {it.provenance.dataset}</span>}
                            {it.provenance?.accessedAt && <span>Acesso: {new Date(it.provenance.accessedAt).toLocaleDateString("pt-BR")}</span>}
                          </p>
                        </div>
                        <a href={it.original_url} target="_blank" rel="noreferrer" className="text-accent" aria-label="View original source"><ExternalLink size={14} /></a>
                        <button onClick={() => removeItem(it.id)} className="text-dim hover:text-bad" aria-label="Remover"><Trash2 size={14} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        <aside className="space-y-4">
          <section className="panel p-4">
            <div className="flex items-center justify-between"><h2 className="font-medium">Notas</h2><button className="btn text-xs" onClick={newNote}>Nova nota</button></div>
            {notes.length === 0 ? <p className="mt-2 text-sm text-dim">Nenhuma nota vinculada.</p> : (
              <ul className="mt-2 space-y-1">{notes.map((n) => <li key={n.id}><Link href={`/notebook?note=${n.id}`} className="block rounded px-2 py-1 text-sm hover:bg-panel2">{n.title}<span className="block text-[11px] text-faint">{new Date(n.updated_at).toLocaleDateString("pt-BR")}</span></Link></li>)}</ul>
            )}
          </section>
          <section className="panel p-4 text-sm">
            <h2 className="font-medium">Referências</h2>
            <ol className="mt-2 list-decimal space-y-2 pl-4 text-xs text-dim">
              {items.map((it) => (
                <li key={it.id}>{it.institution || it.source}. <em>{it.provenance?.dataset || it.title}</em>. Disponível em: {it.original_url}. Acesso em: {it.provenance?.accessedAt ? new Date(it.provenance.accessedAt).toLocaleDateString("pt-BR") : "—"}.</li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function ResearchDetail() {
  return <RequireAccount><Detail /></RequireAccount>;
}
