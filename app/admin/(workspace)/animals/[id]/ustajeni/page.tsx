import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isClosedStatus } from "@/lib/animal-tabs-layout";
import { kennelFit, type FitOccupant } from "@/lib/kennel-fit";
import type {
  AdoptionStatus,
  AnimalSupervisionStatus,
  Compatibility,
  KennelRow,
  Sex,
  Species,
} from "@/types/database";

import { UstajeniView, type KennelVM, type PlacementVM, type HistoryVM } from "../ustajeni-view";

export const metadata = { title: "Ustájení — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

const QUAR_KINDS = ["quarantine", "isolation"];

export default async function AnimalKennelPage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data: animalRow } = await supabase
    .from("animals")
    .select(
      "id, name, species, sex, size, good_with_dogs, good_with_cats, supervision_status, adoption_status, kennel_id, intake_date",
    )
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animalRow) notFound();
  const a = animalRow as {
    name: string;
    species: Species;
    sex: Sex;
    good_with_dogs: Compatibility;
    good_with_cats: Compatibility;
    supervision_status: AnimalSupervisionStatus;
    adoption_status: AdoptionStatus;
    kennel_id: string | null;
    intake_date: string | null;
  };

  const [{ data: kennelData }, { data: animalData }, { data: histData }, { data: fosterData }] =
    await Promise.all([
      supabase
        .from("kennels")
        .select("*")
        .eq("institution_id", institutionId)
        .order("zone", { ascending: true, nullsFirst: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("animals")
        .select("id, name, species, sex, kennel_id")
        .eq("institution_id", institutionId)
        .not("adoption_status", "in", "(adopted,transferred,deceased)"),
      supabase
        .from("kennel_assignments")
        .select("id, kennel_id, moved_in_at, moved_out_at, note, kennels(name, kind)")
        .eq("animal_id", id)
        .order("moved_in_at", { ascending: false }),
      supabase
        .from("foster_placements")
        .select("id, started_on, ended_on, foster_carers(name)")
        .eq("animal_id", id)
        .order("started_on", { ascending: false }),
    ]);

  const kennels = (kennelData ?? []) as KennelRow[];
  const allAnimals = (animalData ?? []) as {
    id: string;
    name: string;
    species: Species;
    sex: Sex;
    kennel_id: string | null;
  }[];

  // Obyvatelé podle kotce.
  const byKennel = new Map<string, typeof allAnimals>();
  for (const an of allAnimals) {
    if (!an.kennel_id) continue;
    const list = byKennel.get(an.kennel_id) ?? [];
    list.push(an);
    byKennel.set(an.kennel_id, list);
  }

  const fitAnimal = {
    species: a.species,
    sex: a.sex,
    good_with_dogs: a.good_with_dogs,
    good_with_cats: a.good_with_cats,
  };

  const inQuarantine =
    a.supervision_status === "quarantine" || a.supervision_status === "isolation";

  const kennelVMs: KennelVM[] = kennels.map((k) => {
    const occ = (byKennel.get(k.id) ?? []).filter((o) => o.id !== id);
    const occupantsForFit: FitOccupant[] = occ.map((o) => ({ species: o.species, sex: o.sex }));
    const fit = kennelFit(fitAnimal, k, occupantsForFit);
    const isQuar = QUAR_KINDS.includes(k.kind);
    const outOfService = k.status === "out_of_service" || k.status === "cleaning";
    // Během karantény smí zvíře jen do karanténního/izolačního kotce.
    const quarantineBlocked = inQuarantine && !isQuar;
    return {
      id: k.id,
      name: k.name,
      zone: k.zone,
      kind: k.kind,
      status: k.status,
      capacity: k.capacity,
      occupied: occ.length,
      isQuarantine: isQuar,
      outOfService,
      isCurrent: k.id === a.kennel_id,
      fitLevel: fit.level,
      fitReasons: fit.reasons,
      quarantineBlocked,
      occupants: occ.map((o) => ({ id: o.id, name: o.name, species: o.species })),
      heated: k.is_heated,
      accessible: k.is_accessible,
      maternity: k.is_maternity,
    };
  });

  // Aktuální umístění.
  type HistRow = {
    id: string;
    kennel_id: string;
    moved_in_at: string;
    moved_out_at: string | null;
    note: string | null;
    kennels: { name: string; kind: string } | null;
  };
  const histRows = (histData ?? []) as unknown as HistRow[];
  const openRow = histRows.find((h) => h.moved_out_at === null) ?? null;
  const currentVM = kennelVMs.find((k) => k.id === a.kennel_id) ?? null;

  let placement: PlacementVM | null = null;
  if (currentVM) {
    placement = {
      kennel: currentVM,
      since: openRow?.moved_in_at ?? null,
      coOccupants: currentVM.occupants,
    };
  }

  // Celkový pobyt v útulku (z příjmu, fallback nejstarší umístění).
  const firstMoveIn = histRows.length > 0 ? histRows[histRows.length - 1].moved_in_at : null;
  const stayFrom = a.intake_date ?? (firstMoveIn ? firstMoveIn.slice(0, 10) : null);
  const totalStayDays = stayFrom
    ? Math.max(
        0,
        Math.round((Date.now() - new Date(stayFrom + "T00:00:00").getTime()) / 86_400_000),
      )
    : null;

  // Historie: kotce + období u pěstouna.
  const history: HistoryVM[] = [
    ...histRows.map((h) => ({
      id: h.id,
      kind: "kennel" as const,
      title: h.kennels?.name ?? "Kotec",
      isQuarantine: QUAR_KINDS.includes(h.kennels?.kind ?? ""),
      from: h.moved_in_at,
      to: h.moved_out_at,
      note: h.note,
    })),
    ...((fosterData ?? []) as {
      id: string;
      started_on: string;
      ended_on: string | null;
      foster_carers: { name: string } | null;
    }[]).map((f) => ({
      id: `f-${f.id}`,
      kind: "foster" as const,
      title: `Pěstoun — ${f.foster_carers?.name ?? "—"}`,
      isQuarantine: false,
      from: f.started_on,
      to: f.ended_on,
      note: "mimo útulek",
    })),
  ].sort((x, y) => (x.from < y.from ? 1 : -1));

  return (
    <UstajeniView
      animalId={id}
      readOnly={isClosedStatus(a.adoption_status)}
      inQuarantine={inQuarantine}
      placement={placement}
      totalStayDays={totalStayDays}
      kennels={kennelVMs}
      history={history}
    />
  );
}
