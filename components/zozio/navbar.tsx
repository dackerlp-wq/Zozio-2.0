import Link from "next/link";

import { ZozioButton } from "@/components/zozio/button";
import { ZozLogo } from "@/components/zozio/logo";
import { createClient } from "@/lib/supabase/server";

import { MobileMenu } from "./navbar-mobile-menu";

const NAV_LINKS = [
  { href: "/adopt", label: "Adoptuj" },
  { href: "/utulky", label: "Útulky" },
  { href: "/magazin", label: "Magazín" },
  { href: "/mapa", label: "Mapa" },
];

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = (user?.user_metadata?.role as string) ?? "public";
  const profileHref =
    role === "owner" || role === "admin" || role === "staff"
      ? "/admin/dashboard"
      : "/profil";

  return (
    <header className="sticky top-0 z-40 border-b border-ink-900/8 bg-cream/85 backdrop-blur supports-[backdrop-filter]:bg-cream/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <ZozLogo size="sm" />

        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-meadow-100/60 hover:text-meadow-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <ZozioButton asChild variant="ghost" size="sm">
                <Link href={profileHref}>Můj prostor</Link>
              </ZozioButton>
              <form action="/auth/logout" method="post">
                <ZozioButton type="submit" variant="outline" size="sm">
                  Odhlásit
                </ZozioButton>
              </form>
            </>
          ) : (
            <>
              <ZozioButton asChild variant="ghost" size="sm">
                <Link href="/auth/login">Přihlásit</Link>
              </ZozioButton>
              <ZozioButton asChild variant="meadow" size="sm" className="hidden sm:inline-flex">
                <Link href="/auth/register">Registrace</Link>
              </ZozioButton>
            </>
          )}
          <MobileMenu links={NAV_LINKS} />
        </div>
      </div>
    </header>
  );
}
