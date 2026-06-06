import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail, MapPin, Phone } from "lucide-react";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  APPLICANT_EXPERIENCE_LABEL,
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_PILL,
  HOUSING_LABEL,
} from "@/lib/format";
import type { ApplicationStatus } from "@/types/database";

import { StatusControls } from "./status-controls";
import { NotesForm } from "./notes-form";

export const metadata = { title: "Žádost — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

interface EventRow {
  id: string;
  event_type: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus | null;
  note: string | null;
  created_at: string;
}

function dateTime(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data } = await supabase
    .from("applications")
    .select(
      `id, applicant_name, applicant_email, applicant_phone, applicant_city,
       applicant_message, applicant_data, status, internal_notes, created_at,
       meeting_at, meeting_location,
       animal:animals(id, name, primary_photo_url)`,
    )
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!data) notFound();

  const app = data as unknown as {
    id: string;
    applicant_name: string;
    applicant_email: string;
    applicant_phone: string | null;
    applicant_city: string | null;
    applicant_message: string | null;
    applicant_data: Record<string, unknown>;
    status: ApplicationStatus;
    internal_notes: string | null;
    created_at: string;
    meeting_at: string | null;
    meeting_location: string | null;
    animal: { id: string; name: string; primary_photo_url: string | null } | null;
  };

  const { data: eventsData } = await supabase
    .from("application_events")
    .select("id, event_type, from_status, to_status, note, created_at")
    .eq("application_id", id)
    .order("created_at", { ascending: false });
  const events = (eventsData ?? []) as unknown as EventRow[];

  const ad = app.applicant_data ?? {};
  const housing = typeof ad.housing_type === "string" ? ad.housing_type : "";
  const experience = typeof ad.experience === "string" ? ad.experience : "";
  const facts = [
    housing ? (HOUSING_LABEL[housing] ?? housing) : null,
    experience ? (APPLICANT_EXPERIENCE_LABEL[experience] ?? experience) : null,
    ad.has_garden ? "Zahrada" : null,
    ad.has_children ? "Děti" : null,
    ad.has_pets ? "Jiná zvířata" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/applications"
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-meadow-700"
      >
        <ChevronLeft className="size-4" /> Zpět na žádosti
      </Link>

      {/* Hlavička */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
              {app.applicant_name}
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${APPLICATION_STATUS_PILL[app.status]}`}
            >
              {APPLICATION_STATUS_LABEL[app.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-600">
            Podáno {dateTime(app.created_at)}
          </p>
        </div>

        {app.animal && (
          <Link
            href={`/admin/animals/${app.animal.id}/edit`}
            className="flex items-center gap-3 rounded-2xl bg-cream p-2 pr-4 ring-1 ring-ink-900/8 hover:bg-sage-50"
          >
            <div className="size-11 overflow-hidden rounded-xl bg-cream-warm">
              {app.animal.primary_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={app.animal.primary_photo_url}
                  alt={app.animal.name}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-lg">
                  🐾
                </div>
              )}
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                Zvíře
              </div>
              <div className="font-display font-bold text-ink-900">
                {app.animal.name}
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* Kontakt */}
      <div className="grid gap-3 rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8 sm:grid-cols-3">
        <ContactItem icon={<Mail className="size-4" />} label="E-mail">
          <a
            href={`mailto:${app.applicant_email}`}
            className="font-semibold text-meadow-700 hover:underline"
          >
            {app.applicant_email}
          </a>
        </ContactItem>
        <ContactItem icon={<Phone className="size-4" />} label="Telefon">
          {app.applicant_phone ? (
            <a
              href={`tel:${app.applicant_phone}`}
              className="font-semibold text-ink-900"
            >
              {app.applicant_phone}
            </a>
          ) : (
            <span className="text-ink-400">—</span>
          )}
        </ContactItem>
        <ContactItem icon={<MapPin className="size-4" />} label="Město">
          <span className="font-semibold text-ink-900">
            {app.applicant_city || <span className="text-ink-400">—</span>}
          </span>
        </ContactItem>
      </div>

      {/* Doplňující info */}
      {facts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {facts.map((f) => (
            <span
              key={f}
              className="rounded-full bg-cream-warm px-3 py-1 text-sm font-semibold text-ink-700 ring-1 ring-ink-900/8"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Odpovědi na vlastní otázky útulku */}
      {Array.isArray((ad as Record<string, unknown>).custom) &&
        ((ad as { custom: { label: string; answer: string }[] }).custom.length > 0) && (
          <div className="space-y-2 rounded-2xl bg-cream-warm p-4 ring-1 ring-ink-900/8">
            <div className="text-xs font-bold uppercase tracking-wide text-ink-400">
              Odpovědi na otázky útulku
            </div>
            {(ad as { custom: { label: string; answer: string }[] }).custom.map((c, i) => (
              <div key={i} className="text-sm">
                <span className="font-semibold text-ink-700">{c.label}: </span>
                <span className="text-ink-600">{c.answer || "—"}</span>
              </div>
            ))}
          </div>
        )}

      {/* Zpráva */}
      {app.applicant_message && (
        <div className="rounded-3xl bg-cream-warm p-6 ring-1 ring-ink-900/5">
          <div className="font-mono text-xs uppercase tracking-wider text-ink-500">
            Zpráva žadatele
          </div>
          <p className="mt-2 whitespace-pre-line text-ink-700">
            {app.applicant_message}
          </p>
        </div>
      )}

      {/* Workflow */}
      <div className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h3 className="font-display text-xl font-bold text-ink-900">
          Stav žádosti
        </h3>
        <StatusControls
          id={app.id}
          status={app.status}
          meetingAt={app.meeting_at}
          meetingLocation={app.meeting_location}
        />
      </div>

      {/* Interní poznámky */}
      <div className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h3 className="font-display text-xl font-bold text-ink-900">
          Interní poznámky
        </h3>
        <p className="mt-1 text-sm text-ink-600">
          Vidí jen tým útulku — žadatel je neuvidí.
        </p>
        <NotesForm id={app.id} initial={app.internal_notes ?? ""} />
      </div>

      {/* Historie */}
      <div className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h3 className="font-display text-xl font-bold text-ink-900">Historie</h3>
        <ol className="mt-4 space-y-4">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <div className="mt-1 size-2.5 shrink-0 rounded-full bg-meadow-500" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink-900">
                  {e.event_type === "created"
                    ? "Žádost podána"
                    : e.to_status
                      ? `Stav změněn na „${APPLICATION_STATUS_LABEL[e.to_status]}"`
                      : "Aktualizace"}
                </div>
                {e.note && (
                  <p className="text-sm text-ink-600">{e.note}</p>
                )}
                <div className="text-xs text-ink-400">
                  {dateTime(e.created_at)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function ContactItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-ink-500">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="mt-1 truncate text-sm">{children}</div>
    </div>
  );
}
