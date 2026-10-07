import { test } from "node:test";
import assert from "node:assert/strict";
import { askWithAnthropic, askWithGemini, GEMINI_TOOLS } from "../services/ai/agent";

/** Loop do agente com cliente falso: sem rede, as ferramentas falham com elegância e citações não verificáveis são removidas. */
test("ASTRAE AI: loop de ferramentas e verificação de citações", async () => {
  const calls: unknown[] = [];
  let step = 0;
  const fake = {
    messages: {
      create: async (p: unknown) => {
        calls.push(p);
        step++;
        const usage = { input_tokens: 10, output_tokens: 5 };
        if (step === 1) return { content: [{ type: "tool_use", id: "t1", name: "get_mars_weather", input: { last_sols: 3 } }], stop_reason: "tool_use", usage } as never;
        return { content: [{ type: "text", text: "Não consegui obter os dados agora [S1]." }], stop_reason: "end_turn", usage } as never;
      }
    }
  };
  // força falha de rede previsível
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
  try {
    const r = await askWithAnthropic([{ role: "user", content: "Mostre os dados de temperatura de Marte." }], fake);
    assert.equal(r.trace.length, 1);
    assert.equal(r.trace[0].tool, "get_mars_weather");
    assert.equal(r.trace[0].ok, false);
    assert.deepEqual(r.removedCitations, ["S1"]);
    assert.equal(r.answer, "Não consegui obter os dados agora .");
    const second = calls[1] as { messages: { role: string; content: { type: string; is_error?: boolean }[] }[] };
    const toolResult = second.messages.at(-1)!.content[0];
    assert.equal(toolResult.type, "tool_result");
    assert.equal(toolResult.is_error, true);
    assert.equal(r.usage.input_tokens, 20);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("ASTRAE AI (Gemini): functionCall → functionResponse e turno do modelo preservado", async () => {
  const bodies: { contents: { role: string; parts: Record<string, unknown>[] }[] }[] = [];
  let step = 0;
  const call = async (_model: string, body: unknown) => {
    bodies.push(JSON.parse(JSON.stringify(body)));
    step++;
    if (step === 1) return { candidates: [{ content: { role: "model" as const, parts: [{ functionCall: { name: "get_mars_weather", args: { last_sols: 2 }, id: "c1" }, thoughtSignature: "sig-abc" }] } }], usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 } };
    return { candidates: [{ content: { role: "model" as const, parts: [{ text: "Sem dados agora [S1]." }] } }], usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 4 } };
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
  try {
    const r = await askWithGemini([{ role: "user", content: "Clima em Marte?" }], call);
    assert.equal(r.provider, "gemini");
    assert.equal(r.trace[0].tool, "get_mars_weather");
    assert.deepEqual(r.removedCitations, ["S1"]);
    assert.equal(r.usage.input_tokens, 16);
    const second = bodies[1].contents;
    assert.equal(second[1].role, "model");
    assert.equal(second[1].parts[0].thoughtSignature, "sig-abc"); // assinatura devolvida sem alteração
    const fr = second[2].parts[0].functionResponse as { name: string; id: string; response: { error?: string } };
    assert.equal(second[2].role, "user");
    assert.equal(fr.name, "get_mars_weather");
    assert.equal(fr.id, "c1");
    assert.match(fr.response.error!, /temporarily unavailable/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("Gemini: ferramentas sem argumentos não declaram parameters vazio", () => {
  const decl = GEMINI_TOOLS[0].functionDeclarations;
  const status = decl.find((d) => d.name === "get_enso_status")!;
  assert.equal("parameters" in status, false);
  const power = decl.find((d) => d.name === "get_power_timeseries") as { parameters: { properties: Record<string, Record<string, unknown>> } };
  assert.equal("minimum" in power.parameters.properties.latitude, false);
  assert.equal(power.parameters.properties.parameters.type, "array");
});
