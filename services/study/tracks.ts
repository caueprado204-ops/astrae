/**
 * Trilhas de estudo da ASTRAE.
 * Nenhuma trilha traz números ou afirmações científicas próprias: cada uma organiza
 * (1) videoaulas buscadas ao vivo no acervo da NASA, (2) relatórios técnicos do NTRS,
 * (3) leituras em sites oficiais e (4) as ferramentas de dados da plataforma.
 * Todos os links de "readings" foram abertos e conferidos em 18/10/2026.
 */
export interface Reading { title: string; institution: string; url: string; note?: string }
export interface Track {
  id: string;
  title: string;
  area: "Terra" | "Clima" | "Espaço";
  level: "Introdutório" | "Intermediário";
  summary: string;
  objectives: string[];
  questions: string[];
  videoQuery: string;   // busca em inglês no acervo da NASA
  reportQuery: string;  // busca em inglês no NTRS
  tools: { href: string; label: string }[];
  readings: Reading[];
}

export const TRACKS: Track[] = [
  {
    id: "enso",
    title: "El Niño, La Niña e o Pacífico",
    area: "Clima",
    level: "Introdutório",
    summary: "Como a temperatura do Pacífico tropical é monitorada, o que é o índice ONI e como a NOAA declara um episódio de El Niño ou La Niña.",
    objectives: [
      "Ler a série oficial do ONI e identificar episódios pelo critério do CPC",
      "Diferenciar o status oficial do ENSO Alert System do episódio pelo ONI",
      "Relacionar anomalias de TSM nas regiões Niño com o mapa do Pacífico"
    ],
    questions: [
      "Qual é o status atual do ENSO segundo o CPC e o que mostra o último ONI?",
      "Quais foram os episódios de El Niño mais fortes desde 1950 pelo ONI?",
      "Como estava a chuva em Porto Alegre nos anos de El Niño forte?"
    ],
    videoQuery: "El Nino",
    reportQuery: "El Nino Southern Oscillation",
    tools: [{ href: "/enso", label: "ENSO Monitor" }, { href: "/data", label: "Data Explorer" }, { href: "/maps", label: "Map Lab (anomalia de TSM)" }],
    readings: [
      { title: "ENSO Diagnostic Discussion", institution: "NOAA Climate Prediction Center", url: "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml", note: "Boletim oficial mensal" },
      { title: "El Niño & La Niña (ENSO)", institution: "NOAA Climate.gov", url: "https://www.climate.gov/enso", note: "Material didático; o site foi arquivado em junho de 2025 e não é mais atualizado" }
    ]
  },
  {
    id: "brasil",
    title: "Tempo e clima no Brasil",
    area: "Clima",
    level: "Introdutório",
    summary: "Diferença entre observação, previsão e reanálise, usando as previsões do CPTEC/INPE e as séries históricas do NASA POWER para cidades brasileiras.",
    objectives: [
      "Distinguir dado OBSERVADO, PREVISÃO e MODELO/reanálise",
      "Consultar a previsão de 7 dias de um município no CPTEC",
      "Montar a série histórica e a anomalia de um ponto com o NASA POWER"
    ],
    questions: [
      "Como estão as condições agora nas capitais brasileiras?",
      "Compare a temperatura média de Manaus e Curitiba nos últimos 10 anos.",
      "Qual é a climatologia de chuva de Belém mês a mês?"
    ],
    videoQuery: "weather satellite",
    reportQuery: "South America precipitation",
    tools: [{ href: "/climate", label: "Climate" }, { href: "/data", label: "Data Explorer" }],
    readings: [
      { title: "CPTEC — Centro de Previsão de Tempo e Estudos Climáticos", institution: "INPE", url: "https://www.cptec.inpe.br/" },
      { title: "POWER Docs (metodologia e variáveis)", institution: "NASA Langley Research Center", url: "https://power.larc.nasa.gov/docs/" }
    ]
  },
  {
    id: "sensoriamento",
    title: "Observação da Terra por satélite",
    area: "Terra",
    level: "Intermediário",
    summary: "Como satélites medem nuvens, temperatura da superfície, chuva e aerossóis, e como ler as camadas do NASA GIBS com legenda e data.",
    objectives: [
      "Entender o que cada camada de satélite representa e sua resolução temporal",
      "Comparar a mesma região em duas datas no Map Lab",
      "Encontrar o dataset de origem de uma camada no NASA Earthdata"
    ],
    questions: [
      "Quais datasets da NASA medem precipitação por satélite?",
      "Encontre relatórios técnicos da NASA sobre sensoriamento remoto de queimadas na Amazônia."
    ],
    videoQuery: "Earth observing satellite",
    reportQuery: "satellite remote sensing",
    tools: [{ href: "/earth", label: "Earth Observatory" }, { href: "/maps", label: "Map Lab" }, { href: "/search", label: "Busca científica" }],
    readings: [
      { title: "ARSET — Applied Remote Sensing Training", institution: "NASA Earthdata", url: "https://www.earthdata.nasa.gov/data/projects/arset", note: "Cursos gratuitos de sensoriamento remoto" },
      { title: "Earth Observatory", institution: "NASA Science", url: "https://science.nasa.gov/earth/earth-observatory/" },
      { title: "Earth Observation Data Basics", institution: "NASA Earthdata", url: "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics" }
    ]
  },
  {
    id: "mudanca-climatica",
    title: "Mudança do clima: evidências e dados",
    area: "Clima",
    level: "Introdutório",
    summary: "Onde estão as séries oficiais de temperatura e chuva, como se calcula uma anomalia em relação a uma climatologia e por que correlação não é causalidade.",
    objectives: [
      "Calcular a anomalia de um ponto em relação à climatologia no Data Explorer",
      "Separar tendência de variabilidade natural (ex.: ENSO)",
      "Citar corretamente fonte, período e método de cada série"
    ],
    questions: [
      "Como variou a temperatura média anual em São Paulo desde 1990 pelo NASA POWER?",
      "Quais foram as principais anomalias climáticas recentes?"
    ],
    videoQuery: "climate change",
    reportQuery: "global surface temperature",
    tools: [{ href: "/data", label: "Data Explorer" }, { href: "/climate", label: "Climate" }],
    readings: [
      { title: "Climate Change", institution: "NASA Science", url: "https://science.nasa.gov/climate-change/" },
      { title: "SciJinks — tempo e clima explicados", institution: "NOAA NESDIS", url: "https://scijinks.gov/" }
    ]
  },
  {
    id: "marte",
    title: "Marte: clima, superfície e rovers",
    area: "Espaço",
    level: "Introdutório",
    summary: "O que os rovers Curiosity e Perseverance medem, como ler os dados do REMS (temperatura e pressão em Marte) e como navegar pelos mosaicos do Mars Trek.",
    objectives: [
      "Interpretar a série de temperatura e pressão do REMS por sol",
      "Localizar a posição atual dos rovers no mapa",
      "Comparar a atmosfera de Marte e da Terra com dados citados"
    ],
    questions: [
      "Mostre os dados de temperatura de Marte.",
      "Compare a atmosfera de Marte e da Terra.",
      "Onde estão o Curiosity e o Perseverance agora?"
    ],
    videoQuery: "Mars rover",
    reportQuery: "Mars atmosphere",
    tools: [{ href: "/mars", label: "Mars Lab" }],
    readings: [
      { title: "Mars", institution: "NASA Science", url: "https://science.nasa.gov/mars/" },
      { title: "Mars Science Laboratory: Curiosity Rover", institution: "NASA Science", url: "https://science.nasa.gov/mission/msl-curiosity/" },
      { title: "Mars 2020: Perseverance Rover", institution: "NASA Science", url: "https://science.nasa.gov/mission/mars-2020-perseverance/" }
    ]
  },
  {
    id: "sistema-solar",
    title: "Sistema Solar e ciência planetária",
    area: "Espaço",
    level: "Introdutório",
    summary: "Planetas, luas, asteroides e cometas pelo acervo de imagens e vídeos da NASA e pelos relatórios técnicos das missões.",
    objectives: [
      "Usar o acervo de imagens da NASA com crédito e data corretos",
      "Encontrar relatórios técnicos de uma missão planetária",
      "Organizar referências de um tema em um projeto de pesquisa"
    ],
    questions: [
      "Encontre relatórios técnicos da NASA sobre a lua Europa.",
      "Quais missões estudaram Júpiter? Cite relatórios da NASA."
    ],
    videoQuery: "solar system planets",
    reportQuery: "planetary science mission",
    tools: [{ href: "/planetary", label: "Planetary" }, { href: "/search", label: "Busca científica" }],
    readings: [
      { title: "Solar System Exploration", institution: "NASA Science", url: "https://science.nasa.gov/solar-system/" }
    ]
  }
];

export const trackById = (id: string) => TRACKS.find((t) => t.id === id);
