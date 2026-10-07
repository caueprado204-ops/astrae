"use client";
import { useEffect, useState } from "react";
import { BookmarkPlus, Check, FolderPlus, X } from "lucide-react";
import type { DataKind, Provenance } from "@/types/science";
import { useUser } from "@/hooks/useUser";

export interface SavePayload {
  externalId: string;
  title: string;
  itemType: "dataset" | "timeseries" | "image" | "map" | "article" | "document" | "chart" | "reference" | "video";
  source: string;
  institution?: string;
  kind: DataKind;
  originalUrl: string;
  provenance: Partial<Provenance>;
  payload?: Record<string, unknown>;
}

interface Project { id: string; title: string }

/** Botões "Salvar" (saved_datasets) e "Adicionar à pesquisa" (research_items). */
export function SaveActions({ item, compact = false }: { item: SavePayload; compact?: boolean }) {
  const { user, configured, sb } = useUser();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const prov = { accessedAt: new Date().toISOString(), ...item.provenance, source: item.source, kind: item.kind, originalUrl: item.originalUrl };

  async function saveDataset() {
    if (!sb || !user) { setMsg(configured ? "Entre na sua conta para salvar." : "Configure o Supabase para salvar dados."); return; }
    const { error } = await sb.from("saved_datasets").upsert({
      external_id: item.externalId, title: item.title, source: item.source, institution: item.institution,
      kind: item.kind, original_url: item.originalUrl, provenance: prov
    }, { onConflict: "user_id,external_id" });
    if (error) setMsg(error.message); else { setSaved(true); setMsg(null); }
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <button className="btn text-xs" onClick={saveDataset} aria-label="Salvar">
        {saved ? <Check size={13} className="text-ok" /> : <BookmarkPlus size={13} />} {saved ? "Salvo" : "Salvar"}
      </button>
      <button className="btn text-xs" onClick={() => (user ? setOpen(true) : setMsg(configured ? "Entre na sua conta para usar projetos." : "Configure o Supabase para usar projetos."))}>
        <FolderPlus size={13} /> {compact ? "Pesquisa" : "Adicionar à pesquisa"}
      </button>
      {msg && <span className="text-xs text-warn">{msg}</span>}
      {open && <ProjectPicker item={{ ...item, provenance: prov }} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ProjectPicker({ item, onClose }: { item: SavePayload; onClose: () => void }) {
  const { sb } = useUser();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    sb?.from("projects").select("id,title").order("updated_at", { ascending: false }).then(({ data, error }) => {
      if (error) setErr(error.message); else setProjects(data || []);
    });
  }, [sb]);

  async function add(projectId: string, title: string) {
    if (!sb) return;
    const { error } = await sb.from("research_items").insert({
      project_id: projectId, item_type: item.itemType, title: item.title, source: item.source,
      institution: item.institution, original_url: item.originalUrl, provenance: item.provenance, payload: item.payload ?? null
    });
    if (error) setErr(error.message); else setDone(title);
  }

  async function createAndAdd() {
    if (!sb || !newTitle.trim()) return;
    const { data, error } = await sb.from("projects").insert({ title: newTitle.trim() }).select("id,title").single();
    if (error || !data) { setErr(error?.message || "Erro ao criar projeto"); return; }
    await add(data.id, data.title);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Adicionar à pesquisa" className="fixed inset-0 z-50 grid place-items-center bg-bg/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="panel w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg">Salvar em um projeto</h3>
          <button onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-dim">{item.title}</p>
        {done ? (
          <p className="mt-5 flex items-center gap-2 text-sm text-ok"><Check size={16} /> Adicionado a “{done}”.</p>
        ) : (
          <>
            <ul className="mt-4 max-h-56 space-y-1 overflow-auto">
              {projects === null && <li className="text-sm text-dim">Carregando projetos…</li>}
              {projects?.length === 0 && <li className="text-sm text-dim">Você ainda não tem projetos. Crie o primeiro abaixo.</li>}
              {projects?.map((p) => (
                <li key={p.id}><button className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-panel2" onClick={() => add(p.id, p.title)}>{p.title}</button></li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <input className="input" placeholder="Novo projeto, ex.: Atmosfera de Marte" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createAndAdd()} />
              <button className="btn-primary shrink-0" onClick={createAndAdd} disabled={!newTitle.trim()}>Criar e salvar</button>
            </div>
          </>
        )}
        {err && <p className="mt-3 text-xs text-bad">{err}</p>}
      </div>
    </div>
  );
}
