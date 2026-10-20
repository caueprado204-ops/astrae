/**
 * Biblioteca de dados — ficha de cada fonte (sem chamadas de rede; usada pela interface e pela documentação).
 * Cobertura e limitações descrevem o que a ASTRAE usa, não tudo o que a instituição oferece.
 */
export interface SourceSheet { id: string; area: "Clima" | "Saúde" | "Território" | "Observação da Terra" | "Espaço"; data: string; auth: string; coverage: string; frequency: string; limitations: string; integration: string }

export const CATALOG: SourceSheet[] = [
  { id: "nasa-power", area: "Clima", data: "Temperatura (média, máx., mín.), precipitação, umidade, vento, radiação — diário e climatologia", auth: "Sem chave",
    coverage: "Global, diário desde 1981", frequency: "Atualização contínua com alguns dias de atraso", limitations: "Reanálise MERRA-2 em grade ~0,5°×0,625° (≈50 km): não é medição de estação; municípios vizinhos compartilham células.",
    integration: "Ao vivo pelo backend (/api/nasa/power, /api/health/weekly, /api/territory), cache de 12–24 h." },
  { id: "noaa-oni", area: "Clima", data: "Oceanic Niño Index (ONI) e anomalias semanais de TSM nas regiões Niño", auth: "Sem chave",
    coverage: "Pacífico equatorial, ONI desde 1950", frequency: "Mensal (ONI) e semanal (OISST)", limitations: "Índice regional do Pacífico; efeitos no Brasil variam por região e evento.",
    integration: "Ao vivo (/api/enso/*)." },
  { id: "inpe-cptec", area: "Clima", data: "Previsão de 7 dias por município e condições atuais (METAR) nas capitais", auth: "Sem chave",
    coverage: "Municípios brasileiros (previsão); aeroportos das capitais (observação)", frequency: "Diária / horária", limitations: "Serviço só em HTTP; previsão não é observação.",
    integration: "Ao vivo pelo backend (/api/brazil-climate/*)." },
  { id: "noaa-cdo", area: "Clima", data: "GHCN-Daily e outros conjuntos de estações", auth: "Token gratuito (NOAA_API_KEY)",
    coverage: "Global, estações com séries longas", frequency: "Diária", limitations: "Poucas estações brasileiras com série completa; limite de requisições.",
    integration: "Ao vivo quando o token está configurado." },
  { id: "inmet", area: "Clima", data: "Estações automáticas: temperatura, chuva, umidade, vento (horário)", auth: "Arquivos públicos; API em tempo real exige token",
    coverage: "Brasil, arquivos anuais de 2000 em diante", frequency: "Anual (arquivos) / horária (API)", limitations: "Falhas de estação e mudanças de sensor exigem controle de qualidade.",
    integration: "Pendente — próxima etapa: importar o ZIP anual, filtrar a estação do município e guardar só a série diária agregada." },
  { id: "infodengue", area: "Saúde", data: "Casos notificados, casos estimados (nowcasting), prováveis e incidência de dengue, chikungunya e zika", auth: "Sem chave",
    coverage: "Municípios brasileiros por semana epidemiológica; início da série varia por município", frequency: "Semanal, com revisão retroativa", limitations: "Semanas recentes incompletas; notificação depende da vigilância local; nível de alerta é do InfoDengue, não da ASTRAE.",
    integration: "Ao vivo (/api/health/weekly e /api/territory)." },
  { id: "datasus-sim", area: "Saúde", data: "Óbitos por data, causa básica (CID-10), idade, sexo e município de residência", auth: "Arquivos públicos",
    coverage: "Brasil, por UF e ano", frequency: "Anual (dados finais com defasagem)", limitations: "Sem API; formato DBC; os anos mais recentes são preliminares.",
    integration: "Pendente — roteiro em scripts/datasus/sim_daily_municipio.py gera série diária agregada; nada individual é armazenado." },
  { id: "datasus-sih", area: "Saúde", data: "Internações financiadas pelo SUS (diagnóstico, datas, município)", auth: "Arquivos públicos",
    coverage: "Brasil, por UF e mês", frequency: "Mensal", limitations: "Não inclui rede privada; reflete regras de faturamento.",
    integration: "Pendente — mesmo roteiro do SIM." },
  { id: "ibge-localidades", area: "Território", data: "Lista de municípios, UFs e regiões geográficas imediatas", auth: "Sem chave",
    coverage: "Brasil", frequency: "Conforme divisão territorial vigente", limitations: "—", integration: "Ao vivo (/api/ibge/*)." },
  { id: "ibge-malhas", area: "Território", data: "Limites municipais em GeoJSON", auth: "Sem chave",
    coverage: "Brasil", frequency: "Conforme malha vigente", limitations: "Usada em qualidade mínima: suficiente para mapas e centróides, não para medições precisas.",
    integration: "Ao vivo; centróide e área calculados pela ASTRAE." },
  { id: "ibge-sidra", area: "Território", data: "Censo 2022: população, área, densidade, idade; PIB dos Municípios", auth: "Sem chave",
    coverage: "Municípios brasileiros", frequency: "Censo decenal; PIB anual", limitations: "Indicadores municipais escondem desigualdades internas (bairros, setores censitários).",
    integration: "Ao vivo (/api/territory)." },
  { id: "nasa-gibs", area: "Observação da Terra", data: "Camadas de satélite e reanálise (temperatura, chuva IMERG, nuvens, aerossóis, TSM)", auth: "Sem chave",
    coverage: "Global, diária", frequency: "Diária", limitations: "Imagens (cores), não valores numéricos.", integration: "Ao vivo (Earth, Map Lab)." },
  { id: "nasa-cmr", area: "Observação da Terra", data: "Catálogo de conjuntos de dados da NASA Earthdata", auth: "Sem chave", coverage: "Global", frequency: "Contínua", limitations: "Metadados; download exige conta Earthdata.", integration: "Ao vivo (Busca)." },
  { id: "nasa-ntrs", area: "Observação da Terra", data: "Relatórios técnicos e científicos da NASA", auth: "Sem chave", coverage: "Acervo histórico", frequency: "Contínua", limitations: "Inglês; foco em temas NASA.", integration: "Ao vivo (Busca, Estudar, ASTRAE AI)." }
];

export const sheetById = (id: string) => CATALOG.find((c) => c.id === id);
