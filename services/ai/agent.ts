import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { SourceRegistry, TOOLS, runTool, type ConsultedSource } from "./tools";
import { sanitizeCitations } from "./citations";
import { fetchJson } from "@/lib/http";

/**
 * O ASTRAE AI funciona com dois provedores, escolhidos pela chave configurada no servidor:
 *  - Google Gemini (GEMINI_API_KEY) — tem plano gratuito nos modelos Flash;
 *  - Anthropic Claude (ANTHROPIC_API_KEY) — pago por uso.
 * Com as duas chaves, AI_PROVIDER ("gemini" | "anthropic") decide; sem ele, usa o Gemini.
 * As regras de integridade (só dados das ferramentas + verificação de citações) são as mesmas.
 */
export type Provider = "gemini" | "anthropic";

export function aiProvider(): Provider | null {
  const g = Boolean(process.env.GEMINI_API_KEY), a = Boolean(process.env.ANTHROPIC_API_KEY);
  const pref = process.env.AI_PROVIDER;
  if (pref === "anthropic" && a) return "anthropic";
  if (pref === "gemini" && g) return "gemini";
  return g ? "gemini" : a ? "anthropic" : null;
}
export const aiConfigured = () => aiProvider() !== null;

/** Modelos padrão: Gemini Flash estável recomendado pelo Google para novos projetos; Opus recomendado pela Anthropic. */
export function aiModel(p: Provider | null = aiProvider()) {
  if (p === "gemini") return process.env.GEMINI_MODEL || "gemini-3.8-flash";
  if (p === "anthropic") return process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
  return "";
}

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
  provider: Provider;
  removedCitations: string[];
  usage: { input_tokens: number; output_tokens: number };
}

const MAX_STEPS = 8;
const LIMIT_MSG = "Não consegui concluir a análise dentro do limite de consultas. Reformule a pergunta de forma mais específica.";

/** Executa uma chamada de ferramenta e registra no rastro — comum aos dois provedores. */
async function execTool(name: string, input: Record<string, unknown>, reg: SourceRegistry, trace: ToolTrace[]) {
  const t0 = Date.now();
  try {
    const out = await runTool(name, input, reg);
    trace.push({ tool: name, input, ok: true, ms: Date.now() - t0 });
    return { ok: true as const, out };
  } catch (e) {
    const msg = (e as Error).message;
    trace.push({ tool: name, input, ok: false, error: msg, ms: Date.now() - t0 });
    return { ok: false as const, error: `Data source temporarily unavailable: ${msg}` };
  }
}

function finish(finalText: string, reg: SourceRegistry, trace: ToolTrace[], model: string, provider: Provider, usage: AgentAnswer["usage"]): AgentAnswer {
  // Verificação de integridade: remove citações a fontes que não foram de fato consultadas.
  const { answer, removed, cited } = sanitizeCitations(finalText, new Set(reg.list.map((s) => s.id)));
  return { answer, sources: reg.list.map((s) => ({ ...s, cited: cited.has(s.id) })), trace, model, provider, removedCitations: removed, usage };
}

/* ───────────────────────── Anthropic ───────────────────────── */

export type MessagesClient = { messages: { create: (p: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message> } };

export async function askWithAnthropic(history: ChatTurn[], client: MessagesClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })): Promise<AgentAnswer> {
  const model = aiModel("anthropic");
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
      const r = await execTool(u.name, (u.input || {}) as Record<string, unknown>, reg, trace);
      return r.ok
        ? { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(r.out) }
        : { type: "tool_result", tool_use_id: u.id, content: r.error, is_error: true };
    }));
    messages.push({ role: "user", content: results });
    if (step === MAX_STEPS - 1) finalText ||= LIMIT_MSG;
  }
  return finish(finalText, reg, trace, model, "anthropic", usage);
}

/* ───────────────────────── Google Gemini ───────────────────────── */
// REST generateContent: https://ai.google.dev/api/generate-content

interface GeminiPart { text?: string; thought?: boolean; functionCall?: { name: string; args?: Record<string, unknown>; id?: string }; [k: string]: unknown }
interface GeminiContent { role: "user" | "model"; parts: GeminiPart[] }
interface GeminiResponse {
  candidates?: { content?: GeminiContent; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}
export type GeminiCaller = (model: string, body: unknown) => Promise<GeminiResponse>;

/** Converte o JSON Schema das ferramentas para o subconjunto aceito pelo Gemini. */
function geminiSchema(s: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ["type", "description", "enum", "required"]) if (s[k] !== undefined) out[k] = s[k];
  if (s.items) out.items = geminiSchema(s.items as Record<string, unknown>);
  if (s.properties) out.properties = Object.fromEntries(Object.entries(s.properties as Record<string, Record<string, unknown>>).map(([k, v]) => [k, geminiSchema(v)]));
  return out;
}

export const GEMINI_TOOLS = [{
  functionDeclarations: TOOLS.map((t) => {
    const params = t.input_schema as unknown as Record<string, unknown>;
    const hasProps = params.properties && Object.keys(params.properties as object).length > 0;
    // ferramentas sem argumentos são declaradas sem "parameters" (objeto vazio é rejeitado)
    return hasProps ? { name: t.name, description: t.description, parameters: geminiSchema(params) } : { name: t.name, description: t.description };
  })
}];

const callGeminiRest: GeminiCaller = (model, body) =>
  fetchJson<GeminiResponse>(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY || "" },
    body: JSON.stringify(body),
    timeoutMs: 50000
  });

export async function askWithGemini(history: ChatTurn[], call: GeminiCaller = callGeminiRest): Promise<AgentAnswer> {
  const model = aiModel("gemini");
  const reg = new SourceRegistry();
  const trace: ToolTrace[] = [];
  const usage = { input_tokens: 0, output_tokens: 0 };
  const contents: GeminiContent[] = history.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] }));

  let finalText = "";
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await call(model, {
      systemInstruction: { parts: [{ text: system() }] },
      contents,
      tools: GEMINI_TOOLS,
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      generationConfig: { maxOutputTokens: 4096 }
    });
    usage.input_tokens += res.usageMetadata?.promptTokenCount ?? 0;
    usage.output_tokens += res.usageMetadata?.candidatesTokenCount ?? 0;
    const content = res.candidates?.[0]?.content;
    if (!content) {
      const why = res.promptFeedback?.blockReason || res.candidates?.[0]?.finishReason || "resposta vazia";
      throw new Error(`O Gemini não retornou resposta (${why}).`);
    }
    const parts = content.parts || [];
    finalText = parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("\n").trim();
    const calls = parts.filter((p) => p.functionCall);
    if (calls.length === 0) break;

    // devolve o turno do modelo sem alterações (preserva assinaturas de raciocínio exigidas pelo Gemini)
    contents.push({ role: "model", parts });
    const responses = await Promise.all(calls.map(async (p) => {
      const fc = p.functionCall!;
      const r = await execTool(fc.name, fc.args || {}, reg, trace);
      return { functionResponse: { name: fc.name, ...(fc.id ? { id: fc.id } : {}), response: r.ok ? { result: r.out } : { error: r.error } } };
    }));
    contents.push({ role: "user", parts: responses });
    if (step === MAX_STEPS - 1) finalText ||= LIMIT_MSG;
  }
  return finish(finalText, reg, trace, model, "gemini", usage);
}

/* ───────────────────────── Entrada única ───────────────────────── */

export async function askAstrae(history: ChatTurn[]): Promise<AgentAnswer> {
  const p = aiProvider();
  if (p === "gemini") return askWithGemini(history);
  if (p === "anthropic") return askWithAnthropic(history);
  throw new Error("Nenhum provedor de IA configurado.");
}
