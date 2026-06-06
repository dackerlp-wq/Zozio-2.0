"use server";

import { revalidatePath } from "next/cache";

import { requireMembership, ensurePermission } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { firstRunFrom, plannedRuns, todayISO } from "@/lib/task-schedule";
import type {
  AnimalCostCategory,
  AnimalDocumentCategory,
  HealthStatus,
  TaskScheduleFreq,
  TreatmentType,
} from "@/types/database";

type ActionResult = { error: string } | { ok: true };

/** Volitelné nastavení automatického opakování léku (denní úkoly). */
export interface TreatmentSchedule {
  freq: TaskScheduleFreq;
  interval: number;
}

/** Volitelný dokument přiložený při zakládání zdravotního záznamu. */
export interface AttachedDocument {
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

/** Ověří, že zvíře patří útulku přihlášeného uživatele. */
async function assertOwned(animalId: string) {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  const { data } = await service
    .from("animals")
    .select("id")
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  return { ok: Boolean(data), service, institutionId, userId: user.id };
}

type ServiceClient = ReturnType<typeof createServiceClient>;

/** Uloží přiložený dokument a propojí ho se zdrojovým záznamem. */
async function linkDocument(
  service: ServiceClient,
  params: {
    animalId: string;
    institutionId: string;
    userId: string;
    doc: AttachedDocument;
    category: AnimalDocumentCategory;
    title: string;
    documentDate: string | null;
    relatedTable: string;
    relatedId: string;
  },
) {
  await service.from("animal_documents").insert({
    animal_id: params.animalId,
    institution_id: params.institutionId,
    category: params.category,
    title: params.title || params.doc.file_name || "Dokument",
    file_url: null,
    file_path: params.doc.file_path,
    file_name: params.doc.file_name || null,
    file_size: params.doc.file_size || null,
    mime_type: params.doc.mime_type || null,
    document_date: params.documentDate,
    related_table: params.relatedTable,
    related_id: params.relatedId,
    uploaded_by: params.userId,
  });
}

/** Lidsky čitelný popis frekvence pro popisek úkolu. */
function freqLabel(freq: TaskScheduleFreq, interval: number): string {
  const n = Math.max(1, Math.trunc(interval));
  if (freq === "daily") return n === 1 ? "denně" : `každý ${n}. den`;
  if (freq === "weekly") return n === 1 ? "týdně" : `každých ${n} týdnů`;
  if (freq === "monthly") return n === 1 ? "měsíčně" : `každých ${n} měsíců`;
  return n === 1 ? "ročně" : `každých ${n} let`;
}

/**
 * Vytvoří opakovanou šablonu úkolů z léku a hned vygeneruje dnešní/zpožděné
 * úkoly (ať uživatel nečeká na noční cron). Šablona je propojená s léčbou
 * přes source_table/source_id, takže ji lze při smazání léku uklidit.
 */
async function createTreatmentSchedule(
  service: ServiceClient,
  params: {
    animalId: string;
    institutionId: string;
    userId: string;
    treatmentId: string;
    type: TreatmentType;
    name: string;
    dosage: string;
    startDate: string;
    endDate: string | null;
    notes: string;
    schedule: TreatmentSchedule;
  },
) {
  const today = todayISO();
  const interval = Math.max(1, Math.trunc(params.schedule.interval));
  const freq = params.schedule.freq;

  const dose = params.dosage.trim();
  const title = dose ? `${params.name} — ${dose}` : params.name;
  const descParts = [`Podávání ${freqLabel(freq, interval)}.`];
  if (dose) descParts.push(`Dávka: ${dose}.`);
  if (params.notes.trim()) descParts.push(params.notes.trim());
  const description = descParts.join(" ");

  const taskType = params.type === "deworming" ? "deworming" : "treatment";
  const nextRun = firstRunFrom(params.startDate, freq, interval, today);

  const { data: sched, error } = await service
    .from("task_schedules")
    .insert({
      institution_id: params.institutionId,
      animal_id: params.animalId,
      type: taskType,
      priority: "normal",
      title,
      description,
      freq,
      interval,
      start_date: params.startDate,
      end_date: params.endDate,
      lead_days: 0,
      next_run: nextRun,
      active: true,
      source_table: "treatments",
      source_id: params.treatmentId,
      created_by: params.userId,
    })
    .select("id")
    .single();
  if (error || !sched) return;

  // Okamžitá materializace dnešních/zpožděných úkolů (stejná logika jako cron).
  const { runs, nextRun: newNextRun, active } = plannedRuns(
    {
      next_run: nextRun,
      freq,
      interval,
      lead_days: 0,
      end_date: params.endDate,
    },
    today,
  );

  if (runs.length > 0) {
    const { data: existing } = await service
      .from("animal_tasks")
      .select("schedule_date")
      .eq("schedule_id", sched.id);
    const seen = new Set(
      (existing ?? []).map(
        (e: { schedule_date: string | null }) => e.schedule_date,
      ),
    );
    const toInsert = runs
      .filter((run) => !seen.has(run))
      .map((run) => ({
        institution_id: params.institutionId,
        animal_id: params.animalId,
        type: taskType,
        priority: "normal" as const,
        title,
        description,
        due_date: run,
        status: "open" as const,
        source: "auto" as const,
        schedule_id: sched.id,
        schedule_date: run,
      }));
    if (toInsert.length > 0) await service.from("animal_tasks").insert(toInsert);
  }

  // Posuň next_run / deaktivuj, pokud už šablona skončila.
  await service
    .from("task_schedules")
    .update({
      next_run: newNextRun,
      active,
      last_generated_at: new Date().toISOString(),
    })
    .eq("id", sched.id);
}

function revalidateHealth(animalId: string) {
  revalidatePath(`/admin/animals/${animalId}/zdravi`);
  revalidatePath(`/animals/${animalId}`);
}

// ---- Váha -----------------------------------------------------------------

export interface WeightInput {
  weight_kg: number;
  measured_at: string; // YYYY-MM-DD
  note: string;
}

export async function addWeightLog(
  animalId: string,
  input: WeightInput,
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
  const { ok, service, userId } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };
  if (!input.weight_kg || input.weight_kg <= 0)
    return { error: "Zadej platnou váhu." };

  const { error } = await service.from("weight_logs").insert({
    animal_id: animalId,
    weight_kg: input.weight_kg,
    measured_at: input.measured_at || new Date().toISOString().slice(0, 10),
    note: input.note.trim() || null,
    created_by: userId,
  });
  if (error) return { error: error.message };

  // Zrcadli poslední váhu do karty zvířete.
  await service
    .from("animals")
    .update({ weight_kg: input.weight_kg })
    .eq("id", animalId);

  revalidateHealth(animalId);
  return { ok: true };
}

// ---- Očkování -------------------------------------------------------------

export interface VaccinationInput {
  vaccine: string;
  administered_at: string;
  valid_until: string;
  vet_name: string;
  notes: string;
  batch?: string;
}

export async function addVaccination(
  animalId: string,
  input: VaccinationInput,
  document?: AttachedDocument | null,
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
  const { ok, service, institutionId, userId } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };
  if (!input.vaccine.trim()) return { error: "Zadej název vakcíny." };

  const administeredAt =
    input.administered_at || new Date().toISOString().slice(0, 10);
  const { data: inserted, error } = await service
    .from("vaccinations")
    .insert({
      animal_id: animalId,
      vaccine: input.vaccine.trim(),
      administered_at: administeredAt,
      valid_until: input.valid_until || null,
      vet_name: input.vet_name.trim() || null,
      notes: input.notes.trim() || null,
      batch: input.batch?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await service
    .from("animals")
    .update({ is_vaccinated: true })
    .eq("id", animalId);

  if (document && inserted) {
    await linkDocument(service, {
      animalId,
      institutionId,
      userId,
      doc: document,
      category: "vaccination",
      title: `Očkování: ${input.vaccine.trim()}`,
      documentDate: administeredAt,
      relatedTable: "vaccinations",
      relatedId: inserted.id,
    });
  }

  revalidateHealth(animalId);
  return { ok: true };
}

// ---- Léčba ----------------------------------------------------------------

export interface TreatmentInput {
  type: TreatmentType;
  name: string;
  dosage: string;
  frequency: string;
  start_date: string;
  end_date: string;
  next_due: string;
  vet_name: string;
  notes: string;
  /** Časy denních dávek pro kontrolu užití, např. ["08:00","20:00"]. */
  schedule_times?: string[];
}

export async function addTreatment(
  animalId: string,
  input: TreatmentInput,
  document?: AttachedDocument | null,
  schedule?: TreatmentSchedule | null,
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
  const { ok, service, institutionId, userId } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };
  if (!input.name.trim()) return { error: "Zadej název léčby." };

  const { data: inserted, error } = await service
    .from("treatments")
    .insert({
      animal_id: animalId,
      type: input.type,
      name: input.name.trim(),
      dosage: input.dosage.trim() || null,
      frequency: input.frequency.trim() || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      next_due: input.next_due || null,
      vet_name: input.vet_name.trim() || null,
      notes: input.notes.trim() || null,
      schedule_times:
        input.schedule_times && input.schedule_times.length > 0
          ? input.schedule_times
          : null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (document && inserted) {
    await linkDocument(service, {
      animalId,
      institutionId,
      userId,
      doc: document,
      category: "medical",
      title: `Léčba: ${input.name.trim()}`,
      documentDate: input.start_date || null,
      relatedTable: "treatments",
      relatedId: inserted.id,
    });
  }

  // Automatické denní úkoly podle frekvence (volitelné).
  const startDate = input.start_date || todayISO();
  if (schedule && inserted) {
    await createTreatmentSchedule(service, {
      animalId,
      institutionId,
      userId,
      treatmentId: inserted.id,
      type: input.type,
      name: input.name.trim(),
      dosage: input.dosage,
      startDate,
      endDate: input.end_date || null,
      notes: input.notes,
      schedule,
    });
    revalidatePath(`/admin/animals/${animalId}`);
    revalidatePath("/admin/tasks");
  }

  revalidateHealth(animalId);
  return { ok: true };
}

// ---- Veterinární záznamy --------------------------------------------------

export interface VetRecordInput {
  recorded_at: string;
  category: string;
  title: string;
  vet_name: string;
  notes: string;
  photos?: string[];
}

export async function addVetRecord(
  animalId: string,
  input: VetRecordInput,
  document?: AttachedDocument | null,
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
  const { ok, service, institutionId, userId } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };
  if (!input.title.trim()) return { error: "Zadej název záznamu." };

  const recordedAt = input.recorded_at || new Date().toISOString().slice(0, 10);
  const { data: inserted, error } = await service
    .from("vet_records")
    .insert({
      animal_id: animalId,
      recorded_at: recordedAt,
      category: input.category.trim() || "Obecné",
      title: input.title.trim(),
      vet_name: input.vet_name.trim() || null,
      notes: input.notes.trim() || null,
      photos: input.photos && input.photos.length > 0 ? input.photos : [],
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (document && inserted) {
    await linkDocument(service, {
      animalId,
      institutionId,
      userId,
      doc: document,
      category: "medical",
      title: input.title.trim(),
      documentDate: recordedAt,
      relatedTable: "vet_records",
      relatedId: inserted.id,
    });
  }

  revalidateHealth(animalId);
  return { ok: true };
}

// ---- Podání dávky léku ----------------------------------------------------

export async function recordDose(
  animalId: string,
  treatmentId: string,
  slot?: string,
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
  const { ok, service, userId } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };

  const { data: t } = await service
    .from("treatments")
    .select("id")
    .eq("id", treatmentId)
    .eq("animal_id", animalId)
    .maybeSingle();
  if (!t) return { error: "Léčba nepatří tomuto zvířeti." };

  const today = todayISO();
  // Už podáno v tomto slotu dnes? Pak nic neděláme (idempotentně).
  let q = service
    .from("medication_doses")
    .select("id, given_at")
    .eq("treatment_id", treatmentId)
    .eq("due_on", today);
  q = slot ? q.eq("slot", slot) : q.is("slot", null);
  const { data: existing } = await q.maybeSingle();
  if (existing?.given_at) return { ok: true };

  if (existing) {
    await service
      .from("medication_doses")
      .update({ given_at: new Date().toISOString(), given_by: userId })
      .eq("id", existing.id);
  } else {
    await service.from("medication_doses").insert({
      animal_id: animalId,
      treatment_id: treatmentId,
      slot: slot ?? null,
      due_on: today,
      given_at: new Date().toISOString(),
      given_by: userId,
    });
  }

  revalidateHealth(animalId);
  return { ok: true };
}

// ---- Chronické stavy ------------------------------------------------------

export async function addCondition(
  animalId: string,
  label: string,
  isPublic: boolean,
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
  const { ok, service, institutionId, userId } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };
  if (!label.trim()) return { error: "Zadej název stavu." };

  const { error } = await service.from("animal_conditions").insert({
    animal_id: animalId,
    institution_id: institutionId,
    label: label.trim(),
    is_public: isPublic,
    created_by: userId,
  });
  if (error) return { error: error.message };

  revalidateHealth(animalId);
  return { ok: true };
}

export async function deleteCondition(
  conditionId: string,
  animalId: string,
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
  const { ok, service } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };
  const { error } = await service
    .from("animal_conditions")
    .delete()
    .eq("id", conditionId)
    .eq("animal_id", animalId);
  if (error) return { error: error.message };
  revalidateHealth(animalId);
  return { ok: true };
}

// ---- Náklad (popup) — volitelně napojený na zdravotní záznam ---------------

export interface HealthCostInput {
  category: AnimalCostCategory;
  amount: number;
  spent_on: string;
  description: string;
}

export async function addHealthCost(
  animalId: string,
  input: HealthCostInput,
  link?: { table: "treatments" | "vet_records" | "vaccinations"; id: string },
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
  const { ok, service, institutionId, userId } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };
  if (!input.amount || input.amount <= 0) return { error: "Zadej částku." };

  const { data: cost, error } = await service
    .from("animal_costs")
    .insert({
      animal_id: animalId,
      institution_id: institutionId,
      category: input.category,
      amount: input.amount,
      spent_on: input.spent_on || todayISO(),
      description: input.description.trim() || null,
      source: "health",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (link && cost) {
    await service
      .from(link.table)
      .update({ cost_id: cost.id })
      .eq("id", link.id)
      .eq("animal_id", animalId);
  }

  revalidateHealth(animalId);
  revalidatePath(`/admin/animals/${animalId}/evidence`);
  return { ok: true };
}

// ---- Ruční přepis zdravotního stavu ---------------------------------------

export async function setHealthStatus(
  animalId: string,
  status: HealthStatus,
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
  const { ok, service } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };
  const { error } = await service
    .from("animals")
    .update({ health_status: status })
    .eq("id", animalId);
  if (error) return { error: error.message };
  revalidateHealth(animalId);
  return { ok: true };
}

// ---- Mazání ---------------------------------------------------------------

const DELETABLE = [
  "weight_logs",
  "vaccinations",
  "treatments",
  "vet_records",
] as const;
type DeletableTable = (typeof DELETABLE)[number];

export async function deleteHealthEntry(
  table: DeletableTable,
  entryId: string,
  animalId: string,
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
  if (!DELETABLE.includes(table)) return { error: "Neplatná tabulka." };
  const { ok, service } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };

  // U léku ukliď i automaticky vytvořené šablony a otevřené denní úkoly.
  if (table === "treatments") {
    const { data: scheds } = await service
      .from("task_schedules")
      .select("id")
      .eq("source_table", "treatments")
      .eq("source_id", entryId);
    const schedIds = (scheds ?? []).map((s: { id: string }) => s.id);
    if (schedIds.length > 0) {
      // Smaž jen ještě nesplněné (otevřené) úkoly, hotové ponech v historii.
      await service
        .from("animal_tasks")
        .delete()
        .in("schedule_id", schedIds)
        .eq("status", "open");
      await service.from("task_schedules").delete().in("id", schedIds);
    }
  }

  const { error } = await service
    .from(table)
    .delete()
    .eq("id", entryId)
    .eq("animal_id", animalId);
  if (error) return { error: error.message };

  revalidateHealth(animalId);
  if (table === "treatments") {
    revalidatePath(`/admin/animals/${animalId}`);
    revalidatePath("/admin/tasks");
  }
  return { ok: true };
}
