"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/shell/Logo";
import { getBrowserClient } from "@/lib/supabase/client";

function LoginForm() {
  const sb = getBrowserClient();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/overview";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!sb) {
    return (
      <div className="space-y-3 text-sm text-dim">
        <p className="text-ink">A autenticação ainda não está configurada.</p>
        <p>Crie um projeto no Supabase, rode <code className="font-mono text-ink">supabase/migrations/0001_astrae_schema.sql</code> e preencha <code className="font-mono text-ink">NEXT_PUBLIC_SUPABASE_URL</code> e <code className="font-mono text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> em <code className="font-mono text-ink">.env.local</code>.</p>
        <p>Enquanto isso, todos os dados públicos funcionam no modo local.</p>
        <Link href="/overview" className="btn-primary mt-2">Continuar no modo local</Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setBusy(true); setMsg(null);
    const redirect = `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = mode === "signin"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    if (mode === "signup") return setMsg({ ok: true, text: "Conta criada. Confirme pelo link enviado ao seu e-mail." });
    router.push(next); router.refresh();
  }

  async function magic() {
    if (!sb || !email) return setMsg({ ok: false, text: "Informe o e-mail para receber o link." });
    setBusy(true);
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Link de acesso enviado. Confira sua caixa de entrada." });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block"><span className="label">E-mail</span><input className="input mt-1" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="block"><span className="label">Senha</span><input className="input mt-1" type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button className="btn-primary w-full justify-center" disabled={busy}>{mode === "signin" ? "Entrar" : "Criar conta"}</button>
      <button type="button" className="btn w-full justify-center" onClick={magic} disabled={busy}>Receber link de acesso por e-mail</button>
      <button type="button" className="w-full text-center text-xs text-dim hover:text-ink" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
      </button>
      {msg && <p className={`text-sm ${msg.ok ? "text-ok" : "text-bad"}`}>{msg.text}</p>}
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center gap-2"><Logo /><span className="font-display font-semibold tracking-[0.08em]">ASTRAE</span></Link>
        <h1 className="font-display text-2xl">Scientific Intelligence for Earth &amp; Space</h1>
        <p className="mb-6 mt-1 text-sm text-dim">Entre para salvar projetos, datasets e cadernos. Seus dados são privados por padrão.</p>
        <Suspense><LoginForm /></Suspense>
      </div>
    </div>
  );
}
