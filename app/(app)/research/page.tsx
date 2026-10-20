"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/AppShell";
import { RequireAccount } from "@/components/research/RequireAccount";
import { Empty, Loading } from "@/components/ui/DataState";
import { useUser } from "@/hooks/useUser";

/** Protocolo do estudo piloto — plano de pesquisa, sem resultados (estes vêm da análise salva). */
const PILOT = {
  title: "Piloto — Temperatura e dengue em Campinas (SP), 2015–2025",
  description: "Investigação exploratória do Eixo A: associação entre temperatura semanal e casos notificados de dengue em Campinas.",
  questions: ["A temperatura semanal está associada aos casos notificados de dengue nas semanas seguintes (defasagem de 0 a 12 semanas) em Campinas, entre 2015 e 2025?"],
  hypothesis: "Semanas mais quentes precedem aumento de casos notificados, com defasagem de algumas semanas, e parte da associação permanece após remover a sazonalidade média.",
  structured: {
    axis: "clima-saude",
    objectives: "Geral: descrever a relação temporal entre temperatura e notificações de dengue em Campinas. Específicos: (1) caracterizar a sazonalidade das duas séries; (2) estimar correlações com defasagem de 0 a 12 semanas, brutas e sem sazonalidade; (3) documentar limitações dos dados para orientar um estudo com mortalidade e internações.",
    data_sources: "InfoDengue (Fiocruz/FGV) — casos notificados por semana epidemiológica, município 3509502. NASA POWER — T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M diários (reanálise MERRA-2) no centróide da malha municipal do IBGE. IBGE — malha municipal e código do município.",
    methodology: "Desenho ecológico de séries temporais. Unidade: semana epidemiológica. Clima diário agregado por semana (média; chuva somada), semana sem clima se < 5 dias válidos. Desfecho: log(1 + casos). Correlação de Spearman entre clima em t e casos em t + k (k = 0…12), nas séries brutas e após subtrair a média de cada semana epidemiológica. Sem testes de significância (séries autocorrelacionadas). Reprodução: página Clima e Saúde, configuração do piloto.",
    limitations: "Associação não é causalidade. Clima de reanálise (~50 km), não de estação. Notificação varia com a vigilância, epidemias, sorotipos e imunidade da população, não controlados. Semanas recentes são revisadas pela fonte.",
    next_steps: "Rodar a análise e salvar o resultado nesta investigação; pedir revisão metodológica; incluir mortalidade (SIM) e internações (SIH) com o roteiro em scripts/datasus/; comparar com estação do INMET."
  }
};

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

  async function createPilot() {
    setErr(null);
    const base = { title: PILOT.title, description: PILOT.description, hypothesis: PILOT.hypothesis, questions: PILOT.questions };
    let { error } = await sb!.from("projects").insert({ ...base, ...PILOT.structured });
    if (error && /column/i.test(error.message)) ({ error } = await sb!.from("projects").insert(base)); // migração 0002 ainda não aplicada
    if (error) setErr(error.message); else load();
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <form onSubmit={create} className="flex w-full max-w-xl gap-2">
          <input className="input" placeholder="Nova investigação — ex.: Calor e internações em idosos" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Título da investigação" />
          <button className="btn-primary shrink-0" disabled={!title.trim()}>Criar</button>
        </form>
        <button className="btn" onClick={createPilot}>Criar a partir do protocolo do piloto (Campinas)</button>
      </div>
      {err && <p className="mb-3 text-sm text-bad">{err}</p>}
      {list === null && <Loading />}
      {list?.length === 0 && <Empty>Nenhuma investigação ainda. Crie a primeira acima ou comece pelo protocolo do piloto.</Empty>}
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
      <PageHeader title="Investigações" subtitle="Pergunta, justificativa, hipótese, objetivos, fontes, método, resultados, limitações, referências e próximas etapas — com relatório exportável. Privadas por padrão." />
      <RequireAccount><Projects /></RequireAccount>
    </div>
  );
}
