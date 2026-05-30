import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";
import type { InstitutionRow, VerificationStatus } from "@/types/database";

import { VerificationActions } from "./verification-actions";

const STATUS_LABEL: Record<VerificationStatus, string> = {
  pending: "Čeká na ověření",
  approved: "Ověřeno",
  rejected: "Zamítnuto",
  suspended: "Pozastaveno",
};

const STATUS_BADGE: Record<VerificationStatus, string> = {
  pending: "bg-sunshine-200 text-sunshine-600",
  approved: "bg-sage-100 text-sage-700",
  rejected: "bg-berry/10 text-berry",
  suspended: "bg-peach-200 text-terracotta-600",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SuperadminInstitutionDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const service = createServiceClient();

  const { data } = await service
    .from("institutions")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const inst = data as InstitutionRow;
  const vs = inst.verification_status;

  const { count: animalsCount } = await service
    .from("animals")
    .select("*", { count: "exact", head: true })
    .eq("institution_id", id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/superadmin/institutions"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft className="size-4" /> Zpět na seznam
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            {inst.name}
          </h1>
          <p className="mt-1 text-ink-600">
            {inst.type === "rescue_station" ? "Záchranná stanice" : "Útulek"} ·{" "}
            {animalsCount ?? 0} zvířat
          </p>
        </div>
        <span
          className={cn(
            "inline-flex rounded-pill px-3 py-1.5 text-sm font-semibold",
            STATUS_BADGE[vs],
          )}
        >
          {STATUS_LABEL[vs]}
        </span>
      </div>

      {vs === "rejected" && inst.rejection_reason && (
        <div className="rounded-2xl bg-berry/10 p-4 text-sm text-ink-700 ring-1 ring-inset ring-berry/20">
          <span className="font-semibold text-ink-900">Důvod zamítnutí: </span>
          {inst.rejection_reason}
        </div>
      )}

      {vs === "suspended" && inst.suspension_reason && (
        <div className="rounded-2xl bg-peach-100 p-4 text-sm text-ink-700 ring-1 ring-inset ring-peach-300">
          <span className="font-semibold text-ink-900">
            Důvod pozastavení:{" "}
          </span>
          {inst.suspension_reason}
        </div>
      )}

      <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h2 className="mb-4 font-display text-xl font-bold text-ink-900">
          Ověření
        </h2>
        <VerificationActions id={inst.id} status={vs} />
      </section>

      <section className="space-y-4 rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h2 className="font-display text-xl font-bold text-ink-900">
          Údaje útulku
        </h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label="Právní název" value={inst.legal_name} />
          <Field label="IČO" value={inst.ico} />
          <Field label="Email" value={inst.email} />
          <Field label="Telefon" value={inst.phone} />
          <Field label="Web" value={inst.website} />
          <Field label="Kraj" value={inst.region} />
          <Field label="Město" value={inst.city} />
          <Field label="Adresa" value={inst.address} />
        </dl>
        {inst.description && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-400">
              Popis
            </dt>
            <dd className="mt-1 whitespace-pre-line text-ink-700">
              {inst.description}
            </dd>
          </div>
        )}
        {inst.is_published && (
          <Link
            href={`/utulek/${inst.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-meadow-600 hover:text-meadow-700"
          >
            Veřejný profil <ExternalLink className="size-4" />
          </Link>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-ink-900">{value || "—"}</dd>
    </div>
  );
}
