"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  type LucideIcon,
} from "lucide-react";

import { ZozLogo } from "@/components/zozio/logo";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/superadmin", label: "Přehled", icon: LayoutDashboard },
  { href: "/superadmin/institutions", label: "Útulky", icon: Building2 },
  { href: "/superadmin/users", label: "Uživatelé", icon: Users },
];

export function SuperadminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/10 bg-ink-900 text-cream lg:flex">
      <div className="border-b border-white/10 px-6 py-5">
        <ZozLogo size="sm" className="text-cream" />
        <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-coral-300">
          Superadmin
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active =
            item.href === "/superadmin"
              ? pathname === "/superadmin"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-white/15 text-cream"
                  : "text-cream/70 hover:bg-white/8 hover:text-cream",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-cream/60 hover:bg-white/8 hover:text-cream"
        >
          ← Zpět na web
        </Link>
      </div>
    </aside>
  );
}
