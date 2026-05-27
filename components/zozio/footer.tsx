import Link from "next/link";
import { Mail } from "lucide-react";

import { ZozLogo } from "@/components/zozio/logo";

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H8v-3h2.4V9.4c0-2.4 1.4-3.7 3.5-3.7 1 0 2.1.2 2.1.2v2.3h-1.2c-1.2 0-1.5.7-1.5 1.4V12h2.6l-.4 3h-2.2v7A10 10 0 0 0 22 12z" />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

const FOOTER_COLS = [
  {
    title: "Adoptuj",
    links: [
      { href: "/adopt", label: "Všechna zvířata" },
      { href: "/adopt?species=dog", label: "Psi" },
      { href: "/adopt?species=cat", label: "Kočky" },
      { href: "/mapa", label: "Mapa útulků" },
    ],
  },
  {
    title: "Pro útulky",
    links: [
      { href: "/pro-utulky", label: "Proč být na Zoziu" },
      { href: "/auth/register?role=institution", label: "Registrace útulku" },
      { href: "/cenik", label: "Ceník" },
      { href: "/widget", label: "Embed widget" },
    ],
  },
  {
    title: "Zozio",
    links: [
      { href: "/magazin", label: "Magazín" },
      { href: "/o-nas", label: "O nás" },
      { href: "/kontakt", label: "Kontakt" },
      { href: "/podpor-nas", label: "Podpoř Zozio" },
    ],
  },
  {
    title: "Právní",
    links: [
      { href: "/obchodni-podminky", label: "Obchodní podmínky" },
      { href: "/zasady-soukromi", label: "Zásady soukromí" },
      { href: "/cookies", label: "Cookies" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-ink-900/8 bg-cream-warm">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_3fr]">
          <div className="space-y-6">
            <ZozLogo size="md" />
            <p className="max-w-sm text-sm leading-relaxed text-ink-600">
              Adopce, která tě chytne za srdce. A za tlapku. Pomáháme útulkům
              po celém Česku a Slovensku najít zvířatům nový domov.
            </p>
            <div className="flex items-center gap-2">
              <SocialLink href="https://facebook.com/zozio" label="Facebook">
                <FacebookIcon className="size-4" />
              </SocialLink>
              <SocialLink href="https://instagram.com/zozio" label="Instagram">
                <InstagramIcon className="size-4" />
              </SocialLink>
              <SocialLink href="mailto:ahoj@zozio.cz" label="Email">
                <Mail className="size-4" />
              </SocialLink>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <h4 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-ink-900">
                  {col.title}
                </h4>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-ink-600 transition-colors hover:text-meadow-700"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-ink-900/8 pt-8 text-xs text-ink-400 md:flex-row md:items-center">
          <span>© {new Date().getFullYear()} Zozio. Postaveno s láskou v Praze.</span>
          <span>
            Hostováno na <span className="text-ink-600">Vercel</span> · DB{" "}
            <span className="text-ink-600">Supabase</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex size-9 items-center justify-center rounded-full bg-cream text-ink-700 ring-1 ring-ink-900/10 transition-all hover:bg-meadow-500 hover:text-cream hover:ring-meadow-500"
    >
      {children}
    </a>
  );
}
