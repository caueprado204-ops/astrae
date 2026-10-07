/**
 * Arquitetura modular de fontes climáticas brasileiras (/api/brazil-climate).
 * Para adicionar uma fonte: registre aqui e crie o adaptador em services/<instituição>/.
 */
import type { DataKind } from "@/types/science";

export interface ClimateProvider {
  id: string;
  institution: string;
  name: string;
  status: "live" | "pending" | "key-required";
  kind: DataKind;
  variables: string[];
  docs: string;
  notes: string;
}

export const BRAZIL_CLIMATE_PROVIDERS: ClimateProvider[] = [
  {
    id: "cptec-forecast", institution: "CPTEC/INPE", name: "Previsão de tempo por município (7 dias)",
    status: "live", kind: "FORECAST", variables: ["temperatura máx/mín", "condição de tempo", "índice UV"],
    docs: "http://servicos.cptec.inpe.br/XML/", notes: "Previsão operacional oficial do CPTEC."
  },
  {
    id: "cptec-capitals", institution: "CPTEC/INPE", name: "Condições atuais nas capitais (METAR)",
    status: "live", kind: "OBSERVED", variables: ["temperatura", "pressão", "umidade", "vento"],
    docs: "http://servicos.cptec.inpe.br/XML/", notes: "Observações de superfície em aeroportos das capitais."
  },
  {
    id: "nasa-power", institution: "NASA Langley (POWER)", name: "Série diária e climatologia por ponto",
    status: "live", kind: "MODEL",
    variables: ["temperatura", "precipitação", "pressão", "umidade", "vento", "radiação", "anomalias", "climatologia"],
    docs: "https://power.larc.nasa.gov/docs/services/api/",
    notes: "Reanálise MERRA-2 + CERES; cobre qualquer coordenada do Brasil desde 1981. Classificado como MODELO."
  },
  {
    id: "inmet-bdmep", institution: "INMET", name: "Estações automáticas e convencionais (API Tempo)",
    status: "pending", kind: "OBSERVED", variables: ["temperatura", "precipitação", "pressão", "umidade", "vento", "radiação"],
    docs: "https://portal.inmet.gov.br/manual",
    notes: "Integration pending — a API do INMET passou a exigir token institucional. O adaptador será habilitado com INMET_API_TOKEN."
  },
  {
    id: "inpe-queimadas", institution: "INPE", name: "Programa Queimadas / BDQueimadas",
    status: "pending", kind: "OBSERVED", variables: ["focos de calor"],
    docs: "https://terrabrasilis.dpi.inpe.br/queimadas/portal/",
    notes: "Integration pending — distribuição por arquivos/WMS; adaptador a ser implementado."
  },
  {
    id: "cemaden", institution: "CEMADEN", name: "Pluviômetros e alertas",
    status: "pending", kind: "OBSERVED", variables: ["precipitação"],
    docs: "https://www.gov.br/cemaden/", notes: "Integration pending — sem API pública documentada estável."
  }
];
