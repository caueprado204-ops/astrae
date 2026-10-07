"use client";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/AppShell";
import { GibsMap, type ActiveLayer } from "@/components/maps/GibsMap";
import { useGibsVariables } from "@/components/maps/useGibs";
import { Legend } from "@/components/maps/Legend";
import { daysAgo, snapTime } from "@/components/maps/gibs-client";
import { KindTag } from "@/components/ui/KindTag";
import { ErrorState, Loading } from "@/components/ui/DataState";
import { Provenance } from "@/components/ui/Provenance";
import { SaveActions } from "@/components/research/SaveToResearch";

const ORDER = ["base", "truecolor", "temperature", "lst", "sst", "sst_anomaly", "precipitation", "clouds", "humidity", "pressure", "wind", "aerosols", "labels"];

export default function EarthObservatory() {
  const gibs = useGibsVariables();
  const [on, setOn] = useState<Record<string, boolean>>({ base: true, sst_anomaly: true, labels: true });
  const [opacity, setOpacity] = useState<Record<string, number>>({});
  const [choice, setChoice] = useState<Record<string, number>>({});
  const [date, setDate] = useState(daysAgo(2));
  const [cursor, setCursor] = useState<{ lng: number; lat: number } | null>(null);

  const vars = useMemo(() => ORDER.map((k) => gibs.byKey[k]).filter(Boolean), [gibs.byKey]);
  const active: ActiveLayer[] = useMemo(() => vars.filter((v) => on[v.key] && v.available)
    .map((v) => ({ layer: v.layers[choice[v.key] ?? 0], opacity: opacity[v.key] ?? (v.key === "base" || v.key === "truecolor" ? 1 : 0.85) })), [vars, on, opacity, choice]);

  return (
    <div>
      <PageHeader title="Earth Observatory" subtitle="Camadas globais de satélite e reanálise do NASA GIBS. A lista de camadas é lida do catálogo oficial a cada 12 h — só aparece o que existe de fato.">
        <label className="flex items-center gap-2 text-sm"><span className="label">Data</span>
          <input type="date" className="input w-auto" value={date} max={daysAgo(0)} min="2000-03-01" onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
      </PageHeader>

      {gibs.state === "loading" && <Loading label="Lendo o catálogo de camadas do NASA GIBS…" />}
      {gibs.state === "error" && <ErrorState error={gibs.env?.error} onRetry={gibs.retry} />}

      {gibs.state === "success" && (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <aside className="panel max-h-[640px] overflow-y-auto p-3" aria-label="Camadas">
            <ul className="space-y-1">
              {vars.map((v) => {
                const layer = v.layers[choice[v.key] ?? 0];
                return (
                  <li key={v.key} className={`rounded-md p-2 ${on[v.key] ? "bg-panel2" : ""}`}>
                    <label className={`flex items-center gap-2 text-sm ${v.available ? "" : "opacity-50"}`}>
                      <input type="checkbox" disabled={!v.available} checked={!!on[v.key]} onChange={(e) => setOn({ ...on, [v.key]: e.target.checked })} className="accent-[rgb(var(--accent))]" />
                      <span className="flex-1">{v.label}</span>
                      <KindTag kind={v.kind} />
                    </label>
                    {!v.available && <p className="ml-6 mt-1 text-xs text-faint">Sem camada correspondente no GIBS hoje.</p>}
                    {on[v.key] && layer && (
                      <div className="ml-6 mt-2 space-y-1.5 text-xs text-dim">
                        {v.layers.length > 1 && (
                          <select className="input py-1 text-xs" value={choice[v.key] ?? 0} onChange={(e) => setChoice({ ...choice, [v.key]: Number(e.target.value) })}>
                            {v.layers.map((l, i) => <option key={l.id} value={i}>{l.title}</option>)}
                          </select>
                        )}
                        <p className="leading-snug">{layer.title}</p>
                        <p className="font-mono text-[10.5px] text-faint">{layer.id} · {layer.hasTime ? `exibindo ${snapTime(layer, date)}` : "estático"}</p>
                        {v.note && <p className="text-faint">{v.note}</p>}
                        <label className="flex items-center gap-2">Opacidade
                          <input type="range" min={0.1} max={1} step={0.05} value={opacity[v.key] ?? (v.key === "base" ? 1 : 0.85)} onChange={(e) => setOpacity({ ...opacity, [v.key]: Number(e.target.value) })} className="flex-1" />
                        </label>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="min-w-0">
            <div className="relative">
              <GibsMap layers={active} date={date} onCursor={setCursor} className="h-[460px] sm:h-[640px]" />
              <div className="pointer-events-none absolute bottom-8 right-3 rounded bg-bg/80 px-2 py-1 font-mono text-[11px] text-dim">
                {cursor ? `${cursor.lat.toFixed(3)}°, ${cursor.lng.toFixed(3)}°` : "lat, lon"}
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {active.filter((a) => a.layer.legendUrl && !/Blue|Coast|Reference|TrueColor/.test(a.layer.id)).map((a) => (
                <div key={a.layer.id}><p className="mb-1 text-xs text-dim">{a.layer.title}</p><Legend layer={a.layer} /></div>
              ))}
            </div>
            <div className="mt-3">
              <SaveActions item={{
                externalId: `gibs-map:${active.map((a) => a.layer.id).join("+")}:${date}`, title: `Mapa GIBS — ${active.map((a) => a.layer.title).join(", ")} (${date})`,
                itemType: "map", source: "NASA", institution: "NASA ESDIS · GIBS", kind: "IMAGERY",
                originalUrl: "https://worldview.earthdata.nasa.gov/", provenance: { dataset: "NASA GIBS", period: date },
                payload: { layers: active.map((a) => ({ id: a.layer.id, opacity: a.opacity })), date }
              }} />
            </div>
            <Provenance p={gibs.env?.provenance} storedAt={gibs.env?.cache?.storedAt} stale={gibs.env?.cache?.stale} />
          </div>
        </div>
      )}
    </div>
  );
}
