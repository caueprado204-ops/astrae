"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogIn, LogOut, Menu, X } from "lucide-react";
import { NAV } from "./nav";
import { Logo } from "./Logo";
import { useUser } from "@/hooks/useUser";

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { user, configured, sb } = useUser();

  const nav = (
    <nav aria-label="Principal" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link key={href} href={href} onClick={() => setOpen(false)}
            className={`group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] transition-colors ${active ? "bg-panel2 text-ink" : "text-dim hover:text-ink"}`}
            aria-current={active ? "page" : undefined}>
            <Icon size={15} className={active ? "text-accent" : "text-faint group-hover:text-dim"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const account = (
    <div className="border-t border-line pt-3 text-xs text-dim">
      {!configured && <p className="mb-2 leading-relaxed">Modo local: dados públicos ao vivo. Projetos e notas exigem Supabase.</p>}
      {configured && user && (
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">{user.email}</span>
          <button aria-label="Sair" className="hover:text-ink" onClick={async () => { await sb?.auth.signOut(); router.push("/login"); }}><LogOut size={14} /></button>
        </div>
      )}
      {configured && !user && <Link href="/login" className="inline-flex items-center gap-1.5 hover:text-ink"><LogIn size={14} /> Entrar</Link>}
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-5 border-r border-line bg-bg/80 px-3 py-4 backdrop-blur lg:flex">
        <Link href="/" className="flex items-center gap-2 px-2"><Logo /><span className="font-display text-[17px] font-semibold tracking-[0.08em]">ASTRAE</span></Link>
        <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
        {account}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <Link href="/" className="flex items-center gap-2"><Logo size={20} /><span className="font-display font-semibold tracking-[0.08em]">ASTRAE</span></Link>
          <button onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
        </header>
        {open && (
          <div className="fixed inset-0 z-50 bg-bg/70 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
            <div className="h-full w-64 border-r border-line bg-panel p-4" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex justify-end"><button onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={20} /></button></div>
              {nav}
              <div className="mt-6">{account}</div>
            </div>
          </div>
        )}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl font-medium sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm leading-relaxed text-dim">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
