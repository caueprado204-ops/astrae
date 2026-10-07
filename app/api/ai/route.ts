import { NextResponse } from "next/server";
import { aiConfigured, aiModel, askAstrae, type ChatTurn } from "@/services/ai/agent";
import { getServerClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // limite do plano gratuito da Vercel

// limite simples por usuário/IP: 20 perguntas a cada 10 minutos (por instância)
const WINDOW = 10 * 60e3, LIMIT = 20;
const g = globalThis as unknown as { __aiHits?: Map<string, number[]> };
const hits: Map<string, number[]> = g.__aiHits ?? (g.__aiHits = new Map());

export function GET() {
  return NextResponse.json({ configured: aiConfigured(), model: aiConfigured() ? aiModel() : null });
}

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return NextResponse.json({ status: "error", error: "ASTRAE AI não configurado: defina ANTHROPIC_API_KEY no .env.local do servidor." }, { status: 503 });
  }

  // Quando há Supabase, o assistente exige login (evita uso anônimo da chave do servidor).
  let who = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (supabaseConfigured) {
    const { data } = await getServerClient()!.auth.getUser();
    if (!data.user) return NextResponse.json({ status: "error", error: "Entre na sua conta para usar o ASTRAE AI." }, { status: 401 });
    who = data.user.id;
  }
  const now = Date.now();
  const recent = (hits.get(who) || []).filter((t) => now - t < WINDOW);
  if (recent.length >= LIMIT) return NextResponse.json({ status: "error", error: "Limite de perguntas atingido. Tente novamente em alguns minutos." }, { status: 429 });
  hits.set(who, [...recent, now]);

  let body: { messages?: ChatTurn[] };
  try { body = await req.json(); } catch { return NextResponse.json({ status: "error", error: "JSON inválido" }, { status: 400 }); }
  const msgs = (body.messages || []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim());
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return NextResponse.json({ status: "error", error: "A última mensagem deve ser uma pergunta." }, { status: 400 });
  if (msgs.some((m) => m.content.length > 6000)) return NextResponse.json({ status: "error", error: "Mensagem longa demais." }, { status: 400 });
  // mantém só as últimas 12 mensagens e garante que comece pelo usuário
  let history = msgs.slice(-12);
  while (history.length && history[0].role !== "user") history = history.slice(1);

  try {
    const r = await askAstrae(history);
    return NextResponse.json({ status: "ok", ...r, answeredAt: new Date().toISOString() });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const msg = err.status === 401 ? "Chave ANTHROPIC_API_KEY inválida." : err.status === 429 ? "Limite da API da Anthropic atingido. Tente em instantes." : `Falha ao consultar o modelo: ${err.message}`;
    return NextResponse.json({ status: "error", error: msg }, { status: 502 });
  }
}
