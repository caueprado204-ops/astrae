# ASTRAE — Advanced Space & Earth Research Environment

**Explore. Observe. Understand.**

Plataforma de pesquisa científica que consulta, organiza e visualiza dados reais da NASA, NOAA e INPE. Nenhum número é inventado: todo valor exibido carrega fonte, instituição, dataset, unidade, local, período, data de acesso e o tipo do dado (Observed · Forecast · Model · Estimate · Index · Imagery). Dados de exemplo só existem se marcados como **DEMO DATA** — o código de produção não usa nenhum.

---

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha as chaves (abaixo)
npm run dev                  # http://localhost:3000
```

Sem nenhuma chave a plataforma já funciona em **modo local**: todas as fontes públicas respondem (APOD usa `DEMO_KEY`). Projetos, caderno e datasets salvos exigem o Supabase.

### Onde colocar cada chave (`.env.local`, só no servidor)

| Variável | Para quê | Onde obter |
|---|---|---|
| `NASA_API_KEY` | APOD (NASA Open APIs) | https://api.nasa.gov |
| `NOAA_API_KEY` | NOAA NCEI Climate Data Online (estações GHCN-Daily) | https://www.ncdc.noaa.gov/cdo-web/token |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Login e banco do usuário (protegidos por RLS) | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Cache persistente das APIs (opcional) | Supabase → Settings → API |
| `GEOCODER_CONTACT` | Contato exigido pelo Nominatim/OSM na busca de lugares | seu e-mail |
| `ANTHROPIC_API_KEY` | ASTRAE AI | https://console.anthropic.com |
| `ANTHROPIC_MODEL` | Opcional — padrão `claude-opus-5-5` | https://platform.claude.com/docs/en/models/overview |

Nenhuma chave secreta usa o prefixo `NEXT_PUBLIC_`; todas as requisições autenticadas passam pelas rotas `/api/*`.

### Banco de dados (Supabase / PostgreSQL)

1. Crie um projeto em https://supabase.com.
2. No SQL Editor, rode `supabase/migrations/0001_astrae_schema.sql` (cópia em `database/schema.sql`).
3. Em Authentication → URL Configuration, adicione `http://localhost:3000/auth/callback` (e o domínio de produção).

Tabelas: `profiles` (users), `projects` (researches), `research_items`, `notes`, `saved_datasets`, `saved_searches`, `tags`, `note_tags`, `sources`, `datasets`, `observations`, `api_cache`. Todo conteúdo pessoal tem RLS `user_id = auth.uid()`; nada é público por padrão.

### Testes e build

```bash
npm test          # parsers ONI, Niño semanal, GIBS, busca, anomalia POWER, loop e citações do ASTRAE AI
npm run typecheck
npm run build
```

---

## Arquitetura

```
API oficial → services/<fonte> (backend) → lib/cache (memória + Supabase) → app/api/* (envelope com proveniência) → frontend
```

```
app/
  page.tsx                 landing
  login/  auth/callback/   autenticação Supabase
  (app)/                   overview, search, earth, climate, enso, mars, planetary,
                           maps, data, research, research/[id], notebook, saved, sources, settings
  api/
    nasa/        apod · images · cmr · ntrs · power · gibs/layers
    mars/        weather · rovers/[rover]
    enso/        oni · weekly · status
    brazil-climate/  (índice) · cities · forecast · capitals · historical
    noaa/        datasets · stations · daily
    ai · search · sources · geocode · settings
services/
  nasa/ mars/ enso/ inpe/ noaa/ climate/ search/ sources/ ai/   (cada integração independente)
components/  charts · maps · mars · notebook · research · shell · ui · landing
lib/         cache · http · envelope · supabase
types/       science.ts  (Provenance, DataKind, Series, SearchResult)
hooks/ utils/ database/ supabase/ tests/
```

**Erros nunca derrubam a página.** Cada rota responde `{ status: ok|empty|error, data, provenance, cache }`. Se a fonte cai, o cache devolve a última versão disponível marcada como *stale* e a interface mostra “Data source temporarily unavailable” com a data dos dados exibidos. Toda tela tem os estados Loading, Success, Error e No data.

---

## O que foi implementado e quais fontes foram conectadas

Todos os endpoints abaixo foram conferidos na documentação ou na resposta real da fonte antes de serem codificados.

**1. Landing** — hero, leituras ao vivo (ONI e REMS) e a faixa de ONI desde 1950 como assinatura visual; imagens reais do NASA GIBS e do NASA Mars Trek.

**2. Autenticação** — Supabase Auth (senha e link mágico), middleware que protege a área logada quando o Supabase está configurado.

**3. Dashboard (ASTRAE Monitor)** — cartões EARTH, MARS, CLIMATE e SCIENCE alimentados pelas rotas abaixo.

**4. Busca científica** — `/api/search` consulta em paralelo NASA Earthdata **CMR** (datasets), **NTRS** (artigos e documentos), **NASA Image and Video Library** e o catálogo de séries ao vivo da ASTRAE. Traduz a consulta PT→EN para as APIs da NASA, mostra o status de cada provedor e oferece filtros, Abrir, Salvar e Adicionar à pesquisa.

**5. NASA** — APOD (`api.nasa.gov/planetary/apod`), Image Library (`images-api.nasa.gov`), CMR (`cmr.earthdata.nasa.gov/search/collections.json`), NTRS (`ntrs.nasa.gov/api/citations/search`), **POWER** (`power.larc.nasa.gov/api/temporal/daily/point` e `/climatology/point`), **GIBS WMTS** (camadas lidas do `WMTSCapabilities.xml` oficial — nenhum ID é fixado às cegas).
⚠️ A *Mars Rover Photos API* foi **arquivada pela NASA**; ela aparece em Sources como pendente e foi substituída pelas fontes da JPL abaixo.

**6. Clima brasileiro** (`/api/brazil-climate`) — **CPTEC/INPE**: busca de municípios, previsão de 7 dias (FORECAST) e condições atuais METAR nas capitais (OBSERVED), via `servicos.cptec.inpe.br/XML`. Séries históricas, climatologia e anomalias para qualquer coordenada vêm do NASA POWER (MODEL — reanálise MERRA-2). INMET, Queimadas/INPE e CEMADEN estão registrados como *Integration pending* (o INMET exige token institucional).

**7. Mapas** — Earth Observatory (MapLibre + GIBS) com camadas liga/desliga: temperatura, temperatura de superfície, precipitação IMERG, nuvens, umidade, pressão, vento, aerossóis, TSM e anomalia de TSM. Map Lab com DATE, LAYER, REGION, VARIABLE e TIME RANGE, animação, comparação de duas datas lado a lado, legendas oficiais e busca de local.

**8. Marte** — Mars Weather com o feed REMS do Curiosity (`mars.nasa.gov/rss/api/?feed=weather&category=msl`); mapa global em Leaflet com os mosaicos do **NASA Mars Trek** (Viking MDIM 2.1 e MOLA), seleção de região e coordenadas; Mars Rovers com imagens brutas do Curiosity (`mars.nasa.gov/api/v1/raw_image_items`) e do Perseverance (feed `raw_images` da Mars 2020), posição atual pelos waypoints MMGIS da JPL, e Spirit/Opportunity pelo acervo da Image Library.

**9. ENSO Monitor** — ONI oficial (`cpc.ncep.noaa.gov/data/indices/oni.ascii.txt`) com o critério de 5 trimestres do CPC, anomalias semanais OISST nas regiões Niño (`wksst9120.for`), status oficial do ENSO Alert System extraído da discussão diagnóstica do CPC, timeline por ano, tabela de episódios e mapa de anomalia de TSM do Pacífico.
Observação científica: o *status oficial* do CPC e o *episódio pelo critério do ONI* podem divergir temporariamente — o CPC declara condições com dados mensais antes de fechar 5 trimestres. A interface mostra os dois separadamente.

**10. Data Explorer** — Fonte → Dataset → Variável → Região → Período, gerando gráfico, mapa e tabela (POWER, REMS, ONI, Niño semanal).

**11–13. Research, Notebook e banco** — projetos com descrição, hipótese, perguntas, itens salvos agrupados e lista de referências; caderno com blocos de título, texto, lista, tabela, imagem, link, referência, **gráfico ao vivo** e **mapa ao vivo**, modelo Observação/Metodologia/Resultados/Discussão/Conclusão, tags e salvamento automático.

**14. Sources** — status de conexão de cada fonte (Connected, Temporarily unavailable, API key required, Integration pending), latência e data da verificação.

**15. Settings** — tema escuro/claro, perfil e quais chaves estão configuradas (sem expor valores).

**16. ASTRAE AI** (`/ai`, rota `POST /api/ai`) — assistente com uso de ferramentas (tool use da API da Anthropic). O modelo não responde de memória: ele chama dez ferramentas que executam os mesmos serviços verificados da plataforma (status ENSO e série ONI, Niño semanal, clima REMS, status dos rovers, capitais e previsão CPTEC, séries e climatologia NASA POWER, busca de datasets no CMR e de relatórios no NTRS).
- Cada fonte consultada recebe um ID (`S1`, `S2`…) e o modelo é obrigado a citá-lo; depois da resposta, o servidor **remove qualquer citação a uma fonte que não foi de fato consultada** e avisa na tela.
- Explicações de mecanismos físicos só são aceitas com apoio em relatório retornado pelo NTRS; o tipo do dado (observado, previsão, modelo, índice) é sempre declarado.
- A tela mostra a resposta, as fontes citadas com instituição, dataset e data de acesso, e a lista de consultas feitas. “Salvar no caderno” cria uma página com a pergunta, a resposta e as referências.
- Segurança e custo: a chave fica só no servidor; com Supabase configurado, só usuários logados usam o assistente; limite de 20 perguntas a cada 10 minutos por usuário.

Gráficos (ECharts): linha, área, barras, dispersão, séries temporais e comparação com eixo duplo; zoom, hover, seleção e exportação **PNG, CSV e JSON** — o CSV e o JSON levam o cabeçalho de proveniência.

---

## Limites conhecidos

- O feed REMS é de divulgação (CAB/JPL) e hoje não traz vento nem poeira; os dados científicos completos estão no PDS.
- O POWER é reanálise em grade de ~50 km, não medição de estação — por isso aparece como **Model**.
- O CPTEC serve XML apenas em HTTP; a ASTRAE sempre o consulta pelo backend.
- A busca de lugares usa o Nominatim (OSM) apenas para posicionar o mapa, nunca como dado científico.
