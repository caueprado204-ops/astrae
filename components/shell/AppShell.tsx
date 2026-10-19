"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogIn, LogOut, Menu, X } from "lucide-react";
import { NAV } from "./nav";
import { Logo } from "./Logo";
import { useUser } from "@/hooks/useUser";
import { Planet, Stars, type Tone } from "@/components/visual/Space";

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
            className={`group flex items-center gap-2.5 rounded-full px-3 py-1.5 text-[13.5px] transition-all ${active ? "bg-white/[.07] text-ink shadow-[inset_0_0_0_1px_rgb(var(--accent)/.35),0_0_18px_-6px_rgb(var(--accent)/.6)]" : "text-dim hover:bg-white/[.03] hover:text-ink"}`}
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
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-white/[.06] bg-bg/60 px-3 py-5 backdrop-blur-xl lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2 pt-1"><Logo /><span className="font-wide text-[15px] tracking-[0.18em]">ASTRAE</span></Link>
        <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
        {account}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <Link href="/" className="flex items-center gap-2"><Logo size={20} /><span className="font-wide text-sm tracking-[0.18em]">ASTRAE</span></Link>
          <button onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
        </header>
        {open && (
          <div className="fixed inset-0 z-50 bg-bg/70 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
            <div className="h-full w-64 border-r border-line bg-bg/95 p-4 backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
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

const TONE_BY_PATH: [RegExp, Tone, string][] = [
  [/^\/mars/, "mars", "Planetary · Mars"],
  [/^\/planetary/, "ice", "Planetary"],
  [/^\/ai/, "aurora", "Assistente"],
  [/^\/(enso|climate)/, "earth", "Clima"],
  [/^\/(earth|maps)/, "earth", "Terra"],
  [/^\/(study)/, "aurora", "Estudo"],
  [/^\/(research|notebook|saved)/, "ice", "Laboratório"],
  [/^\/(search|data|sources)/, "earth", "Dados"],
  [/^\/settings/, "ice", "Conta"]
];

/** Cabeçalho de seção: cena espacial com horizonte planetário — a cor do planeta muda por área. */
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  const path = usePathname();
  const [, tone, eyebrow] = TONE_BY_PATH.find(([re]) => re.test(path)) || [null, "earth" as Tone, "ASTRAE"];
  const seed = Array.from(path).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return (
    <header className="space-scene relative isolate mb-6 overflow-hidden rounded-3xl border border-white/10">
      <Stars count={70} seed={seed} />
      <Planet tone={tone} top="62%" left="72%" width="max(900px, 130%)" />
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(3,7,15,.92) 0%, rgba(3,7,15,.55) 45%, transparent 75%), linear-gradient(0deg, rgba(3,7,15,.85) 0%, transparent 45%)" }} />
      <div className="relative flex min-h-[190px] flex-wrap items-end justify-between gap-4 p-5 sm:min-h-[220px] sm:p-7">
        <div className="astrae-rise max-w-2xl">
          <p className="eyebrow text-white/55">{eyebrow}</p>
          <h1 className="font-wide mt-2 text-[26px] leading-tight text-white sm:text-[38px]">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-white/70">{subtitle}</p>}
        </div>
        {children && <div className="relative">{children}</div>}
      </div>
    </header>
  );
}
