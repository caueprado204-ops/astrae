import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { SourceRegistry, TOOLS, runTool, type ConsultedSource } from "./tools";
import { sanitizeCitations } from "./citations";

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);
/** Modelo padrão recomendado pela documentação da Anthropic; ajustável por ANTHROPIC_MODEL. */
export const aiModel = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

const system = () => `Você é o ASTRAE AI, assistente científico da plataforma ASTRAE (Advanced Space & Earth Research Environment).

Regras de integridade — obrigatórias:
1. Responda SOMENTE com base nos dados devolvidos pelas ferramentas nesta conversa. Consulte as ferramentas antes de afirmar qualquer número, data, status ou tendência.
2. Cite cada afirmação baseada em dado com o identificador da fonte entre colchetes, ex.: [S1] ou [S2, S4]. Use apenas identificadores (source_id) que aparecem nos resultados das ferramentas. Nunca invente referências, autores, artigos, links ou números.
3. Explicações de mecanismos físicos precisam de apoio em resultados de search_nasa_reports (cite o relatório). Se não houver apoio, diga explicitamente que a plataforma não tem evidência carregada para essa parte, em vez de completar com conhecimento próprio.
4. Sempre deixe claro o tipo de dado: OBSERVADO, PREVISÃO, MODELO/reanálise, ÍNDICE ou CATÁLOGO. Nunca misture previsão com observação. Dados do NASA POWER são reanálise (modelo), não medições de estação.
5. Informe unidade, local e período dos números que usar. Se fizer contas (médias, diferenças), mostre de quais valores partiu.
6. Se uma ferramenta falhar ou não houver dados, diga isso claramente e sugira onde o usuário pode verificar na ASTRAE (Climate, ENSO, Mars, Data Explorer, Search).
7. Correlação não é causalidade: ao comparar anos de El Niño/La Niña com chuva ou temperatura em um ponto, apresente como associação observada nos dados consultados, com o tamanho da amostra.

Estilo: responda no idioma do usuário, em texto corrido e objetivo, com listas curtas só quando ajudarem. Termine com uma linha "Limitações:" quando houver ressalvas relevantes. Não repita a lista de fontes no final — a interface já a exibe.

Contexto: a data de hoje é ${new Date().toISOString().slice(0, 10)}. Para localizar pontos no Brasil use coordenadas conhecidas das cidades (ex.: Porto Alegre ≈ -30.03, -51.23; Belém ≈ -1.46, -48.49); informe ao usuário quais coordenadas usou.`;

export interface ChatTurn { role: "user" | "assistant"; content: string }
export interface ToolTrace { tool: string; input: unknown; ok: boolean; error?: string; ms: number }
export interface AgentAnswer {
  answer: string;
  sources: (ConsultedSource & { cited: boolean })[];
  trace: ToolTrace[];
  model: string;
  removedCitations: string[];
  usage: { input_tokens: number; output_tokens: number };
}

const MAX_STEPS = 8;

type MessagesClient = { messages: { create: (p: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message> } };

export async function askAstrae(history: ChatTurn[], client: MessagesClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })): Promise<AgentAnswer> {
  const model = aiModel();
  const reg = new SourceRegistry();
  const trace: ToolTrace[] = [];
  const usage = { input_tokens: 0, output_tokens: 0 };
  const messages: Anthropic.MessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));

  let finalText = "";
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.messages.create({ model, max_tokens: 4096, system: system(), tools: TOOLS, messages });
    usage.input_tokens += res.usage.input_tokens;
    usage.output_tokens += res.usage.output_tokens;
    finalText = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    if (res.stop_reason !== "tool_use") break;

    messages.push({ role: "assistant", content: res.content });
    const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const results = await Promise.all(uses.map(async (u): Promise<Anthropic.ToolResultBlockParam> => {
      const t0 = Date.now();
      try {
        const out = await runTool(u.name, (u.input || {}) as Record<string, unknown>, reg);
        trace.push({ tool: u.name, input: u.input, ok: true, ms: Date.now() - t0 });
        return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out) };
      } catch (e) {
        const msg = (e as Error).message;
        trace.push({ tool: u.name, input: u.input, ok: false, error: msg, ms: Date.now() - t0 });
        return { type: "tool_result", tool_use_id: u.id, content: `Data source temporarily unavailable: ${msg}`, is_error: true };
      }
    }));
    messages.push({ role: "user", content: results });
    if (step === MAX_STEPS - 1) finalText ||= "Não consegui concluir a análise dentro do limite de consultas. Reformule a pergunta de forma mais específica.";
  }

  // Verificação de integridade: remove citações a fontes que não foram de fato consultadas.
  const { answer, removed, cited } = sanitizeCitations(finalText, new Set(reg.list.map((s) => s.id)));
  return { answer, sources: reg.list.map((s) => ({ ...s, cited: cited.has(s.id) })), trace, model, removedCitations: removed, usage };
}
