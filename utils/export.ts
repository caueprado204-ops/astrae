import type { Provenance, Series } from "@/types/science";

export function download(filename: string, content: string | Blob, mime = "text/plain") {
  const blob = typeof content === "string" ? new Blob([content], { type: mime }) : content;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** CSV com cabeçalho de proveniência (linhas comentadas com #). */
export function seriesToCsv(series: Series[], p?: Provenance | null) {
  const header: string[] = [];
  if (p) {
    header.push(`# source: ${p.source}`, `# institution: ${p.institution}`, `# dataset: ${p.dataset}`,
      `# kind: ${p.kind}`, `# original_url: ${p.originalUrl}`, `# accessed_at: ${p.accessedAt}`);
    if (p.location) header.push(`# location: ${p.location}`);
    if (p.period) header.push(`# period: ${p.period}`);
  }
  const times = Array.from(new Set(series.flatMap((s) => s.points.map((x) => x.t))));
  const maps = series.map((s) => new Map(s.points.map((x) => [x.t, x.v])));
  const cols = ["time", ...series.map((s) => esc(`${s.label}${s.unit ? ` (${s.unit})` : ""} [${s.kind}]`))];
  const rows = times.map((t) => [t, ...maps.map((m) => { const v = m.get(t); return v == null ? "" : String(v); })].join(","));
  return [...header, cols.join(","), ...rows].join("\n");
}

export function seriesToJson(series: Series[], p?: Provenance | null) {
  return JSON.stringify({ provenance: p ?? null, exportedAt: new Date().toISOString(), series }, null, 2);
}

export const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
