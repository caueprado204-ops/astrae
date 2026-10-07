"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/AppShell";
import { useUser } from "@/hooks/useUser";

export default function SettingsPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [cfg, setCfg] = useState<Record<string, boolean> | null>(null);
  const { sb, user } = useUser();
  const [profile, setProfile] = useState({ display_name: "", institution: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    fetch("/api/settings").then((r) => r.json()).then(setCfg);
  }, []);
  useEffect(() => {
    if (sb && user) sb.from("profiles").select("display_name,institution").eq("id", user.id).maybeSingle().then(({ data }) => data && setProfile({ display_name: data.display_name || "", institution: data.institution || "" }));
  }, [sb, user]);

  function applyTheme(t: "dark" | "light") {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("astrae-theme", t); } catch { /* armazenamento indisponível */ }
  }

  const row = (label: string, ok: boolean | undefined, hint: string) => (
    <li className="flex items-start justify-between gap-4 py-2.5">
      <div><p className="text-sm">{label}</p><p className="text-xs text-dim">{hint}</p></div>
      <span className={`shrink-0 text-xs ${ok ? "text-ok" : "text-warn"}`}>{ok === undefined ? "…" : ok ? "● Configurado" : "○ Não configurado"}</span>
    </li>
  );

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Settings" />
      <section className="panel p-4">
        <h2 className="font-medium">Aparência</h2>
        <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Tema">
          {(["dark", "light"] as const).map((t) => <button key={t} role="radio" aria-checked={theme === t} onClick={() => applyTheme(t)} className={`btn ${theme === t ? "border-accent" : ""}`}>{t === "dark" ? "Escuro" : "Claro"}</button>)}
        </div>
      </section>

      {user && (
        <section className="panel space-y-3 p-4">
          <h2 className="font-medium">Perfil</h2>
          <label className="block"><span className="label">Nome</span><input className="input mt-1" value={profile.display_name} onChange={(e) => { setProfile({ ...profile, display_name: e.target.value }); setSaved(false); }} /></label>
          <label className="block"><span className="label">Instituição</span><input className="input mt-1" value={profile.institution} onChange={(e) => { setProfile({ ...profile, institution: e.target.value }); setSaved(false); }} /></label>
          <button className="btn-primary" onClick={async () => { await sb!.from("profiles").update(profile).eq("id", user.id); setSaved(true); }}>{saved ? "Perfil salvo" : "Salvar perfil"}</button>
        </section>
      )}

      <section className="panel p-4">
        <h2 className="font-medium">Integrações do servidor</h2>
        <p className="mt-1 text-xs text-dim">Chaves ficam apenas em <code className="font-mono">.env.local</code> no servidor. Esta tela mostra se existem, nunca o valor.</p>
        <ul className="mt-2 divide-y divide-line">
          {row("NASA_API_KEY", cfg?.nasaKey, "APOD. Sem ela o backend usa DEMO_KEY, com limite baixo por IP.")}
          {row("NOAA_API_KEY", cfg?.noaaKey, "NOAA NCEI Climate Data Online (estações GHCN-Daily).")}
          {row("Supabase", cfg?.supabase, "Login, projetos, caderno e datasets salvos.")}
          {row("Cache persistente", cfg?.persistentCache, "SUPABASE_SERVICE_ROLE_KEY — guarda respostas das APIs entre reinícios.")}
          {row("GEOCODER_CONTACT", cfg?.geocoderContact, "Contato exigido pela política do Nominatim/OSM para busca de lugares.")}
        </ul>
      </section>

      <section className="panel p-4">
        <h2 className="font-medium">ASTRAE AI</h2>
        <ul className="mt-1 divide-y divide-line">
          {row("ANTHROPIC_API_KEY", cfg?.ai, "Assistente que responde só com dados consultados nas fontes oficiais e cita cada uma. Modelo ajustável por ANTHROPIC_MODEL.")}
        </ul>
      </section>
    </div>
  );
}
