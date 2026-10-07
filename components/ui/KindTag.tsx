import type { DataKind } from "@/types/science";

const STYLE: Record<DataKind, { label: string; cls: string; title: string }> = {
  OBSERVED: { label: "Observed", cls: "border-ok/50 text-ok", title: "Medição direta de instrumento" },
  FORECAST: { label: "Forecast", cls: "border-warn/50 text-warn", title: "Previsão — não é observação" },
  MODEL: { label: "Model", cls: "border-accent/50 text-accent", title: "Modelo ou reanálise" },
  ESTIMATE: { label: "Estimate", cls: "border-nina/60 text-nina", title: "Estimativa derivada (ex.: satélite)" },
  SIMULATION: { label: "Simulation", cls: "border-dim/60 text-dim", title: "Simulação / cenário" },
  INDEX: { label: "Index", cls: "border-nino/50 text-nino", title: "Índice derivado oficial" },
  CATALOG: { label: "Catalog", cls: "border-line text-dim", title: "Metadados / referência" },
  IMAGERY: { label: "Imagery", cls: "border-line text-dim", title: "Imagem" },
  DEMO: { label: "Demo data", cls: "border-bad text-bad", title: "Dado de exemplo — não é dado científico real" }
};

export function KindTag({ kind }: { kind: DataKind }) {
  const s = STYLE[kind];
  return (
    <span title={s.title} className={`inline-flex items-center rounded border px-1.5 py-px font-mono text-[10.5px] ${s.cls}`}>
      {s.label}
    </span>
  );
}
