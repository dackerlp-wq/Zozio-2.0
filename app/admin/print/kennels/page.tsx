import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireMembership } from "@/lib/auth";
import {
  ADOPTION_STATUS_LABEL,
  KENNEL_KIND_LABEL,
  KENNEL_STATUS_LABEL,
  SPECIES_LABEL,
} from "@/lib/format";

import {
  kennelConflicts,
  loadKennelBoard,
  summarize,
} from "../../(workspace)/kennels/data";
import { PrintButton } from "./print-button";

export const metadata = { title: "Přehled kotců — tisk" };

const NO_ZONE = "Bez zóny";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
  });
}

export default async function KennelsPrintPage() {
  const { institutionId, institution } = await requireMembership();
  const { board, unassigned } = await loadKennelBoard(institutionId);
  const summary = summarize(board);

  // Seskupení dle zóny (pořadí ze serveru).
  const grouped = new Map<string, typeof board>();
  for (const k of board) {
    const key = k.zone ?? NO_ZONE;
    const list = grouped.get(key) ?? [];
    list.push(k);
    grouped.set(key, list);
  }

  const printedAt = new Date().toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-ink-900 print:p-0">
      <style>{`@page { size: A4; margin: 14mm; } @media print { .no-print { display: none !important; } body { background: #fff; } }`}</style>

      {/* Ovládání (na tisku skryté) */}
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Link
          href="/admin/kennels"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft className="size-4" />
          Zpět na kotce
        </Link>
        <PrintButton />
      </div>

      {/* Hlavička dokumentu */}
      <header className="mb-5 border-b-2 border-ink-900 pb-3">
        <h1 className="font-display text-2xl font-bold">Přehled kotců</h1>
        <p className="text-sm text-ink-600">
          {institution.name} · vytištěno {printedAt}
        </p>
      </header>

      {/* Souhrn */}
      <div className="mb-6 grid grid-cols-5 gap-2 text-center">
        {[
          { v: summary.capacity, l: "Kapacita" },
          { v: summary.occupied, l: "Obsazeno" },
          { v: summary.free, l: "Volno" },
          { v: summary.quarantine, l: "Karanténa" },
          { v: summary.oos, l: "Mimo provoz" },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border border-ink-900/15 py-2">
            <div className="text-xl font-bold">{s.v}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
              {s.l}
            </div>
          </div>
        ))}
      </div>

      {board.length === 0 ? (
        <p className="text-ink-500">Zatím žádné kotce.</p>
      ) : (
        [...grouped.entries()].map(([zone, list]) => (
          <section key={zone} className="mb-6 break-inside-avoid">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-700">
              {zone}{" "}
              <span className="font-semibold text-ink-400">({list.length})</span>
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-900/20 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="py-1.5 pr-2 font-semibold">Kotec</th>
                  <th className="py-1.5 pr-2 font-semibold">Typ</th>
                  <th className="py-1.5 pr-2 font-semibold">Stav</th>
                  <th className="py-1.5 pr-2 font-semibold">Obsaz.</th>
                  <th className="py-1.5 pr-2 font-semibold">Obyvatelé</th>
                </tr>
              </thead>
              <tbody>
                {list.map((k) => {
                  const conflicts = kennelConflicts(k);
                  return (
                    <tr
                      key={k.id}
                      className="border-b border-ink-900/10 align-top"
                    >
                      <td className="py-1.5 pr-2 font-semibold">
                        {k.name}
                        {k.species_allowed.length > 0 && (
                          <div className="text-[10px] font-normal text-ink-500">
                            jen{" "}
                            {k.species_allowed
                              .map((s) => SPECIES_LABEL[s])
                              .join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 pr-2">{KENNEL_KIND_LABEL[k.kind]}</td>
                      <td className="py-1.5 pr-2">
                        {KENNEL_STATUS_LABEL[k.status]}
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap font-semibold">
                        {k.occupants.length}/{k.capacity}
                      </td>
                      <td className="py-1.5 pr-2">
                        {k.occupants.length === 0 ? (
                          <span className="text-ink-400">—</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {k.occupants.map((a) => (
                              <li key={a.id}>
                                <span className="font-medium">{a.name}</span>
                                <span className="text-ink-500">
                                  {" "}
                                  · {ADOPTION_STATUS_LABEL[a.adoption_status]}
                                </span>
                                {a.quarantine_until && (
                                  <span className="text-ink-500">
                                    {a.quarantine_overdue
                                      ? " · karanténa prošlá"
                                      : ` · karanténa do ${formatDate(a.quarantine_until)}`}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {conflicts.length > 0 && (
                          <div className="mt-1 text-[10px] font-semibold text-ink-700">
                            ⚠ {conflicts.join(" · ")}
                          </div>
                        )}
                        {k.notes && (
                          <div className="mt-0.5 text-[10px] italic text-ink-500">
                            {k.notes}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))
      )}

      {unassigned.length > 0 && (
        <section className="mt-6 break-inside-avoid border-t-2 border-ink-900/20 pt-3">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-700">
            Bez kotce ({unassigned.length})
          </h2>
          <p className="text-sm">
            {unassigned.map((a) => a.name).join(", ")}
          </p>
        </section>
      )}
    </div>
  );
}
