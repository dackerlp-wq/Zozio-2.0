"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  CheckSquare,
  ChevronDown,
  FileSpreadsheet,
  Globe,
  HeartHandshake,
  Home,
  Inbox,
  LayoutDashboard,
  Loader2,
  Menu,
  PawPrint,
  Search,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { ZozLogo } from "@/components/zozio/logo";
import { cn } from "@/lib/utils";
import { SPECIES_LABEL } from "@/lib/format";
import type { MemberRole, Species } from "@/types/database";

type HousingMode = "physical" | "foster_network" | "hybrid";

export interface SidebarBadges {
  applications: number;
  tasksOverdue: number;
  tasksToday: number;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** owner/admin only (staff nevidí). */
  adminOnly?: boolean;
  badge?: { count: number; tone: "error" | "amber" };
  /** Skrýt položku úplně. */
  hidden?: boolean;
  /** Malý štítek (např. režim útulku u Kotců). */
  adapt?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Vlastník",
  admin: "Správce",
  staff: "Zaměstnanec",
  volunteer: "Dobrovolník",
};

const MODE_BADGE: Record<HousingMode, string> = {
  physical: "🏠 Kamenný útulek",
  foster_network: "🤝 Pěstounská síť",
  hybrid: "🏠🤝 Hybrid",
};

/** Podsekce Statistiky — rozbalovací podmenu v sidebaru. */
const STATS_SUBSECTIONS: { key: string; label: string }[] = [
  { key: "prehled", label: "Přehled" },
  { key: "zvirata", label: "Zvířata" },
  { key: "adopce", label: "Adopce" },
  { key: "pestouni", label: "Pěstouni" },
  { key: "obsazenost", label: "Obsazenost" },
  { key: "finance", label: "Finance" },
  { key: "web", label: "Web & zájem" },
];

/** Podsekce Nastavení — rozbalovací podmenu v sidebaru. */
const SETTINGS_SUBSECTIONS: { key: string; label: string }[] = [
  { key: "profil", label: "Profil & zveřejnění" },
  { key: "provoz", label: "Provoz" },
  { key: "evidence", label: "Evidence & lhůty" },
  { key: "adopce", label: "Adopce" },
  { key: "web", label: "Web & katalog" },
  { key: "dary", label: "Dary & platby" },
  { key: "email", label: "E-maily & notifikace" },
  { key: "reklamy", label: "Reklamy" },
  { key: "predplatne", label: "Předplatné" },
  { key: "ucet", label: "Účet & data" },
];

export function AdminSidebar({
  role,
  institutionName,
  housingMode,
  fosterEnabled,
  userEmail,
  badges,
}: {
  role: MemberRole;
  institutionName: string;
  housingMode: HousingMode;
  fosterEnabled: boolean;
  userEmail: string;
  badges: SidebarBadges;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSekce = searchParams.get("sekce") ?? "profil";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isAdmin = role === "owner" || role === "admin";

  const taskBadge: NavItem["badge"] =
    badges.tasksOverdue > 0
      ? { count: badges.tasksOverdue, tone: "error" }
      : badges.tasksToday > 0
        ? { count: badges.tasksToday, tone: "amber" }
        : undefined;

  const groups: NavGroup[] = [
    {
      label: "Hlavní",
      items: [
        { href: "/admin/dashboard", label: "Přehled", icon: LayoutDashboard },
        { href: "/admin/animals", label: "Zvířata", icon: PawPrint },
      ],
    },
    {
      label: "Provoz",
      items: [
        {
          href: "/admin/applications",
          label: "Žádosti",
          icon: Inbox,
          badge: badges.applications > 0 ? { count: badges.applications, tone: "error" } : undefined,
        },
        { href: "/admin/tasks", label: "Úkoly", icon: CheckSquare, badge: taskBadge },
      ],
    },
    {
      label: "Zázemí",
      items: [
        {
          href: "/admin/kennels",
          label: "Kotce",
          icon: Home,
          hidden: housingMode === "foster_network",
          adapt: housingMode === "hybrid" ? "hybrid" : "kamenný",
        },
        { href: "/admin/foster", label: "Pěstouni", icon: HeartHandshake, hidden: !fosterEnabled },
      ],
    },
    {
      label: "Výstupy",
      items: [{ href: "/admin/exports", label: "Evidence & exporty", icon: FileSpreadsheet }],
    },
    {
      label: "Web & finance",
      items: [
        { href: "/admin/donations", label: "Sbírky & dárci", icon: HeartHandshake },
        { href: "/admin/content", label: "Web & obsah", icon: Globe },
        { href: "/admin/stats", label: "Statistiky", icon: BarChart3, adminOnly: true },
      ],
    },
    {
      label: "Systém",
      items: [
        { href: "/admin/team", label: "Tým", icon: Users, adminOnly: true },
        { href: "/admin/settings", label: "Nastavení", icon: Settings, adminOnly: true },
      ],
    },
  ];

  const content = (
    <div className="flex h-full flex-col">
      {/* Brand + instituce */}
      <div className="px-3 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2 px-2">
          <ZozLogo size="sm" className="text-ink-900" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm lg:hidden"
            aria-label="Zavřít menu"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-3 rounded-xl bg-cream-warm/70 p-3 ring-1 ring-ink-900/8">
          <div className="truncate text-sm font-bold text-ink-900">{institutionName}</div>
          <span className="mt-1 inline-block rounded-pill bg-meadow-50 px-2 py-0.5 text-[11px] font-bold text-meadow-700">
            {MODE_BADGE[housingMode]}
          </span>
        </div>
      </div>

      {/* Hledání */}
      <div className="px-3 pb-2">
        <AdminSearch />
      </div>

      {/* Skupiny */}
      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        {groups.map((g) => {
          const items = g.items.filter((i) => !i.hidden && (!i.adminOnly || isAdmin));
          if (items.length === 0) return null;
          return (
            <div key={g.label} className="mb-1">
              <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                {g.label}
              </p>
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                // Statistiky = rozbalovací podmenu.
                if (item.href === "/admin/stats") {
                  return (
                    <div key={item.href} className="mb-0.5">
                      <Link
                        href="/admin/stats"
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition-colors",
                          active ? "bg-meadow-500 text-cream" : "text-ink-700 hover:bg-cream-warm",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        <ChevronDown className={cn("size-4 transition-transform", active && "rotate-180")} />
                      </Link>
                      {active && (
                        <div className="ml-5 mt-1 flex flex-col gap-0.5 border-l-2 border-ink-900/10 pl-2">
                          {STATS_SUBSECTIONS.map((sub) => {
                            const on = activeSekce === sub.key;
                            return (
                              <Link
                                key={sub.key}
                                href={`/admin/stats?sekce=${sub.key}`}
                                className={cn(
                                  "rounded-lg px-3 py-1.5 text-[13px] font-bold transition-colors",
                                  on ? "bg-meadow-50 text-meadow-700" : "text-ink-600 hover:bg-cream-warm",
                                )}
                              >
                                {sub.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // Nastavení = rozbalovací podmenu.
                if (item.href === "/admin/settings") {
                  return (
                    <div key={item.href} className="mb-0.5">
                      <Link
                        href="/admin/settings"
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition-colors",
                          active ? "bg-meadow-500 text-cream" : "text-ink-700 hover:bg-cream-warm",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        <ChevronDown className={cn("size-4 transition-transform", active && "rotate-180")} />
                      </Link>
                      {active && (
                        <div className="ml-5 mt-1 flex flex-col gap-0.5 border-l-2 border-ink-900/10 pl-2">
                          {SETTINGS_SUBSECTIONS.map((s) => {
                            const on = activeSekce === s.key;
                            return (
                              <Link
                                key={s.key}
                                href={`/admin/settings?sekce=${s.key}`}
                                className={cn(
                                  "rounded-lg px-3 py-1.5 text-[13px] font-bold transition-colors",
                                  on ? "bg-meadow-50 text-meadow-700" : "text-ink-600 hover:bg-cream-warm",
                                )}
                              >
                                {s.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition-colors",
                      active ? "bg-meadow-500 text-cream" : "text-ink-700 hover:bg-cream-warm",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.adapt && !active && (
                      <span className="rounded-pill bg-ink-900/8 px-1.5 py-0.5 text-[9px] font-bold text-ink-500">
                        {item.adapt}
                      </span>
                    )}
                    {item.badge && (
                      <span
                        className={cn(
                          "rounded-pill px-1.5 py-0.5 text-[11px] font-bold",
                          active
                            ? "bg-cream text-meadow-700"
                            : item.badge.tone === "error"
                              ? "bg-terracotta-500 text-cream"
                              : "bg-sunshine-500 text-ink-900",
                        )}
                      >
                        {item.badge.count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Patička */}
      <div className="border-t border-ink-900/8 p-3">
        <div className="flex items-center gap-2 px-1">
          <span className="flex size-9 items-center justify-center rounded-full bg-sand text-base">🧑</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-ink-900">{userEmail}</div>
            <div className="text-[11px] text-ink-400">{ROLE_LABEL[role]}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Link href="/" className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-500 hover:bg-cream-warm">
            ← Web
          </Link>
          <form action="/auth/logout" method="post">
            <button type="submit" className="rounded-lg px-2 py-1 text-xs font-semibold text-meadow-700 hover:bg-meadow-50">
              Odhlásit
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobilní hamburger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 rounded-xl bg-cream p-2 text-ink-700 shadow-soft-md ring-1 ring-ink-900/10 lg:hidden"
        aria-label="Otevřít menu"
      >
        <Menu className="size-5" />
      </button>

      {/* Mobilní drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-cream shadow-xl ring-1 ring-ink-900/10">
            {content}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-ink-900/8 bg-cream/80 lg:block">
        {content}
      </aside>
    </>
  );
}

// --- Globální hledání ------------------------------------------------------

interface SearchHit {
  id: string;
  name: string;
  record_number: string | null;
  species: Species;
  adoption_status: string;
}

function AdminSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Zkratka "/" zaostří hledání.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = document.activeElement?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        /* zrušený požadavek */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-pill bg-cream-warm px-3 py-2 ring-1 ring-ink-900/10 focus-within:ring-2 focus-within:ring-meadow-300">
        <Search className="size-4 text-ink-400" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Hledat zvíře, číslo…"
          className="w-full bg-transparent text-sm font-semibold text-ink-900 placeholder:text-ink-400 focus:outline-none"
        />
        {loading && <Loader2 className="size-4 animate-spin text-ink-400" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl bg-cream shadow-soft-md ring-1 ring-ink-900/10">
          {results.map((r) => (
            <Link
              key={r.id}
              href={`/admin/animals/${r.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-cream-warm"
            >
              <span className="font-bold text-ink-900">{r.name}</span>
              <span className="text-xs text-ink-400">{SPECIES_LABEL[r.species] ?? r.species}</span>
              {r.record_number && (
                <span className="ml-auto font-mono text-[11px] text-ink-400">{r.record_number}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
