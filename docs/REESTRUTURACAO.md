# ASTRAE — Reestruturação para pesquisa socioambiental (outubro de 2026)

Este documento registra as etapas 1 a 4 (auditoria, diagnóstico, arquitetura, priorização) e o que foi implementado e validado nas etapas 5 a 7.

## 1. Auditoria do projeto existente

**Stack:** Next.js 14 (App Router), React 18, TypeScript estrito, Tailwind com tokens de tema, ECharts, MapLibre e Leaflet, Supabase (Auth + Postgres com RLS). Hospedagem na Vercel.

**Arquitetura que já existia e foi mantida**

```
API oficial → services/<fonte> (backend) → lib/cache (memória + Supabase) → app/api/* (envelope com proveniência) → interface
```

- Toda rota responde `{ status: ok|empty|error, data, provenance, cache }`. A proveniência traz fonte, instituição, dataset, tipo do dado, período, local, método e data de acesso.
- Se a fonte cai, o cache devolve a última versão marcada como *stale*. A página nunca quebra.
- Os tipos de dado são: OBSERVED, FORECAST, MODEL, ESTIMATE, SIMULATION, INDEX, CATALOG, IMAGERY e DEMO.

**Integrações que funcionavam**

- **NASA:**
  - POWER (diário e climatologia);
  - GIBS (camadas de satélite);
  - CMR (catálogo de dados);
  - NTRS (relatórios técnicos);
  - APOD e Image Library (imagens e vídeos);
  - dados de Marte do JPL (REMS, imagens brutas, MMGIS, Mars Trek).
- **NOAA CPC:** ONI, Niño semanal e status do ENSO. O NOAA CDO funciona quando há token.
- **CPTEC/INPE:** previsão municipal e condições atuais nas capitais.

**Funcionalidades:**

- landing;
- autenticação;
- painel;
- busca científica;
- Earth Observatory;
- Map Lab;
- Clima no Brasil;
- ENSO;
- Marte;
- Planetário;
- Data Explorer;
- projetos de pesquisa;
- caderno com blocos ao vivo;
- itens salvos;
- Biblioteca de fontes;
- ASTRAE AI (assistente com citações verificadas);
- Estudar (videoaulas).

## 2. Diagnóstico

| O que funciona | O que faltava para a nova proposta |
|---|---|
| Proveniência e tipo do dado em toda a plataforma | Nenhum dado de saúde |
| Clima por coordenada (POWER) e ENSO | Nenhum dado territorial ou social (IBGE) |
| Gráficos exportáveis com cabeçalho de proveniência | Nenhuma estatística: correlação, defasagem, descritivas |
| Projetos, caderno e itens salvos | Seleção por município: só havia coordenada ou busca de lugar |
| Cache e estados de erro | Investigação sem método, limitações, revisão nem relatório |
| | Navegação centrada no espaço, misturando inglês e português |
| | Biblioteca de fontes sem cobertura nem limitações |

**Problemas de navegação encontrados:**

- Marte e Planetário tinham o mesmo peso que Clima no menu.
- O Início trazia a temperatura de Marte em destaque.
- "Earth" e "Maps" se sobrepõem (ambos usam o GIBS). Foram mantidos, agrupados como Observatório.

## 3. Arquitetura proposta e implementada

**Navegação por áreas** (`components/shell/nav.ts`):

| Grupo | Páginas |
|---|---|
| Pesquisa | Início · **Clima e Saúde** · **Território** · Laboratório de dados · Busca científica · ASTRAE AI |
| Observatório | Clima no Brasil · El Niño e La Niña · Observação da Terra · Map Lab |
| Caderno científico | **Investigações** · Caderno · Dados salvos · Estudar |
| Espaço | Marte · Planetário (preservados, com menos destaque) |
| Plataforma | **Biblioteca de dados** · **Sobre a ASTRAE** · Configurações |

**Camadas novas**

- `services/health/infodengue.ts`: InfoDengue (dengue, chikungunya, zika por município e semana).
- `services/ibge/`:
  - Localidades: municípios e região geográfica imediata;
  - Malhas: GeoJSON, com centróide e área calculados;
  - SIDRA: Censo 2022 e PIB dos Municípios.
- `services/health/analysis.ts`: tabela semanal com casos (InfoDengue) e clima diário (POWER) agregado nas mesmas semanas epidemiológicas.
- `services/territory/indicators.ts`: indicadores por município, cada um com fonte, ano e tipo.
- `lib/stats.ts`, sem p-valores de propósito:
  - descritivas;
  - Pearson e Spearman (com empates);
  - correlação com defasagem;
  - remoção da sazonalidade média;
  - normalização min–max.
- `lib/epiweek.ts`: agregação diária → semana epidemiológica, com regra explícita de dias mínimos.
- `utils/report.ts`: relatório Markdown da investigação, separando o conteúdo dos autores do conteúdo gerado pela plataforma.

**Rotas novas**

- `/api/health/weekly`
- `/api/health/arbovirus`
- `/api/ibge/municipios`
- `/api/ibge/municipio`
- `/api/territory`

**Banco:** `supabase/migrations/0002_research_structure.sql`

- Acrescenta à tabela `projects` os campos:
  - justificativa, objetivos, fontes, metodologia, resultados, limitações, referências, próximas etapas;
  - eixo, status de revisão, revisor e parecer.
- Cria a tabela `feedback` para sugestões de pesquisadores, com RLS.

**Princípio de armazenamento:** a ASTRAE não copia bases inteiras. Consulta na fonte, guarda em cache só a resposta usada e, nos projetos, guarda parâmetros e resultados da análise, nunca o dataset.

## 4. Priorização

**Versão 1 (feita)**

1. Eixo A com o piloto de Campinas (InfoDengue × POWER).
2. Eixo B com indicadores municipais (IBGE, POWER, InfoDengue), mapa e índice exploratório.
3. Investigações estruturadas, com relatório e revisão.
4. Biblioteca de dados com fichas.
5. Página Sobre.
6. Navegação nova.

**Próximas versões**

1. **SIM e SIH (mortalidade e internações):**
   - executar `scripts/datasus/sim_daily_municipio.py`;
   - criar uma tabela `health_series` só com séries agregadas;
   - incluir os desfechos na página Clima e Saúde.
2. **INMET:** importar o ZIP anual e extrair a série diária da estação do município, para comparar com o POWER.
3. **Território intramunicipal:** setores censitários do Censo 2022 (renda, saneamento).
4. **ASTRAE AI:** ferramentas para InfoDengue e IBGE.
5. **Avisos oficiais:** só com fonte, data de emissão e validade, se houver serviço documentado.
6. **Modelos para pesquisadores:** modelos de regressão para séries de contagem (Poisson / binomial negativa com defasagens distribuídas), apenas com orientação metodológica.

## 5–6. Implementação e validação

Itens verificados:

- `npm test`: 20 testes passando, incluindo respostas reais do InfoDengue e da SIDRA para Campinas, guardadas em `tests/fixtures/`.
- `npm run typecheck` e `npm run build` sem erros.
- Capturas de tela das páginas novas, nos temas claro e escuro e no celular, com dados sintéticos injetados só no navegador de teste.

Itens **não** verificados neste ambiente:

- A rede do ambiente de desenvolvimento bloqueia InfoDengue, IBGE e NASA, então as chamadas ao vivo dessas rotas não foram executadas daqui.
- A resposta das APIs de Localidades e de Malhas do IBGE não pôde ser aberta (robots.txt). O código lê os campos de forma defensiva.
- No site publicado, a **Biblioteca de dados** testa cada endpoint a cada 10 minutos. É a forma de confirmar que tudo responde.
- A migração 0002 precisa ser executada no Supabase do projeto.
- O roteiro do SIM não foi executado.

## 7. Limitações conhecidas

- O clima do NASA POWER é reanálise em grade de cerca de 50 km. Municípios vizinhos compartilham células, e a interface avisa quando isso acontece.
- Casos do InfoDengue nas semanas recentes ainda são revisados.
- As correlações são descritivas. Não há teste de significância, porque as séries são autocorrelacionadas e sazonais.
- O índice exploratório é relativo ao conjunto de municípios escolhido e aos pesos escolhidos. Não é índice oficial de vulnerabilidade.
- A ASTRAE é independente e não tem vínculo com nenhuma instituição citada.
