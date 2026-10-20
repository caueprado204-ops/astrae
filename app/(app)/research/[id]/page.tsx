"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Download, ExternalLink, Printer, Trash2 } from "lucide-react";
import { RequireAccount } from "@/components/research/RequireAccount";
import { KindTag } from "@/components/ui/KindTag";
import { Loading } from "@/components/ui/DataState";
import { useUser } from "@/hooks/useUser";
import { buildReport, SECTIONS, type ReportItem, type ReportProject } from "@/utils/report";
import { download, slug } from "@/utils/export";
import type { DataKind } from "@/types/science";

interface Project extends ReportProject { id: string; is_public: boolean; axis?: string }
interface Item extends ReportItem { id: string; provenance: ReportItem["provenance"] & { kind?: DataKind }; created_at: string }
interface Note { id: string; title: string; updated_at: string }

const GROUPS: [string, string[]][] = [
  ["Análises, dados e séries", ["chart", "timeseries", "dataset"]], ["Mapas", ["map"]],
  ["Imagens e vídeos", ["image", "video"]], ["Referências", ["article", "document", "reference"]]
];
const STRUCT_KEYS = ["justification", "objectives", "data_sources", "methodology", "results", "limitations", "references_text", "next_steps", "axis", "review_status", "reviewer_name", "reviewer_note"] as const;
const EMPTY = Object.fromEntries(STRUCT_KEYS.map((k) => [k, k === "axis" ? "livre" : k === "review_status" ? "rascunho" : ""]));

function Detail() {
  const { id } = useParams<{ id: string }>();
  const { sb } = useUser();
  const router = useRouter();
  const [p, setP] = useState<Project | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [structured, setStructured] = useState(true);

  useEffect(() => {
    sb!.from("projects").select("*").eq("id", id).single().then(({ data }) => {
      if (!data) return;
      setStructured("methodology" in data); // migração 0002 aplicada?
      setP({ ...EMPTY, ...data } as Project);
    });
    sb!.from("research_items").select("*").eq("project_id", id).order("created_at", { ascending: false }).then(({ data }) => setItems((data as Item[]) || []));
    sb!.from("notes").select("id,title,updated_at").eq("project_id", id).order("updated_at", { ascending: false }).then(({ data }) => setNotes((data as Note[]) || []));
  }, [id, sb]);

  async function save() {
    if (!p) return;
    setSaving("saving"); setErr(null);
    const base = { title: p.title, description: p.description, hypothesis: p.hypothesis, questions: p.questions.filter(Boolean) };
    const extra = structured ? Object.fromEntries(STRUCT_KEYS.map((k) => [k, p[k as keyof Project]])) : {};
    if (structured && p.review_status === "revisado" && !p.reviewed_at) Object.assign(extra, { reviewed_at: new Date().toISOString() });
    const { error } = await sb!.from("projects").update({ ...base, ...extra }).eq("id", p.id);
    if (error) { setErr(error.message); setSaving("idle"); } else setSaving("saved");
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
    if (!confirm("Excluir esta investigação e todos os itens salvos nela? Notas vinculadas são mantidas.")) return;
    await sb!.from("projects").delete().eq("id", id);
    router.push("/research");
  }
  function exportMd() { if (p) download(`${slug(p.title)}.md`, buildReport(p, items), "text/markdown"); }
  function printReport() {
    if (!p) return;
    const md = buildReport(p, items);
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html = esc(md).split("\n").map((l) => l.startsWith("### ") ? `<h3>${l.slice(4)}</h3>` : l.startsWith("## ") ? `<h2>${l.slice(3)}</h2>` : l.startsWith("# ") ? `<h1>${l.slice(2)}</h1>` : l === "---" ? "<hr/>" : l ? `<p>${l.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/_(.+?)_/g, "<i>$1</i>").replace(/\*(.+?)\*/g, "<i>$1</i>")}</p>` : "").join("\n");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(p.title)}</title><style>body{font:15px/1.6 Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;color:#111}h1{font:600 26px/1.2 system-ui}h2{font:600 18px system-ui;margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:4px}h3{font:600 15px system-ui}p{margin:6px 0}</style></head><body>${html}<script>setTimeout(()=>print(),300)</script></body></html>`);
    w.document.close();
  }

  if (!p) return <Loading />;
  const set = (patch: Partial<Project>) => { setP({ ...p, ...patch }); setSaving("idle"); };

  return (
    <div>
      <Link href="/research" className="text-xs text-dim hover:text-ink">← Investigações</Link>
      <input className="font-display mt-2 w-full bg-transparent text-2xl outline-none sm:text-3xl" value={p.title} onChange={(e) => set({ title: e.target.value })} aria-label="Título da investigação" />

      {!structured && (
        <p className="mt-3 rounded-2xl border border-warn/40 bg-warn/5 p-3 text-sm text-dim">Os campos estruturados (justificativa, metodologia, limitações…) precisam da migração <code className="font-mono text-xs">supabase/migrations/0002_research_structure.sql</code>. Rode-a no SQL Editor do Supabase e recarregue a página.</p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <section className="bento space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="label">Eixo</span>
                <select className="input mt-1" disabled={!structured} value={p.axis} onChange={(e) => set({ axis: e.target.value })}>
                  <option value="clima-saude">A · Clima, ambiente e saúde pública</option><option value="territorio">B · Clima, território e vulnerabilidade</option><option value="livre">Outro tema</option>
                </select></label>
              <label className="block"><span className="label">Status de revisão</span>
                <select className="input mt-1" disabled={!structured} value={p.review_status} onChange={(e) => set({ review_status: e.target.value })}>
                  <option value="rascunho">Rascunho — não revisado</option><option value="em-revisao">Em revisão</option><option value="revisado">Revisado por pesquisador(a)</option>
                </select></label>
            </div>
            <label className="block"><span className="label">Resumo</span><textarea className="input mt-1 min-h-[70px]" value={p.description} onChange={(e) => set({ description: e.target.value })} /></label>

            {SECTIONS.map((s) => s.key === "questions" ? (
              <div key={s.key}>
                <span className="label">{s.title}</span> <span className="text-[11px] text-faint">— {s.hint}</span>
                <ol className="mt-1 space-y-1.5">
                  {[...p.questions, ""].map((q, i) => (
                    <li key={i} className="flex items-center gap-2"><span className="readout w-5 text-xs text-faint">{i + 1}</span>
                      <input className="input" value={q} placeholder={i === p.questions.length ? "Nova pergunta…" : ""} onChange={(e) => { const qs = [...p.questions]; qs[i] = e.target.value; set({ questions: qs }); }} />
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <label key={s.key} className="block">
                <span className="label">{s.title}</span> <span className="text-[11px] text-faint">— {s.hint}</span>
                <textarea className="input mt-1 min-h-[80px]" disabled={!structured && s.key !== "hypothesis"} value={(p[s.key] as string) || ""} onChange={(e) => set({ [s.key]: e.target.value } as Partial<Project>)} />
              </label>
            ))}

            {structured && p.review_status !== "rascunho" && (
              <div className="grid gap-3 rounded-2xl bg-panel2/60 p-3 sm:grid-cols-[220px_1fr]">
                <label className="block"><span className="label">Revisor(a)</span><input className="input mt-1" value={p.reviewer_name} onChange={(e) => set({ reviewer_name: e.target.value })} placeholder="Nome e instituição" /></label>
                <label className="block"><span className="label">Parecer</span><textarea className="input mt-1 min-h-[60px]" value={p.reviewer_note} onChange={(e) => set({ reviewer_note: e.target.value })} /></label>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button className="btn-primary" onClick={save} disabled={saving === "saving"}>{saving === "saved" ? "Alterações salvas" : "Salvar alterações"}</button>
              <button className="btn" onClick={exportMd}><Download size={14} /> Relatório (.md)</button>
              <button className="btn" onClick={printReport}><Printer size={14} /> Imprimir / PDF</button>
              {err && <span className="text-xs text-bad">{err}</span>}
              <button className="ml-auto inline-flex items-center gap-1 text-xs text-dim hover:text-bad" onClick={deleteProject}><Trash2 size={13} /> Excluir investigação</button>
            </div>
          </section>

          {GROUPS.map(([label, types]) => {
            const list = items.filter((i) => types.includes(i.item_type));
            return (
              <section key={label} className="bento p-5">
                <h2 className="font-medium">{label} <span className="text-xs text-dim">({list.length})</span></h2>
                {list.length === 0 ? <p className="mt-2 text-sm text-dim">Nada salvo aqui. Use “Adicionar à pesquisa” nas análises, mapas e resultados de busca.</p> : (
                  <ul className="mt-2 divide-y divide-line">
                    {list.map((it) => (
                      <li key={it.id} className="flex items-start gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">{it.title}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-dim">
                            {it.provenance?.kind && <KindTag kind={it.provenance.kind} />}
                            {it.source === "ASTRAE" && <span className="rounded border border-warn/50 px-1 text-[10.5px] text-warn">gerado pela plataforma</span>}
                            <span>{it.source}{it.institution ? ` · ${it.institution}` : ""}</span>
                            {it.provenance?.period && <span>Período: {it.provenance.period}</span>}
                            {it.provenance?.accessedAt && <span>Acesso: {new Date(it.provenance.accessedAt).toLocaleDateString("pt-BR")}</span>}
                          </p>
                        </div>
                        <a href={it.original_url} target="_blank" rel="noreferrer" className="text-accent" aria-label="Fonte original"><ExternalLink size={14} /></a>
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
          <section className="bento p-5">
            <div className="flex items-center justify-between"><h2 className="font-medium">Notas</h2><button className="btn text-xs" onClick={newNote}>Nova nota</button></div>
            {notes.length === 0 ? <p className="mt-2 text-sm text-dim">Nenhuma nota vinculada.</p> : (
              <ul className="mt-2 space-y-1">{notes.map((n) => <li key={n.id}><Link href={`/notebook?note=${n.id}`} className="block rounded-xl px-2 py-1 text-sm hover:bg-panel2">{n.title}<span className="block text-[11px] text-faint">{new Date(n.updated_at).toLocaleDateString("pt-BR")}</span></Link></li>)}</ul>
            )}
          </section>
          <section className="bento p-5 text-sm">
            <h2 className="font-medium">Fontes salvas</h2>
            <ol className="mt-2 list-decimal space-y-2 pl-4 text-xs text-dim">
              {items.map((it) => <li key={it.id}>{it.institution || it.source}. <em>{it.provenance?.dataset || it.title}</em>. Disponível em: {it.original_url}. Acesso em: {it.provenance?.accessedAt ? new Date(it.provenance.accessedAt).toLocaleDateString("pt-BR") : "—"}.</li>)}
            </ol>
          </section>
          <section className="bento p-5 text-xs leading-relaxed text-dim">
            <h2 className="text-sm font-medium text-ink">Boas práticas</h2>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Delimite a pergunta: lugar, período, população e desfecho.</li>
              <li>Cite só referências que você leu; a plataforma não sugere bibliografia.</li>
              <li>Resultados gerados pela plataforma são exploratórios até alguém revisar.</li>
              <li>Escreva “associação”, não “causa”, a menos que o desenho permita.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function ResearchDetail() {
  return <RequireAccount><Detail /></RequireAccount>;
}
