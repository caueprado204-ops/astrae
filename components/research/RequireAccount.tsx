"use client";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";
import { Loading } from "@/components/ui/DataState";

/** Espaço pessoal: exige Supabase configurado e usuário autenticado. Nada é público por padrão. */
export function RequireAccount({ children }: { children: React.ReactNode }) {
  const { user, ready, configured } = useUser();
  if (!configured) return (
    <div className="panel max-w-xl p-5 text-sm">
      <p className="text-ink">Esta área guarda dados pessoais e precisa de um banco de dados.</p>
      <p className="mt-2 text-dim">Configure o Supabase (veja o README: rode a migração <code className="font-mono">supabase/migrations/0001_astrae_schema.sql</code> e preencha as variáveis no <code className="font-mono">.env.local</code>). Os módulos de dados públicos continuam funcionando sem isso.</p>
    </div>
  );
  if (!ready) return <Loading label="Verificando sessão…" />;
  if (!user) return (
    <div className="panel max-w-xl p-5 text-sm">
      <p>Entre na sua conta para acessar projetos, notas e datasets salvos.</p>
      <Link href="/login" className="btn-primary mt-3">Entrar</Link>
    </div>
  );
  return <>{children}</>;
}
