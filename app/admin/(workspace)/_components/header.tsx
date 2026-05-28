import Link from "next/link";

import { ZozioBadge } from "@/components/zozio/badge";
import type { MemberRole } from "@/types/database";

const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Vlastník",
  admin: "Správce",
  staff: "Zaměstnanec",
};

export function AdminHeader({
  institutionName,
  institutionSlug,
  isPublished,
  role,
  userEmail,
}: {
  institutionName: string;
  institutionSlug: string;
  isPublished: boolean;
  role: MemberRole;
  userEmail: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-900/8 bg-cream/85 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate font-display text-xl font-bold text-ink-900">
            {institutionName}
          </h1>
          {isPublished ? (
            <ZozioBadge variant="available" size="sm">
              Zveřejněno
            </ZozioBadge>
          ) : (
            <ZozioBadge variant="soft" size="sm">
              Skryto
            </ZozioBadge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isPublished && (
            <Link
              href={`/utulek/${institutionSlug}`}
              target="_blank"
              className="hidden text-sm font-semibold text-sage-700 hover:text-sage-500 sm:inline"
            >
              Veřejný profil ↗
            </Link>
          )}
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold text-ink-900">
              {ROLE_LABEL[role]}
            </div>
            <div className="text-xs text-ink-400">{userEmail}</div>
          </div>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-full bg-sage-100 px-4 py-2 text-sm font-semibold text-sage-700 transition hover:bg-sage-300/40"
            >
              Odhlásit
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
