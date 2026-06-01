import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  daysLeft,
  endProtocol,
  episodeDay,
  recommendedDays,
  tempTrend,
} from "@/lib/animal-quarantine";
import { isClosedStatus } from "@/lib/animal-tabs-layout";
import { SUPERVISION_STATUS_LABEL } from "@/lib/format";
import type {
  AdoptionStatus,
  AnimalSupervisionStatus,
  QuarantineContactRow,
  QuarantineObservationRow,
  QuarantineRecordRow,
  Species,
} from "@/types/database";

import { QuarantineView, type QuarantineVM } from "../quarantine-view";

export const metadata = { title: "Karanténa — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

function czDate(iso: string | null): string | null {
  return iso ? new Date(iso + "T00:00:00").toLocaleDateString("cs-CZ") : null;
}

export default async function AnimalQuarantinePage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data: animal } = await supabase
    .from("animals")
    .select("id, supervision_status, legal_status, adoption_status, kennel_id, kennels(name)")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animal) notFound();
  const a = animal as unknown as {
    supervision_status: AnimalSupervisionStatus;
    legal_status: string;
    adoption_status: AdoptionStatus;
    kennel_id: string | null;
    kennels: { name: string } | null;
  };

  const [{ data: recData }, { data: obsData }, { data: contactData }, { data: othersData }] =
    await Promise.all([
      supabase.from("quarantine_records").select("*").eq("animal_id", id).order("started_on", { ascending: false }),
      supabase.from("quarantine_observations").select("*").eq("animal_id", id).order("observed_at", { ascending: false }),
      supabase.from("quarantine_contacts").select("*").eq("animal_id", id).order("created_at", { ascending: false }),
      supabase.from("animals").select("id, name, record_number, species").eq("institution_id", institutionId).neq("id", id).order("name"),
    ]);

  const records = (recData ?? []) as QuarantineRecordRow[];
  const observations = (obsData ?? []) as QuarantineObservationRow[];
  const contacts = (contactData ?? []) as QuarantineContactRow[];
  const others = (othersData ?? []) as {
    id: string;
    name: string;
    record_number: string | null;
    species: Species;
  }[];

  const active = records.find((r) => r.ended_on === null) ?? null;
  const activeObs = active
    ? observations.filter((o) => o.quarantine_id === active.id)
    : [];

  let activeVM: QuarantineVM["active"] = null;
  if (active) {
    const proto = endProtocol(active.kind, {
      startedOn: active.started_on,
      plannedUntil: active.planned_until,
      vetConsent: active.vet_consent,
      observations: activeObs.map((o) => ({
        temperature: o.temperature,
        observed_at: o.observed_at,
      })),
    });
    activeVM = {
      id: active.id,
      kind: active.kind,
      reason: active.reason,
      started: czDate(active.started_on) ?? "",
      plannedUntil: czDate(active.planned_until),
      day: episodeDay(active.started_on),
      daysLeft: daysLeft(active.planned_until),
      recommendedDays: recommendedDays(active.started_on, active.planned_until),
      protocol: proto.items,
      canEnd: proto.canEnd,
      endBlockReason: proto.blockReason,
      kennelName: a.kennels?.name ?? null,
    };
  }

  const trend = tempTrend(
    activeObs.map((o) => ({ temperature: o.temperature, observed_at: o.observed_at })),
  );

  const obsCount = new Map<string, number>();
  for (const o of observations) {
    if (o.quarantine_id) obsCount.set(o.quarantine_id, (obsCount.get(o.quarantine_id) ?? 0) + 1);
  }
  const history = records
    .filter((r) => r.ended_on !== null)
    .map((r) => ({
      id: r.id,
      kindLabel: SUPERVISION_STATUS_LABEL[r.kind],
      kind: r.kind,
      reason: r.reason,
      range: `${czDate(r.started_on)} – ${czDate(r.ended_on)}`,
      obsCount: obsCount.get(r.id) ?? 0,
    }));

  const contactsVM = contacts.map((c) => {
    const other = others.find((o) => o.id === c.contact_animal_id);
    return {
      id: c.id,
      name: other?.name ?? "Neznámé zvíře",
      record: other?.record_number ?? null,
      species: other?.species ?? null,
      reason: c.reason,
    };
  });

  return (
    <QuarantineView
      animalId={id}
      readOnly={isClosedStatus(a.adoption_status)}
      current={a.supervision_status}
      active={activeVM}
      observations={activeObs.map((o) => ({
        id: o.id,
        at: o.observed_at,
        temperature: o.temperature,
        tags: o.tags ?? [],
        note: o.note,
        flag: o.flag,
      }))}
      tempTrend={trend}
      contacts={contactsVM}
      history={history}
      others={others.map((o) => ({ id: o.id, name: o.name, record: o.record_number }))}
    />
  );
}
