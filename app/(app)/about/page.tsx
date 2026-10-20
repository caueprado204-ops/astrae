"use client";
import Link from "next/link";
import { useState } from "react";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/shell/AppShell";
import { useUser } from "@/hooks/useUser";

export default function AboutPage() {
  return (
    <div>
      <PageHeader title="Sobre a ASTRAE" subtitle="Missão, método, limites e como pesquisadores podem orientar e colaborar." />
      <div className="grid gap-4 lg:grid-cols-12">
        <section className="bento p-6 lg:col-span-7">
          <p className="eyebrow text-dim">Missão</p>
          <p className="mt-2 text-xl leading-snug">Transformar dados climáticos, ambientais e de saúde em conhecimento explorável, transparente e útil para a pesquisa e para a sociedade.</p>
          <p className="mt-4 text-sm leading-relaxed text-dim">A ASTRAE é um projeto independente, desenvolvido por estudantes que ainda não concluíram a graduação, para facilitar o acesso, a integração e a análise de dados oficiais. Ela organiza investigações em dois eixos: <Link className="text-accent hover:underline" href="/health">clima, ambiente e saúde pública</Link> e <Link className="text-accent hover:underline" href="/territory">clima, território e vulnerabilidade socioambiental</Link>.</p>
          <p className="mt-3 rounded-2xl border border-line bg-panel2/60 p-3 text-sm text-dim">A ASTRAE <strong className="text-ink">não tem vínculo oficial</strong> com a Unicamp, a NASA, a NOAA, o INPE, o IBGE, o Ministério da Saúde ou qualquer outra instituição. Essas instituições aparecem apenas como fontes públicas de dados.</p>
        </section>

        <section className="bento p-6 lg:col-span-5">
          <p className="eyebrow text-dim">O que a plataforma não faz</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-dim">
            <li>Não emite alertas nem previsões próprias — avisos oficiais pertencem aos órgãos competentes.</li>
            <li>Não faz diagnóstico epidemiológico nem afirma causalidade a partir de correlações.</li>
            <li>Não classifica territórios como “vulneráveis”: índices são exploratórios e com pesos visíveis.</li>
            <li>Não usa dados individuais de saúde — apenas dados públicos agregados.</li>
            <li>Não inventa dados, endpoints ou referências; dado de exemplo é sempre rotulado.</li>
          </ul>
        </section>

        <section className="bento p-6 lg:col-span-7">
          <p className="eyebrow text-dim">Princípios metodológicos</p>
          <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
            <Pr t="Rastreabilidade">Todo número mostra fonte, instituição, conjunto de dados, período, local, data de acesso e o tipo do dado (observado, previsão, modelo, estimativa, índice).</Pr>
            <Pr t="Reprodutibilidade">Cada análise exporta os dados usados (CSV com cabeçalho de proveniência) e os parâmetros e resultados (JSON).</Pr>
            <Pr t="Transparência">Agregações, faltantes e transformações são descritos na tela; nenhum valor é imputado em silêncio.</Pr>
            <Pr t="Limitações explícitas">Resolução espacial, revisão de notificações e fatores não controlados aparecem junto aos resultados.</Pr>
            <Pr t="Revisão">Investigações têm status de revisão; conteúdo gerado pela plataforma é marcado e separado do que foi escrito por pesquisadores.</Pr>
            <Pr t="Perguntas delimitadas">Cada investigação começa por pergunta, hipótese e método, não pelo gráfico.</Pr>
          </dl>
        </section>

        <section className="bento p-6 lg:col-span-5">
          <p className="eyebrow text-dim">Para pesquisadores</p>
          <p className="mt-2 text-sm leading-relaxed text-dim">Buscamos orientação e críticas metodológicas: desenho dos estudos, escolha de fontes, tratamento estatístico e interpretação. Você pode revisar uma investigação (status “em revisão” e parecer), sugerir fontes ou apontar erros pelo formulário abaixo.</p>
          <Feedback />
        </section>

        <section className="bento p-6 lg:col-span-12">
          <p className="eyebrow text-dim">Possibilidades futuras (não são serviços oferecidos hoje)</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="text-left text-xs text-faint"><th className="py-1 font-normal">Possível serviço</th><th className="font-normal">Para quem</th><th className="font-normal">Problema que resolveria</th><th className="font-normal">O que falta</th></tr></thead>
              <tbody className="text-dim">
                <Row a="Organização e integração de dados ambientais e de saúde" b="Grupos de pesquisa, ONGs" c="Tempo gasto juntando bases públicas com formatos diferentes" d="Pipelines do SIM/SIH e INMET em produção; documentação de qualidade" />
                <Row a="Painéis exploratórios personalizados" b="Secretarias, organizações socioambientais" c="Acompanhar indicadores públicos de um território" d="Validação por especialistas; termos de uso" />
                <Row a="Relatórios exploratórios com dados públicos" b="Projetos de extensão, iniciação científica" c="Ponto de partida reprodutível para pesquisas" d="Revisão metodológica por pesquisadores" />
                <Row a="Ferramentas educacionais" b="Escolas, cursos técnicos e universidades" c="Ensinar análise de dados reais com rastreabilidade" d="Material didático revisado" />
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-faint">Fora de escopo sem os requisitos técnicos, científicos e legais: previsão, diagnóstico epidemiológico, consultoria especializada e alertas oficiais.</p>
        </section>
      </div>
    </div>
  );
}

function Pr({ t, children }: { t: string; children: React.ReactNode }) {
  return <div><dt className="font-medium text-ink">{t}</dt><dd className="mt-1 leading-relaxed text-dim">{children}</dd></div>;
}
function Row({ a, b, c, d }: { a: string; b: string; c: string; d: string }) {
  return <tr className="border-t border-line/60 align-top"><td className="py-2 pr-3 text-ink">{a}</td><td className="pr-3">{b}</td><td className="pr-3">{c}</td><td>{d}</td></tr>;
}

function Feedback() {
  const { sb, user, configured } = useUser();
  const [kind, setKind] = useState("critica-metodologica");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");
  if (!configured) return <p className="mt-3 text-xs text-dim">O formulário precisa do Supabase configurado.</p>;
  if (!user) return <p className="mt-3 text-xs text-dim"><Link href="/login" className="text-accent hover:underline">Entre</Link> para enviar uma sugestão.</p>;
  if (state === "sent") return <p className="mt-3 text-sm text-ok">Obrigado! Sua contribuição foi registrada.</p>;
  return (
    <form className="mt-3 space-y-2" onSubmit={async (e) => {
      e.preventDefault(); setState("sending");
      const { error } = await sb!.from("feedback").insert({ kind, message, contact, page: "/about" });
      if (error) { setErr(error.message.includes("feedback") ? "Tabela de sugestões ainda não criada (migração 0002)." : error.message); setState("error"); } else setState("sent");
    }}>
      <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="critica-metodologica">Crítica metodológica</option><option value="fonte-de-dados">Sugestão de fonte de dados</option><option value="sugestao">Sugestão geral</option><option value="erro">Erro encontrado</option>
      </select>
      <textarea className="input min-h-[90px]" required minLength={5} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Escreva sua contribuição" />
      <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contato (opcional) — nome, instituição, e-mail" />
      <button className="btn-primary" disabled={state === "sending"}><Send size={14} /> Enviar</button>
      {state === "error" && <p className="text-xs text-bad">{err}</p>}
    </form>
  );
}
