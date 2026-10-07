"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell/AppShell";
import { RequireAccount } from "@/components/research/RequireAccount";
import { Empty, Loading } from "@/components/ui/DataState";
import { useUser } from "@/hooks/useUser";
import { type Block, CHART_SOURCES, ChartBlockView, MapBlockView, newBlock, uid, type ChartSource } from "@/components/notebook/blocks";
import { REGIONS } from "@/components/maps/gibs-client";

interface Note { id: string; title: string; blocks: Block[]; project_id: string | null; updated_at: string }
interface SavedRef { id: string; title: string; institution: string | null; source: string; original_url: string; provenance: { dataset?: string; accessedAt?: string } }

const SECTIONS = ["Observação", "Metodologia", "Resultados", "Discussão", "Conclusão"];
const BLOCK_MENU: [Block["type"], string][] = [
  ["heading", "Título"], ["subheading", "Subtítulo"], ["text", "Texto"], ["list", "Lista"], ["table", "Tabela"],
  ["image", "Imagem"], ["chart", "Gráfico"], ["map", "Mapa"], ["link", "Link"], ["reference", "Referência"]
];
const MAP_VARS: [string, string][] = [["sst_anomaly", "Anomalia de TSM"], ["sst", "TSM"], ["temperature", "Temperatura do ar"], ["precipitation", "Precipitação"], ["clouds", "Nuvens"], ["aerosols", "Aerossóis"], ["truecolor", "Cor verdadeira"]];

function Editor() {
  const { sb } = useUser();
  const router = useRouter();
  const noteId = useSearchParams().get("note");
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [tags, setTags] = useState("");
  const [refs, setRefs] = useState<SavedRef[]>([]);
  const [status, setStatus] = useState<"saved" | "saving" | "dirty">("saved");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const loadList = useCallback(() => sb!.from("notes").select("id,title,blocks,project_id,updated_at").order("updated_at", { ascending: false })
    .then(({ data }) => setNotes((data as Note[]) || [])), [sb]);

  useEffect(() => {
    loadList();
    sb!.from("projects").select("id,title").then(({ data }) => setProjects(data || []));
    sb!.from("saved_datasets").select("id,title,institution,source,original_url,provenance").order("created_at", { ascending: false }).limit(50).then(({ data }) => setRefs((data as SavedRef[]) || []));
  }, [sb, loadList]);

  useEffect(() => {
    if (!notes) return;
    const n = notes.find((x) => x.id === noteId) || null;
    setNote(n);
    if (n) sb!.from("note_tags").select("tags(name)").eq("note_id", n.id).then(({ data }) => setTags(((data as unknown as { tags: { name: string } }[]) || []).map((t) => t.tags.name).join(", ")));
  }, [noteId, notes, sb]);

  function update(patch: Partial<Note>) {
    if (!note) return;
    const next = { ...note, ...patch };
    setNote(next); setStatus("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("saving");
      await sb!.from("notes").update({ title: next.title, blocks: next.blocks, project_id: next.project_id }).eq("id", next.id);
      setStatus("saved");
      setNotes((list) => list?.map((x) => (x.id === next.id ? next : x)) || null);
    }, 800);
  }

  async function saveTags() {
    if (!note) return;
    const names = Array.from(new Set(tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)));
    await sb!.from("note_tags").delete().eq("note_id", note.id);
    for (const name of names) {
      const { data } = await sb!.from("tags").upsert({ name }, { onConflict: "user_id,name" }).select("id").single();
      if (data) await sb!.from("note_tags").insert({ note_id: note.id, tag_id: data.id });
    }
  }

  async function create(withTemplate: boolean) {
    const blocks: Block[] = withTemplate ? SECTIONS.flatMap((s) => [{ id: uid(), type: "heading" as const, text: s }, { id: uid(), type: "text" as const, text: "" }]) : [{ id: uid(), type: "text", text: "" }];
    const { data } = await sb!.from("notes").insert({ title: withTemplate ? "Relatório de pesquisa" : "Nova página", blocks }).select("id").single();
    await loadList();
    if (data) router.push(`/notebook?note=${data.id}`);
  }

  async function remove() {
    if (!note || !confirm("Excluir esta página?")) return;
    await sb!.from("notes").delete().eq("id", note.id);
    await loadList();
    router.push("/notebook");
  }

  const setBlock = (i: number, b: Block) => update({ blocks: note!.blocks.map((x, j) => (j === i ? b : x)) });
  const move = (i: number, d: -1 | 1) => { const bs = [...note!.blocks]; const j = i + d; if (j < 0 || j >= bs.length) return; [bs[i], bs[j]] = [bs[j], bs[i]]; update({ blocks: bs }); };
  const insert = (i: number, type: Block["type"]) => { const bs = [...note!.blocks]; bs.splice(i + 1, 0, newBlock(type)); update({ blocks: bs }); };

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="panel h-fit p-3">
        <div className="flex gap-1.5"><button className="btn flex-1 justify-center text-xs" onClick={() => create(false)}>Nova página</button><button className="btn flex-1 justify-center text-xs" onClick={() => create(true)} title="Observação, Metodologia, Resultados, Discussão, Conclusão">Com modelo</button></div>
        {notes === null && <Loading />}
        <ul className="mt-3 space-y-0.5">
          {notes?.map((n) => (
            <li key={n.id}><button onClick={() => router.push(`/notebook?note=${n.id}`)} className={`w-full rounded px-2 py-1.5 text-left text-sm ${n.id === noteId ? "bg-panel2 text-ink" : "text-dim hover:text-ink"}`}>{n.title || "Sem título"}</button></li>
          ))}
        </ul>
      </aside>

      <section className="min-w-0">
        {!note && <Empty>Escolha uma página ou crie uma nova. O modelo já traz Observação, Metodologia, Resultados, Discussão e Conclusão.</Empty>}
        {note && (
          <article className="panel p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-3 text-xs text-dim">
              <select className="input w-auto py-1 text-xs" value={note.project_id || ""} onChange={(e) => update({ project_id: e.target.value || null })} aria-label="Projeto">
                <option value="">Sem projeto</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <input className="input w-56 py-1 text-xs" placeholder="tags, separadas por vírgula" value={tags} onChange={(e) => setTags(e.target.value)} onBlur={saveTags} aria-label="Tags" />
              <span className="ml-auto">{status === "saved" ? "Salvo" : status === "saving" ? "Salvando…" : "Alterações não salvas"}</span>
              <button onClick={remove} className="hover:text-bad" aria-label="Excluir página"><Trash2 size={14} /></button>
            </div>
            <input className="font-display mt-4 w-full bg-transparent text-3xl outline-none" value={note.title} onChange={(e) => update({ title: e.target.value })} aria-label="Título da página" />

            <div className="mt-6 space-y-3">
              {note.blocks.map((b, i) => (
                <div key={b.id} className="group relative rounded-md border border-transparent p-1 hover:border-line">
                  <div className="absolute -left-1 top-1 hidden -translate-x-full flex-col gap-0.5 pr-1 group-hover:flex">
                    <button onClick={() => move(i, -1)} aria-label="Mover para cima" className="text-faint hover:text-ink"><ArrowUp size={13} /></button>
                    <button onClick={() => move(i, 1)} aria-label="Mover para baixo" className="text-faint hover:text-ink"><ArrowDown size={13} /></button>
                    <button onClick={() => update({ blocks: note.blocks.filter((x) => x.id !== b.id) })} aria-label="Remover bloco" className="text-faint hover:text-bad"><Trash2 size={13} /></button>
                  </div>
                  <BlockEditor b={b} onChange={(nb) => setBlock(i, nb)} refs={refs} />
                  <AddMenu onAdd={(t) => insert(i, t)} />
                </div>
              ))}
              {note.blocks.length === 0 && <AddMenu always onAdd={(t) => update({ blocks: [newBlock(t)] })} />}
            </div>
          </article>
        )}
      </section>
    </div>
  );
}

function AddMenu({ onAdd, always }: { onAdd: (t: Block["type"]) => void; always?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${always ? "" : "hidden group-hover:block"} relative mt-1`}>
      <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-xs text-faint hover:text-ink"><Plus size={12} /> bloco</button>
      {open && (
        <div className="absolute z-20 mt-1 grid w-64 grid-cols-2 gap-1 rounded-md border border-line bg-panel p-2 shadow-lg">
          {BLOCK_MENU.map(([t, l]) => <button key={t} onClick={() => { onAdd(t); setOpen(false); }} className="rounded px-2 py-1 text-left text-xs hover:bg-panel2">{l}</button>)}
        </div>
      )}
    </div>
  );
}

const area = "w-full resize-none bg-transparent outline-none placeholder:text-faint";
function autoGrow(e: React.FormEvent<HTMLTextAreaElement>) { const t = e.currentTarget; t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; }

function BlockEditor({ b, onChange, refs }: { b: Block; onChange: (b: Block) => void; refs: SavedRef[] }) {
  switch (b.type) {
    case "heading": return <input className="font-display w-full bg-transparent text-xl outline-none" placeholder="Título" value={b.text} onChange={(e) => onChange({ ...b, text: e.target.value })} />;
    case "subheading": return <input className="w-full bg-transparent text-base font-medium outline-none" placeholder="Subtítulo" value={b.text} onChange={(e) => onChange({ ...b, text: e.target.value })} />;
    case "text": return <textarea rows={2} onInput={autoGrow} className={`${area} text-[15px] leading-relaxed`} placeholder="Escreva…" value={b.text} onChange={(e) => onChange({ ...b, text: e.target.value })} />;
    case "list": return (
      <ul className="list-disc space-y-1 pl-5">
        {b.items.map((it, i) => (
          <li key={i}><input className="w-full bg-transparent outline-none" value={it} placeholder="Item"
            onChange={(e) => onChange({ ...b, items: b.items.map((x, j) => (j === i ? e.target.value : x)) })}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const items = [...b.items]; items.splice(i + 1, 0, ""); onChange({ ...b, items }); } if (e.key === "Backspace" && !it && b.items.length > 1) { e.preventDefault(); onChange({ ...b, items: b.items.filter((_, j) => j !== i) }); } }} /></li>
        ))}
      </ul>
    );
    case "table": return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>{b.rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => (
              <td key={j} className="border border-line p-0"><input className={`w-full bg-transparent px-2 py-1 outline-none ${i === 0 ? "font-medium" : ""}`} value={c}
                onChange={(e) => onChange({ ...b, rows: b.rows.map((row, ri) => row.map((cell, ci) => (ri === i && ci === j ? e.target.value : cell))) })} /></td>
            ))}</tr>
          ))}</tbody>
        </table>
        <div className="mt-1 flex gap-3 text-xs text-faint">
          <button className="hover:text-ink" onClick={() => onChange({ ...b, rows: [...b.rows, b.rows[0].map(() => "")] })}>+ linha</button>
          <button className="hover:text-ink" onClick={() => onChange({ ...b, rows: b.rows.map((r) => [...r, ""]) })}>+ coluna</button>
          {b.rows.length > 1 && <button className="hover:text-ink" onClick={() => onChange({ ...b, rows: b.rows.slice(0, -1) })}>− linha</button>}
          {b.rows[0].length > 1 && <button className="hover:text-ink" onClick={() => onChange({ ...b, rows: b.rows.map((r) => r.slice(0, -1)) })}>− coluna</button>}
        </div>
      </div>
    );
    case "image": return (
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {b.url && <img src={b.url} alt={b.caption} className="max-h-[420px] rounded" />}
        <input className="input mt-2 text-xs" placeholder="URL da imagem (ex.: link de imagem da NASA)" value={b.url} onChange={(e) => onChange({ ...b, url: e.target.value })} />
        <input className="mt-1 w-full bg-transparent text-xs text-dim outline-none" placeholder="Legenda e crédito" value={b.caption} onChange={(e) => onChange({ ...b, caption: e.target.value })} />
      </figure>
    );
    case "link": return (
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-xs text-sm" placeholder="Texto do link" value={b.label} onChange={(e) => onChange({ ...b, label: e.target.value })} />
        <input className="input flex-1 text-sm" placeholder="https://" value={b.url} onChange={(e) => onChange({ ...b, url: e.target.value })} />
        {b.url && /^https?:\/\//.test(b.url) && <a href={b.url} target="_blank" rel="noreferrer" className="self-center text-sm text-accent">{b.label || b.url}</a>}
      </div>
    );
    case "reference": return (
      <div className="border-l-2 border-accent/60 pl-3">
        {refs.length > 0 && (
          <select className="input mb-1 py-1 text-xs" value="" onChange={(e) => {
            const r = refs.find((x) => x.id === e.target.value); if (!r) return;
            const acc = r.provenance?.accessedAt ? new Date(r.provenance.accessedAt).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR");
            onChange({ ...b, url: r.original_url, text: `${r.institution || r.source}. ${r.provenance?.dataset || r.title}. Disponível em: ${r.original_url}. Acesso em: ${acc}.` });
          }}>
            <option value="">Inserir de um dataset salvo…</option>
            {refs.map((r) => <option key={r.id} value={r.id}>{r.title.slice(0, 80)}</option>)}
          </select>
        )}
        <textarea rows={2} onInput={autoGrow} className={`${area} text-sm text-dim`} placeholder="Referência (autor/instituição, título, URL, data de acesso)" value={b.text} onChange={(e) => onChange({ ...b, text: e.target.value })} />
      </div>
    );
    case "chart": return (
      <div>
        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          <select className="input w-auto py-1 text-xs" value={b.source} onChange={(e) => onChange({ ...b, source: e.target.value as ChartSource })}>
            {Object.entries(CHART_SOURCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {b.source === "power" && (<>
            <input type="number" step="0.01" className="input w-24 py-1 text-xs" value={b.lat ?? -15.79} onChange={(e) => onChange({ ...b, lat: Number(e.target.value) })} aria-label="Latitude" />
            <input type="number" step="0.01" className="input w-24 py-1 text-xs" value={b.lon ?? -47.88} onChange={(e) => onChange({ ...b, lon: Number(e.target.value) })} aria-label="Longitude" />
            <select className="input w-auto py-1 text-xs" value={b.param ?? "T2M"} onChange={(e) => onChange({ ...b, param: e.target.value })}>
              {["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "PS", "RH2M", "WS10M", "ALLSKY_SFC_SW_DWN"].map((p) => <option key={p}>{p}</option>)}
            </select>
            <input type="date" className="input w-auto py-1 text-xs" value={b.start ?? "2025-01-01"} onChange={(e) => onChange({ ...b, start: e.target.value })} />
            <input type="date" className="input w-auto py-1 text-xs" value={b.end ?? ""} onChange={(e) => onChange({ ...b, end: e.target.value })} />
          </>)}
        </div>
        <ChartBlockView b={b} />
      </div>
    );
    case "map": return (
      <div>
        <div className="mb-2 flex flex-wrap gap-2">
          <select className="input w-auto py-1 text-xs" value={b.variable} onChange={(e) => onChange({ ...b, variable: e.target.value })}>{MAP_VARS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select className="input w-auto py-1 text-xs" value={b.region} onChange={(e) => onChange({ ...b, region: e.target.value })}>{Object.entries(REGIONS).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</select>
          <input type="date" className="input w-auto py-1 text-xs" value={b.date} onChange={(e) => e.target.value && onChange({ ...b, date: e.target.value })} />
        </div>
        <MapBlockView b={b} />
      </div>
    );
  }
}

export default function NotebookPage() {
  return (
    <div>
      <PageHeader title="ASTRAE Notebook" subtitle="Caderno científico: texto, listas, tabelas, imagens, gráficos e mapas ao vivo, links, referências e tags. Salva automaticamente." />
      <RequireAccount><Suspense><Editor /></Suspense></RequireAccount>
    </div>
  );
}
