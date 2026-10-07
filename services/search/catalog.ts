import type { SearchResult } from "@/types/science";

/**
 * Catálogo das séries que a ASTRAE consulta AO VIVO em fontes oficiais.
 * Cada item aponta para a tela interna que exibe os dados reais + link da fonte original.
 */
interface CatalogEntry { keywords: string[]; result: SearchResult }

const entry = (keywords: string[], r: Omit<SearchResult, "id"> & { id: string }): CatalogEntry => ({ keywords, result: r });

export const CATALOG: CatalogEntry[] = [
  entry(["enso", "nino", "nina", "oni", "pacific", "pacífico", "pacifico", "el", "la", "oceanic", "sea", "temperature", "temperatura", "anomaly", "anomalia", "noaa", "clima", "climate"], {
    id: "astrae:oni", title: "Oceanic Niño Index (ONI) — série histórica 1950–presente",
    description: "Anomalia trimestral de TSM na região Niño 3.4 (ERSST.v5). Classificação El Niño / La Niña / Neutro pelo critério do CPC.",
    source: "NOAA", institution: "NOAA Climate Prediction Center", type: "timeseries", kind: "INDEX",
    topics: ["climate", "ocean"], originalUrl: "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt",
    openUrl: "/enso", datasetName: "CPC ONI (ERSST.v5)"
  }),
  entry(["enso", "nino", "nina", "weekly", "semanal", "sst", "pacific", "pacifico", "pacífico", "oisst", "temperature", "temperatura", "2026"], {
    id: "astrae:weekly-nino", title: "Anomalias semanais de TSM — Niño 1+2, 3, 3.4 e 4",
    description: "Série semanal OISST v2.1 (base 1991–2020) publicada pelo CPC para monitoramento em tempo quase real.",
    source: "NOAA", institution: "NOAA Climate Prediction Center", type: "timeseries", kind: "OBSERVED",
    topics: ["climate", "ocean"], originalUrl: "https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for",
    openUrl: "/enso", datasetName: "CPC weekly OISST v2.1"
  }),
  entry(["mars", "marte", "weather", "tempo", "temperature", "temperatura", "pressure", "pressão", "pressao", "atmosphere", "atmosfera", "curiosity", "rems", "gale", "sol"], {
    id: "astrae:rems", title: "Clima em Marte — Curiosity / REMS (por sol)",
    description: "Temperatura do ar e do solo, pressão, opacidade e UV medidos pela estação REMS na cratera Gale.",
    source: "NASA", institution: "NASA/JPL · Centro de Astrobiología (CAB)", type: "timeseries", kind: "OBSERVED",
    topics: ["mars", "atmosphere"], originalUrl: "https://mars.nasa.gov/msl/weather/",
    openUrl: "/mars", datasetName: "MSL REMS weather feed"
  }),
  entry(["mars", "marte", "rover", "curiosity", "perseverance", "spirit", "opportunity", "images", "imagens", "surface", "superficie", "superfície", "crater", "cratera"], {
    id: "astrae:rovers", title: "Rovers marcianos — imagens brutas e localização",
    description: "Imagens brutas de Curiosity e Perseverance, waypoints oficiais e acervo histórico de Spirit e Opportunity.",
    source: "NASA", institution: "NASA/JPL-Caltech", type: "image", kind: "IMAGERY",
    topics: ["mars"], originalUrl: "https://mars.nasa.gov/msl/multimedia/raw-images/",
    openUrl: "/mars?tab=rovers", datasetName: "Mars raw images"
  }),
  entry(["mars", "marte", "map", "mapa", "surface", "superficie", "superfície", "crater", "cratera", "viking", "mosaic"], {
    id: "astrae:mars-map", title: "Mapa global de Marte — mosaico Viking MDIM 2.1",
    description: "Mosaico colorido global servido pelo NASA Mars Trek (WMTS), com posição atual dos rovers.",
    source: "NASA", institution: "NASA Solar System Treks", type: "map", kind: "IMAGERY",
    topics: ["mars"], originalUrl: "https://trek.nasa.gov/mars/", openUrl: "/mars?tab=map", datasetName: "Mars_Viking_MDIM21_ClrMosaic_global_232m"
  }),
  entry(["brazil", "brasil", "temperature", "temperatura", "precipitation", "precipitação", "precipitacao", "chuva", "pressure", "pressão", "umidade", "humidity", "vento", "wind", "radiação", "radiation", "climatologia", "climatology", "anomalia", "anomaly", "historico", "histórico", "power"], {
    id: "astrae:power", title: "Séries diárias e climatologia para qualquer ponto do Brasil — NASA POWER",
    description: "Temperatura, precipitação, pressão, umidade, vento e radiação desde 1981 (reanálise MERRA-2/CERES), com anomalias.",
    source: "NASA", institution: "NASA Langley Research Center", type: "timeseries", kind: "MODEL",
    topics: ["earth", "climate", "brazil", "atmosphere"], originalUrl: "https://power.larc.nasa.gov/",
    openUrl: "/climate", datasetName: "POWER Daily / Climatology"
  }),
  entry(["brazil", "brasil", "previsão", "previsao", "forecast", "cptec", "inpe", "tempo", "weather", "cidade"], {
    id: "astrae:cptec", title: "Previsão de tempo por município — CPTEC/INPE",
    description: "Previsão oficial de 7 dias (máx./mín., condição, índice UV) e condições atuais nas capitais.",
    source: "INPE", institution: "CPTEC/INPE", type: "timeseries", kind: "FORECAST",
    topics: ["brazil", "atmosphere"], originalUrl: "http://servicos.cptec.inpe.br/XML/",
    openUrl: "/climate?tab=forecast", datasetName: "CPTEC XML"
  }),
  entry(["earth", "terra", "map", "mapa", "satellite", "satélite", "satelite", "clouds", "nuvens", "aerosol", "aerossóis", "aerossois", "sst", "ocean", "oceano", "precipitation", "precipitação", "temperatura", "temperature", "gibs", "modis"], {
    id: "astrae:gibs", title: "Earth Observatory — camadas globais de satélite (NASA GIBS)",
    description: "Cor verdadeira MODIS/VIIRS, temperatura, precipitação IMERG, nuvens, aerossóis, TSM e anomalias de TSM.",
    source: "NASA", institution: "NASA ESDIS · GIBS", type: "map", kind: "IMAGERY",
    topics: ["earth", "atmosphere", "ocean", "climate"], originalUrl: "https://nasa-gibs.github.io/gibs-api-docs/",
    openUrl: "/earth", datasetName: "GIBS WMTS EPSG:3857"
  })
];
