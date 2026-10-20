import {
  Activity, Bookmark, BookOpen, Cloud, Database, FlaskConical, Globe2, GraduationCap, HeartPulse, Info, LayoutDashboard, Library,
  Map, MapPinned, Orbit, Search, Settings, Sparkles, Telescope, Waves, type LucideIcon
} from "lucide-react";

/**
 * Navegação organizada pelos dois eixos de pesquisa.
 * Pesquisa → onde as investigações acontecem; Observatório → acompanhamento de indicadores;
 * Caderno → organização do trabalho; Espaço → módulos planetários originais da ASTRAE (preservados);
 * Plataforma → fontes, método e configurações.
 */
export interface NavItem { href: string; label: string; icon: LucideIcon }
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Pesquisa", items: [
    { href: "/overview", label: "Início", icon: LayoutDashboard },
    { href: "/health", label: "Clima e Saúde", icon: HeartPulse },
    { href: "/territory", label: "Território", icon: MapPinned },
    { href: "/data", label: "Laboratório de dados", icon: Database },
    { href: "/search", label: "Busca científica", icon: Search },
    { href: "/ai", label: "ASTRAE AI", icon: Sparkles }
  ] },
  { label: "Observatório", items: [
    { href: "/climate", label: "Clima no Brasil", icon: Cloud },
    { href: "/enso", label: "El Niño e La Niña", icon: Waves },
    { href: "/earth", label: "Observação da Terra", icon: Globe2 },
    { href: "/maps", label: "Map Lab", icon: Map }
  ] },
  { label: "Caderno científico", items: [
    { href: "/research", label: "Investigações", icon: FlaskConical },
    { href: "/notebook", label: "Caderno", icon: BookOpen },
    { href: "/saved", label: "Dados salvos", icon: Bookmark },
    { href: "/study", label: "Estudar", icon: GraduationCap }
  ] },
  { label: "Espaço", items: [
    { href: "/mars", label: "Marte", icon: Orbit },
    { href: "/planetary", label: "Planetário", icon: Telescope }
  ] },
  { label: "Plataforma", items: [
    { href: "/sources", label: "Biblioteca de dados", icon: Library },
    { href: "/about", label: "Sobre a ASTRAE", icon: Info },
    { href: "/settings", label: "Configurações", icon: Settings }
  ] }
];

export const NAV = NAV_GROUPS.flatMap((g) => g.items);
export const StatusIcon = Activity;
