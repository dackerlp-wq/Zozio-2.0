"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";

interface MobileMenuProps {
  links: { href: string; label: string }[];
}

export function MobileMenu({ links }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ZozioButton
        type="button"
        variant="ghost"
        size="icon"
        aria-label={open ? "Zavřít menu" : "Otevřít menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="lg:hidden"
      >
        {open ? <X /> : <Menu />}
      </ZozioButton>

      {open && (
        <div
          className="fixed inset-x-0 top-16 z-30 border-b border-ink-900/8 bg-cream shadow-soft-lg lg:hidden"
          role="dialog"
        >
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 text-base font-semibold text-ink-700 transition-colors hover:bg-meadow-100/60 hover:text-meadow-700"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
