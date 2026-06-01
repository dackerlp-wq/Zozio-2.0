import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  daysUntilEnd,
  displayHealthStatus,
  isTreatmentActive,
  medicationAlerts,
  todaySlots,
  vaccineStatus,
  weightTrend,
} from "@/lib/animal-health";
import { isClosedStatus } from "@/lib/animal-tabs-layout";
import { TREATMENT_TYPE_LABEL } from "@/lib/format";
import type {
  AdoptionStatus,
  AnimalConditionRow,
  AnimalCostRow,
  HealthStatus,
  MedicationDoseRow,
  TreatmentRow,
  VaccinationRow,
  VetRecordRow,
  WeightLogRow,
} from "@/types/database";

import {
  HealthView,
  type ActiveMed,
  type RecKind,
  type UnifiedRecord,
  type UpcomingItem,
} from "../health-view";

export const metadata = { title: "Zdraví — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

const DAY = 86_400_000;
const todayISO = () => new Date().toISOString().slice(0, 10);

function monthLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00").toLocaleDateString("cs-CZ", {
    month: "long",
    year: "numeric",
  });
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function daysDiff(iso: string): number {
  return Math.round(
    (new Date(iso + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / DAY,
  );
}

export default async function AnimalHealthPage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data: animal } = await supabase
    .from("animals")
    .select("id, health_status, is_neutered, weight_kg, adoption_status")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animal) notFound();
  const a = animal as {
    health_status: HealthStatus;
    is_neutered: boolean | null;
    weight_kg: number | null;
    adoption_status: AdoptionStatus;
  };

  const today = todayISO();
  const [vaccQ, treatQ, vetQ, weightQ, condQ, costQ, doseQ] = await Promise.all([
    supabase.from("vaccinations").select("*").eq("animal_id", id).order("administered_at", { ascending: false }),
    supabase.from("treatments").select("*").eq("animal_id", id).order("start_date", { ascending: false, nullsFirst: false }),
    supabase.from("vet_records").select("*").eq("animal_id", id).order("recorded_at", { ascending: false }),
    supabase.from("weight_logs").select("*").eq("animal_id", id).order("measured_at", { ascending: false }),
    supabase.from("animal_conditions").select("*").eq("animal_id", id).order("created_at", { ascending: true }),
    supabase.from("animal_costs").select("id, amount, category").eq("animal_id", id),
    supabase.from("medication_doses").select("*").eq("animal_id", id).eq("due_on", today),
  ]);

  const vaccinations = (vaccQ.data ?? []) as VaccinationRow[];
  const treatments = (treatQ.data ?? []) as TreatmentRow[];
  const vetRecords = (vetQ.data ?? []) as VetRecordRow[];
  const weights = (weightQ.data ?? []) as WeightLogRow[];
  const conditions = (condQ.data ?? []) as AnimalConditionRow[];
  const costs = (costQ.data ?? []) as Pick<AnimalCostRow, "id" | "amount" | "category">[];
  const doses = (doseQ.data ?? []) as MedicationDoseRow[];

  const costMap = new Map(costs.map((c) => [c.id, { amount: c.amount, category: c.category }]));

  // Aktivní léčba + odvození stavu
  const activeTreatments = treatments.filter((t) => isTreatmentActive(t, today));
  const hasActiveTreatment = activeTreatments.length > 0;
  const display = displayHealthStatus(a.health_status, hasActiveTreatment);

  const activeMeds: ActiveMed[] = activeTreatments.map((t) => {
    const slots = todaySlots(
      t.schedule_times,
      doses.filter((d) => d.treatment_id === t.id),
      today,
    );
    const alerts = medicationAlerts(slots, t.end_date, today);
    return {
      id: t.id,
      name: t.name,
      dosage: t.dosage,
      frequency: t.frequency,
      endDate: t.end_date,
      daysLeft: daysUntilEnd(t.end_date, today),
      permanent: !t.end_date,
      slots,
      missedToday: alerts.missedToday,
    };
  });

  const trend = weightTrend(
    weights.map((w) => ({ weight_kg: w.weight_kg, measured_at: w.measured_at })),
  );

  // Platnost vakcín
  const vaccines = vaccinations.map((v) => ({
    vaccine: v.vaccine,
    validUntil: v.valid_until,
    administeredAt: v.administered_at,
    status: vaccineStatus(v.valid_until),
  }));

  // Nadcházející péče (z vakcín + termínů léčby)
  const upcoming: UpcomingItem[] = [];
  for (const v of vaccinations) {
    if (!v.valid_until) continue;
    const st = vaccineStatus(v.valid_until);
    if (st === "valid" || st === "unknown") continue;
    const dd = daysDiff(v.valid_until);
    upcoming.push({ icon: "💉", label: `Přeočkování ${v.vaccine}`, date: v.valid_until, daysDiff: dd, overdue: dd < 0 });
  }
  for (const t of treatments) {
    if (!t.next_due) continue;
    const dd = daysDiff(t.next_due);
    if (dd > 30) continue;
    upcoming.push({
      icon: t.type === "deworming" ? "🪱" : "🩺",
      label: t.name,
      date: t.next_due,
      daysDiff: dd,
      overdue: dd < 0,
    });
  }
  upcoming.sort((x, y) => x.date.localeCompare(y.date));

  // Sjednocené záznamy
  const records: UnifiedRecord[] = [];
  for (const v of vaccinations) {
    const st = vaccineStatus(v.valid_until);
    records.push({
      id: v.id,
      table: "vaccinations",
      kind: "vaccination",
      title: `Očkování — ${v.vaccine}`,
      date: v.administered_at,
      meta: [v.vet_name, v.valid_until ? `platné do ${czd(v.valid_until)}` : null].filter(Boolean).join(" · "),
      status:
        st === "valid"
          ? { label: "platné", tone: "valid" }
          : st === "expiring"
            ? { label: "expiruje brzy", tone: "exp" }
            : st === "expired"
              ? { label: "propadlé", tone: "expired" }
              : null,
      detail: [
        v.batch ? { k: "Šarže", v: v.batch } : null,
        v.vet_name ? { k: "Aplikoval", v: v.vet_name } : null,
        v.notes ? { k: "Poznámka", v: v.notes } : null,
      ].filter(Boolean) as { k: string; v: string }[],
      photos: [],
      cost: v.cost_id ? costMap.get(v.cost_id) ?? null : null,
      month: monthLabel(v.administered_at),
    });
  }
  for (const t of treatments) {
    const kind: RecKind =
      t.type === "deworming" ? "deworming" : t.type === "antiparasitic" ? "antiparasitic" : "treatment";
    const done = !isTreatmentActive(t, today);
    const dateRef = t.start_date ?? t.created_at.slice(0, 10);
    records.push({
      id: t.id,
      table: "treatments",
      kind,
      title: `${TREATMENT_TYPE_LABEL[t.type]} — ${t.name}`,
      date: dateRef,
      meta: [t.dosage, t.frequency, t.vet_name].filter(Boolean).join(" · "),
      status: done ? { label: "dokončeno", tone: "done" } : { label: "probíhá", tone: "exp" },
      detail: [
        t.dosage ? { k: "Dávka", v: t.dosage } : null,
        t.frequency ? { k: "Frekvence", v: t.frequency } : null,
        t.start_date ? { k: "Od", v: czd(t.start_date) } : null,
        t.end_date ? { k: "Do", v: czd(t.end_date) } : null,
        t.vet_name ? { k: "Veterinář", v: t.vet_name } : null,
        t.notes ? { k: "Poznámka", v: t.notes } : null,
      ].filter(Boolean) as { k: string; v: string }[],
      photos: [],
      cost: t.cost_id ? costMap.get(t.cost_id) ?? null : null,
      month: monthLabel(dateRef),
    });
  }
  for (const r of vetRecords) {
    records.push({
      id: r.id,
      table: "vet_records",
      kind: "vet",
      title: r.title,
      date: r.recorded_at,
      meta: [r.vet_name, r.category].filter(Boolean).join(" · "),
      status: { label: "hotovo", tone: "done" },
      detail: [
        r.category ? { k: "Kategorie", v: r.category } : null,
        r.vet_name ? { k: "Veterinář", v: r.vet_name } : null,
        r.notes ? { k: "Popis", v: r.notes } : null,
      ].filter(Boolean) as { k: string; v: string }[],
      photos: r.photos ?? [],
      cost: r.cost_id ? costMap.get(r.cost_id) ?? null : null,
      month: monthLabel(r.recorded_at),
    });
  }
  for (const w of weights) {
    records.push({
      id: w.id,
      table: "weight_logs",
      kind: "weight",
      title: `Vážení — ${w.weight_kg} kg`,
      date: w.measured_at,
      meta: w.note ?? "",
      status: { label: "záznam", tone: "done" },
      detail: w.note ? [{ k: "Poznámka", v: w.note }] : [],
      photos: [],
      cost: null,
      month: monthLabel(w.measured_at),
    });
  }
  records.sort((x, y) => y.date.localeCompare(x.date));

  const counts: Record<string, number> = {
    all: records.length,
    vaccination: records.filter((r) => r.kind === "vaccination").length,
    treatment: records.filter((r) => r.kind === "treatment" || r.kind === "antiparasitic").length,
    deworming: records.filter((r) => r.kind === "deworming").length,
    vet: records.filter((r) => r.kind === "vet").length,
    weight: records.filter((r) => r.kind === "weight").length,
  };

  return (
    <HealthView
      animalId={id}
      readOnly={isClosedStatus(a.adoption_status)}
      storedStatus={a.health_status}
      displayStatus={display.value}
      statusDerived={display.derived}
      isNeutered={a.is_neutered}
      weight={trend}
      hasPermanentMed={activeTreatments.some((t) => !t.end_date)}
      activeMeds={activeMeds}
      upcoming={upcoming.slice(0, 5)}
      vaccines={vaccines}
      conditions={conditions.map((c) => ({ id: c.id, label: c.label, is_public: c.is_public }))}
      records={records}
      counts={counts}
    />
  );
}

function czd(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("cs-CZ");
}
