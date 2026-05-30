import Link from "next/link";
import { FileText } from "lucide-react";

import { requireMembership } from "@/lib/auth";

import { loadKennelBoard } from "./data";
import { KennelBoard } from "./kennel-manager";

export const metadata = { title: "Kotce — Zozio Admin" };

export default async function KennelsAdminPage() {
  const { institutionId } = await requireMembership();
  const { board, unassigned } = await loadKennelBoard(institutionId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            Kotce
          </h2>
          <p className="mt-1 text-ink-600">
            Přehled ustájení — kde je volno, kdo kde bydlí a na co dát pozor.
          </p>
        </div>
        <Link
          href="/admin/print/kennels"
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-pill bg-cream px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-ink-900/10 hover:bg-cream-warm"
        >
          <FileText className="size-4" />
          Přehled do PDF
        </Link>
      </div>

      <KennelBoard board={board} unassigned={unassigned} />
    </div>
  );
}
