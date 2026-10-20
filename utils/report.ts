/**
 * Relatório estruturado de uma investigação (Markdown).
 * Separa o que foi escrito pelos pesquisadores do que foi gerado pela plataforma,
 * e declara o status de revisão. Referências vêm só dos itens efetivamente salvos.
 */
export interface ReportProject {
  title: string; description: string; questions: string[]; justification: string; hypothesis: string; objectives: string;
  data_sources: string; methodology: string; results: string; limitations: string; references_text: string; next_steps: string;
  review_status?: string; reviewer_name?: string; reviewer_note?: string; reviewed_at?: string | null;
}
export interface ReportItem { item_type: string; title: string; source: string; institution: string | null; original_url: string; provenance: { dataset?: string; accessedAt?: string; period?: string; kind?: string; methodology?: string }; payload: Record<string, unknown> | null }

export const SECTIONS: { key: keyof ReportProject; title: string; hint: string }[] = [
  { key: "questions", title: "Pergunta de pesquisa", hint: "Delimitada: população, lugar, período e desfecho." },
  { key: "justification", title: "Justificativa", hint: "Por que a pergunta importa e o que já se sabe (com referências reais)." },
  { key: "hypothesis", title: "Hipótese", hint: "O que você espera observar e por quê — uma afirmação testável." },
  { key: "objectives", title: "Objetivos", hint: "Geral e específicos." },
  { key: "data_sources", title: "Fontes de dados", hint: "Bases, variáveis, cobertura, resolução e data de acesso." },
  { key: "methodology", title: "Metodologia", hint: "Desenho, unidade de análise, tratamento de faltantes, métodos estatísticos." },
  { key: "results", title: "Resultados exploratórios", hint: "O que os dados mostraram — sem extrapolar para causa." },
  { key: "limitations", title: "Limitações", hint: "Vieses, resolução, qualidade da notificação, fatores não controlados." },
  { key: "references_text", title: "Referências", hint: "Somente obras que você leu. As fontes de dados salvas entram automaticamente." },
  { key: "next_steps", title: "Próximas etapas", hint: "O que fazer a seguir e quem poderia orientar." }
];

const REVIEW: Record<string, string> = { rascunho: "Rascunho — não revisado", "em-revisao": "Em revisão", revisado: "Revisado por pesquisador(a)" };
const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

function analysisSummary(it: ReportItem): string | null {
  const a = (it.payload as { analysis?: { params?: Record<string, unknown>; weeks?: number; peakRaw?: { lag: number; r: number | null; n: number } | null; peakDeseasonalized?: { lag: number; r: number | null; n: number } | null } } | null)?.analysis;
  if (!a) return null;
  const f = (p?: { lag: number; r: number | null; n: number } | null) => (p && p.r != null ? `r = ${p.r.toFixed(2)} na defasagem de ${p.lag} semanas (n = ${p.n})` : "sem estimativa");
  return `${a.weeks ?? "?"} semanas analisadas; maior correlação nas séries brutas: ${f(a.peakRaw)}; sem sazonalidade média: ${f(a.peakDeseasonalized)}.`;
}

export function buildReport(p: ReportProject, items: ReportItem[], now = new Date()) {
  const L: string[] = [];
  L.push(`# ${p.title}`, "");
  L.push(`Status: **${REVIEW[p.review_status || "rascunho"] || p.review_status}**${p.reviewer_name ? ` · Revisão: ${p.reviewer_name} (${date(p.reviewed_at)})` : ""}  `);
  L.push(`Relatório gerado pela ASTRAE em ${now.toLocaleString("pt-BR")}. A ASTRAE é uma iniciativa independente, sem vínculo institucional.`, "");
  if (p.description) L.push(p.description, "");
  for (const s of SECTIONS) {
    L.push(`## ${s.title}`, "");
    if (s.key === "questions") {
      const qs = p.questions.filter(Boolean);
      L.push(qs.length ? qs.map((q, i) => `${i + 1}. ${q}`).join("\n") : "_Não preenchido._", "");
    } else if (s.key === "results") {
      L.push((p.results as string) || "_Não preenchido._", "");
      const gen = items.map((it) => ({ it, s: analysisSummary(it) })).filter((x) => x.s);
      if (gen.length) {
        L.push("### Resultados gerados pela plataforma (exploratórios, não revisados automaticamente)", "");
        gen.forEach(({ it, s }) => L.push(`- **${it.title}** — ${s} Método: ${it.provenance.methodology || "ver item salvo"}`));
        L.push("");
      }
    } else if (s.key === "references_text") {
      L.push((p.references_text as string) || "_Nenhuma referência bibliográfica registrada._", "");
      if (items.length) {
        L.push("### Fontes de dados e materiais salvos", "");
        items.forEach((it, i) => L.push(`${i + 1}. ${it.institution || it.source}. *${it.provenance.dataset || it.title}*. Disponível em: ${it.original_url}. Acesso em: ${date(it.provenance.accessedAt)}.`));
        L.push("");
      }
    } else {
      L.push((p[s.key] as string) || "_Não preenchido._", "");
    }
  }
  if (p.reviewer_note) L.push("## Parecer da revisão", "", p.reviewer_note, "");
  L.push("---", "Conteúdo escrito pelos autores da investigação, exceto onde indicado como “gerado pela plataforma”. Associações estatísticas descritas aqui não estabelecem causalidade.");
  return L.join("\n");
}
