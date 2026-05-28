import Link from "next/link";

import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";
import type { VerificationStatus } from "@/types/database";

export const metadata = { title: "Útulky — Superadmin" };

const STATUS_LABEL: Record<VerificationStatus, string> = {
  pending: "Čeká na ověření",
  approved: "Ověřeno",
  rejected: "Zamítnuto",
};

const STATUS_BADGE: Record<VerificationStatus, string> = {
  pending: "bg-sunshine-200 text-sunshine-600",
  approved: "bg-sage-100 text-sage-700",
  rejected: "bg-berry/10 text-berry",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Vše" },
  { value: "pending", label: "Čeká na ověření" },
  { value: "approved", label: "Ověřené" },
  { value: "rejected", label: "Zamítnuté" },
];

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function SuperadminInstitutionsPage({
  searchParams,
}: PageProps) {
  const { status } = await searchParams;
  const active = status ?? "all";
  const service = createServiceClient();

  let query = service
    .from("institutions")
    .select(
      "id, name, slug, type, city, region, email, verification_status, is_published, created_at",
    )
    .order("created_at", { ascending: false });

  if (active !== "all") {
    query = query.eq("verification_status", active as VerificationStatus);
  }

  const { data: institutions } = await query;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
          Útulky
        </h1>
        <p className="mt-1 text-ink-600">
          Ověřuj registrace a spravuj útulky na platformě.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={
              f.value === "all"
                ? "/superadmin/institutions"
                : `/superadmin/institutions?status=${f.value}`
            }
            className={cn(
              "rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors",
              active === f.value
                ? "bg-ink-900 text-cream"
                : "bg-cream text-ink-600 ring-1 ring-ink-900/8 hover:bg-sand",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl bg-cream ring-1 ring-ink-900/8">
        {!institutions || institutions.length === 0 ? (
          <div className="p-10 text-center text-ink-600">
            Žádné útulky v této kategorii.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-900/8 text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-5 py-3 font-semibold">Název</th>
                <th className="px-5 py-3 font-semibold">Lokalita</th>
                <th className="px-5 py-3 font-semibold">Stav</th>
                <th className="px-5 py-3 font-semibold">Veřejný</th>
              </tr>
            </thead>
            <tbody>
              {institutions.map((inst) => {
                const vs = inst.verification_status as VerificationStatus;
                return (
                  <tr
                    key={inst.id}
                    className="border-b border-ink-900/5 last:border-0 hover:bg-sand/40"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/superadmin/institutions/${inst.id}`}
                        className="font-semibold text-ink-900 hover:text-coral-600"
                      >
                        {inst.name}
                      </Link>
                      <div className="text-xs text-ink-400">
                        {inst.type === "rescue_station"
                          ? "Záchranná stanice"
                          : "Útulek"}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-600">
                      {[inst.city, inst.region].filter(Boolean).join(", ") ||
                        "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-pill px-2.5 py-1 text-xs font-semibold",
                          STATUS_BADGE[vs],
                        )}
                      >
                        {STATUS_LABEL[vs]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-600">
                      {inst.is_published ? "Ano" : "Ne"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
