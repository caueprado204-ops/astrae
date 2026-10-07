import { test } from "node:test";
import assert from "node:assert/strict";
import { askAstrae } from "../services/ai/agent";

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
    const r = await askAstrae([{ role: "user", content: "Mostre os dados de temperatura de Marte." }], fake);
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
