import {
  Activity, Bookmark, BookOpen, Cloud, Database, FlaskConical, Globe2, LayoutDashboard, Map, Orbit, Search, Settings, Waves, Network, Telescope, Sparkles
} from "lucide-react";

export const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/search", label: "Search", icon: Search },
  { href: "/ai", label: "ASTRAE AI", icon: Sparkles },
  { href: "/earth", label: "Earth", icon: Globe2 },
  { href: "/climate", label: "Climate", icon: Cloud },
  { href: "/enso", label: "ENSO", icon: Waves },
  { href: "/mars", label: "Mars", icon: Orbit },
  { href: "/planetary", label: "Planetary", icon: Telescope },
  { href: "/maps", label: "Maps", icon: Map },
  { href: "/data", label: "Data", icon: Database },
  { href: "/research", label: "Research", icon: FlaskConical },
  { href: "/notebook", label: "Notebook", icon: BookOpen },
  { href: "/saved", label: "Saved datasets", icon: Bookmark },
  { href: "/sources", label: "Sources", icon: Network },
  { href: "/settings", label: "Settings", icon: Settings }
] as const;

export const StatusIcon = Activity;
