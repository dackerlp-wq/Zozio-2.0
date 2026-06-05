import { NextResponse, type NextRequest } from "next/server";

import { sendEmail } from "@/lib/email/send";
import {
  TaskDigestEmail,
  type DigestTask,
} from "@/lib/email/templates/task-digest";
import { ApplicationMeetingReminderEmail } from "@/lib/email/templates/application-meeting-reminder";
import { ScheduledExportEmail } from "@/lib/email/templates/scheduled-export";
import { ANIMAL_TASK_TYPE_LABEL } from "@/lib/format";
import {
  applyColumnTemplate,
  buildReport,
  type Range,
} from "@/lib/exports/reports";
import { buildXlsx } from "@/lib/exports/xlsx";
import { logExport, periodLabel } from "@/lib/exports/helpers";
import { renderKvsEvidence } from "@/lib/pdf/kvs-evidence";
import { createServiceClient } from "@/lib/supabase/service";
import { advanceDate, subtractDays } from "@/lib/task-schedule";
import type {
  AnimalTaskPriority,
  AnimalTaskType,
  TaskScheduleFreq,
} from "@/types/database";

// Připomínky generujeme i posíláme přes service klienta (obchází RLS).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VACCINATION_WINDOW_DAYS = 14;
const TREATMENT_WINDOW_DAYS = 3;
const LONG_STAY_DAYS = 90;
const PROTECTION_WINDOW_DAYS = 7;
const QUARANTINE_WINDOW_DAYS = 2;
const FOSTER_WINDOW_DAYS = 3;
const ADOPTION_TRIAL_WINDOW_DAYS = 3;
const POST_ADOPTION_CHECK_DAYS = 30;

const DAY_MS = 86_400_000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface AutoTaskCandidate {
  institution_id: string;
  animal_id: string;
  type: AnimalTaskType;
  priority: AnimalTaskPriority;
  title: string;
  description: string | null;
  due_date: string | null;
  source_ref: string;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET není nastaven." },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
  }

  const service = createServiceClient();
  const today = isoDate(new Date());
  const vaccUntil = isoDate(new Date(Date.now() + VACCINATION_WINDOW_DAYS * DAY_MS));
  const treatUntil = isoDate(new Date(Date.now() + TREATMENT_WINDOW_DAYS * DAY_MS));
  const longStayBefore = isoDate(new Date(Date.now() - LONG_STAY_DAYS * DAY_MS));
  const protectionUntil = isoDate(
    new Date(Date.now() + PROTECTION_WINDOW_DAYS * DAY_MS),
  );
  const quarantineUntil = isoDate(
    new Date(Date.now() + QUARANTINE_WINDOW_DAYS * DAY_MS),
  );
  const fosterUntil = isoDate(
    new Date(Date.now() + FOSTER_WINDOW_DAYS * DAY_MS),
  );
  const adoptionTrialUntil = isoDate(
    new Date(Date.now() + ADOPTION_TRIAL_WINDOW_DAYS * DAY_MS),
  );

  const candidates: AutoTaskCandidate[] = [];

  // --- Očkování končící v následujících 14 dnech --------------------------
  const { data: vaccs } = await service
    .from("vaccinations")
    .select("id, vaccine, valid_until, animal_id, animals!inner(id, name, institution_id, adoption_status)")
    .not("valid_until", "is", null)
    .gte("valid_until", today)
    .lte("valid_until", vaccUntil);

  for (const v of (vaccs ?? []) as unknown as Array<{
    id: string;
    vaccine: string;
    valid_until: string;
    animal_id: string;
    animals: { id: string; name: string; institution_id: string; adoption_status: string };
  }>) {
    if (isClosed(v.animals.adoption_status)) continue;
    candidates.push({
      institution_id: v.animals.institution_id,
      animal_id: v.animal_id,
      type: "vaccination",
      priority: "high",
      title: `Očkování brzy vyprší: ${v.vaccine}`,
      description: `Platnost očkování „${v.vaccine}" u ${v.animals.name} končí ${v.valid_until}.`,
      due_date: v.valid_until,
      source_ref: v.id,
    });
  }

  // --- Léčba s termínem do 3 dnů ------------------------------------------
  const { data: treats } = await service
    .from("treatments")
    .select("id, name, next_due, animal_id, animals!inner(id, name, institution_id, adoption_status)")
    .not("next_due", "is", null)
    .lte("next_due", treatUntil);

  for (const t of (treats ?? []) as unknown as Array<{
    id: string;
    name: string;
    next_due: string;
    animal_id: string;
    animals: { id: string; name: string; institution_id: string; adoption_status: string };
  }>) {
    if (isClosed(t.animals.adoption_status)) continue;
    candidates.push({
      institution_id: t.animals.institution_id,
      animal_id: t.animal_id,
      type: "treatment",
      priority: "high",
      title: `Léčba k provedení: ${t.name}`,
      description: `Termín léčby „${t.name}" u ${t.animals.name} je ${t.next_due}.`,
      due_date: t.next_due,
      source_ref: t.id,
    });
  }

  // --- Dlouhý pobyt (90+ dní k adopci) ------------------------------------
  const { data: longStay } = await service
    .from("animals")
    .select("id, name, institution_id, intake_date, created_at, adoption_status")
    .eq("adoption_status", "available")
    .or(`intake_date.lte.${longStayBefore},and(intake_date.is.null,created_at.lte.${longStayBefore}T23:59:59)`);

  for (const a of (longStay ?? []) as unknown as Array<{
    id: string;
    name: string;
    institution_id: string;
    intake_date: string | null;
    created_at: string;
    adoption_status: string;
  }>) {
    candidates.push({
      institution_id: a.institution_id,
      animal_id: a.id,
      type: "long_stay",
      priority: "normal",
      title: `Dlouhý pobyt: ${a.name}`,
      description: `${a.name} je k adopci déle než ${LONG_STAY_DAYS} dní. Zvaž zviditelnění nebo přesun do pěstounské péče.`,
      due_date: today,
      source_ref: a.id,
    });
  }

  // --- Konec ochranné lhůty (do 7 dní nebo už po termínu) -----------------
  const { data: protection } = await service
    .from("animals")
    .select("id, name, institution_id, protection_until, adoption_status")
    .eq("legal_status", "in_protection")
    .not("protection_until", "is", null)
    .lte("protection_until", protectionUntil);

  for (const a of (protection ?? []) as unknown as Array<{
    id: string;
    name: string;
    institution_id: string;
    protection_until: string;
    adoption_status: string;
  }>) {
    if (isClosed(a.adoption_status)) continue;
    const expired = a.protection_until < today;
    candidates.push({
      institution_id: a.institution_id,
      animal_id: a.id,
      type: "protection_deadline",
      priority: "high",
      title: expired
        ? `Ochranná lhůta vypršela: ${a.name}`
        : `Brzy končí ochranná lhůta: ${a.name}`,
      description: expired
        ? `Ochranná lhůta u ${a.name} vypršela ${a.protection_until}. Můžeš zvíře převést do vlastnictví útulku a uvolnit k adopci.`
        : `Ochranná lhůta u ${a.name} končí ${a.protection_until}. Po jejím konci lze zvíře adoptovat.`,
      due_date: a.protection_until,
      source_ref: a.id,
    });
  }

  // --- Konec karantény / dohledu (plánovaný konec do 2 dní) ---------------
  const { data: quarantines } = await service
    .from("quarantine_records")
    .select(
      "id, kind, planned_until, animal_id, animals!inner(id, name, institution_id, adoption_status)",
    )
    .is("ended_on", null)
    .not("planned_until", "is", null)
    .lte("planned_until", quarantineUntil);

  for (const q of (quarantines ?? []) as unknown as Array<{
    id: string;
    kind: string;
    planned_until: string;
    animal_id: string;
    animals: {
      id: string;
      name: string;
      institution_id: string;
      adoption_status: string;
    };
  }>) {
    if (isClosed(q.animals.adoption_status)) continue;
    candidates.push({
      institution_id: q.animals.institution_id,
      animal_id: q.animal_id,
      type: "quarantine_end",
      priority: "high",
      title: `Zkontrolovat konec dohledu: ${q.animals.name}`,
      description: `Plánovaný konec karantény/dohledu u ${q.animals.name} je ${q.planned_until}. Posuď, zda zvíře uvolnit do běžné části.`,
      due_date: q.planned_until,
      source_ref: q.id,
    });
  }

  // --- Konec dočasné péče (plánovaný návrat do 3 dní) ---------------------
  const { data: fosters } = await service
    .from("foster_placements")
    .select(
      "id, planned_until, animal_id, foster_carers(name), animals!inner(id, name, institution_id, adoption_status)",
    )
    .is("ended_on", null)
    .not("planned_until", "is", null)
    .lte("planned_until", fosterUntil);

  for (const f of (fosters ?? []) as unknown as Array<{
    id: string;
    planned_until: string;
    animal_id: string;
    foster_carers: { name: string } | null;
    animals: {
      id: string;
      name: string;
      institution_id: string;
      adoption_status: string;
    };
  }>) {
    if (isClosed(f.animals.adoption_status)) continue;
    const carer = f.foster_carers?.name ?? "pěstoun";
    candidates.push({
      institution_id: f.animals.institution_id,
      animal_id: f.animal_id,
      type: "foster_followup",
      priority: "normal",
      title: `Blíží se konec dočasné péče: ${f.animals.name}`,
      description: `Plánovaný návrat ${f.animals.name} od pěstouna ${carer} je ${f.planned_until}. Domluv prodloužení nebo návrat do útulku.`,
      due_date: f.planned_until,
      source_ref: f.id,
    });
  }

  // --- Konec zkušební doby adopce (do 3 dní) ------------------------------
  const { data: trials } = await service
    .from("adoptions")
    .select(
      "id, trial_until, adopter_name, animal_id, animals!inner(id, name, institution_id, adoption_status)",
    )
    .eq("stage", "trial")
    .not("trial_until", "is", null)
    .lte("trial_until", adoptionTrialUntil);

  for (const t of (trials ?? []) as unknown as Array<{
    id: string;
    trial_until: string;
    adopter_name: string;
    animal_id: string;
    animals: {
      id: string;
      name: string;
      institution_id: string;
      adoption_status: string;
    };
  }>) {
    if (isClosed(t.animals.adoption_status)) continue;
    candidates.push({
      institution_id: t.animals.institution_id,
      animal_id: t.animal_id,
      type: "adoption_followup",
      priority: "normal",
      title: `Konec zkušební doby: ${t.animals.name}`,
      description: `Zkušební doba adopce ${t.animals.name} (adoptant ${t.adopter_name}) končí ${t.trial_until}. Posuď, zda uzavřít trvalou adopci, nebo zvíře vrátit.`,
      due_date: t.trial_until,
      source_ref: t.id,
    });
  }

  // --- Kontrola po adopci (cca 30 dní po finalizaci) ---------------------
  const postAdoptFrom = isoDate(new Date(Date.now() - 60 * DAY_MS));
  const postAdoptTo = isoDate(new Date(Date.now() - POST_ADOPTION_CHECK_DAYS * DAY_MS));
  const { data: finalized } = await service
    .from("adoptions")
    .select(
      "id, finalized_on, adopter_name, animal_id, animals!inner(id, name, institution_id)",
    )
    .eq("stage", "finalized")
    .not("finalized_on", "is", null)
    .gte("finalized_on", postAdoptFrom)
    .lte("finalized_on", postAdoptTo);

  for (const f of (finalized ?? []) as unknown as Array<{
    id: string;
    finalized_on: string;
    adopter_name: string;
    animal_id: string;
    animals: { id: string; name: string; institution_id: string };
  }>) {
    candidates.push({
      institution_id: f.animals.institution_id,
      animal_id: f.animal_id,
      type: "adoption_followup",
      priority: "normal",
      title: `Kontrola po adopci: ${f.animals.name}`,
      description: `${f.animals.name} byl adoptován (${f.adopter_name}) ${f.finalized_on}. Ozvi se novému majiteli, jak se zvířeti daří — volitelně s fotkami.`,
      due_date: addDays(f.finalized_on, POST_ADOPTION_CHECK_DAYS),
      // Odlišný prefix od konce zkušebky (stejný typ, stejné id adopce).
      source_ref: `post-adopt:${f.id}`,
    });
  }

  // --- Expirace dokumentů (do 14 dní / po platnosti) ---------------------
  const docExpiryUntil = isoDate(new Date(Date.now() + 14 * DAY_MS));
  const { data: expiringDocs } = await service
    .from("animal_documents")
    .select("id, title, expires_on, animal_id, animals!inner(id, name, institution_id, adoption_status)")
    .not("expires_on", "is", null)
    .lte("expires_on", docExpiryUntil);

  for (const d of (expiringDocs ?? []) as unknown as Array<{
    id: string;
    title: string;
    expires_on: string;
    animal_id: string;
    animals: { id: string; name: string; institution_id: string; adoption_status: string };
  }>) {
    if (isClosed(d.animals.adoption_status)) continue;
    candidates.push({
      institution_id: d.animals.institution_id,
      animal_id: d.animal_id,
      type: "custom",
      priority: "normal",
      title: `Platnost dokumentu končí: ${d.animals.name}`,
      description: `Dokumentu „${d.title}" u ${d.animals.name} končí platnost ${d.expires_on}. Obnov nebo nahraj aktuální verzi.`,
      due_date: d.expires_on,
      source_ref: `doc-expiry:${d.id}`,
    });
  }

  // --- Vlož jen ty, které ještě jako auto-úkol neexistují -----------------
  let created = 0;
  if (candidates.length > 0) {
    const refs = candidates.map((c) => c.source_ref);
    const { data: existing } = await service
      .from("animal_tasks")
      .select("source_ref, type")
      .eq("source", "auto")
      .in("source_ref", refs);

    const seen = new Set(
      (existing ?? []).map(
        (e: { source_ref: string | null; type: string }) =>
          `${e.source_ref}:${e.type}`,
      ),
    );

    const toInsert = candidates
      .filter((c) => !seen.has(`${c.source_ref}:${c.type}`))
      .map((c) => ({
        institution_id: c.institution_id,
        animal_id: c.animal_id,
        type: c.type,
        priority: c.priority,
        title: c.title,
        description: c.description,
        due_date: c.due_date,
        status: "open" as const,
        source: "auto" as const,
        source_ref: c.source_ref,
      }));

    if (toInsert.length > 0) {
      const { error, count } = await service
        .from("animal_tasks")
        .insert(toInsert, { count: "exact" });
      if (!error) created = count ?? toInsert.length;
    }
  }

  // --- Pravidelné úkoly (šablony task_schedules) --------------------------
  const generated = await materializeSchedules(service, today);

  // --- Připomínky osobních schůzek den předem -----------------------------
  const meetingReminders = await sendMeetingReminders(service);

  // --- Denní digest ownerům -----------------------------------------------
  const emailsSent = await sendDigests(service, today);

  // --- Naplánované měsíční exporty (1. dne v měsíci, placené) --------------
  const scheduledExports = await sendScheduledExports(service);

  return NextResponse.json({
    ok: true,
    created,
    generated,
    meetingReminders,
    emailsSent,
    scheduledExports,
  });
}

const KVS_COLUMNS = [
  "Číslo záznamu",
  "Jméno",
  "Druh",
  "Způsob příjmu",
  "Datum příjmu",
  "Právní stav",
  "Stav",
];

/**
 * Měsíční naplánované exporty: 1. dne v měsíci pošle institucím s placeným
 * tarifem a zapnutým přepínačem KVS / účetní export za minulý měsíc e-mailem.
 */
async function sendScheduledExports(
  service: ReturnType<typeof createServiceClient>,
): Promise<number> {
  const now = new Date();
  if (now.getUTCDate() !== 1) return 0;

  // Minulý měsíc.
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const range: Range = { from: isoDate(start), to: isoDate(end) };
  const label = periodLabel(range);

  const { data: insts } = await service
    .from("institutions")
    .select("id, name, legal_name, ico, address, city, plan, export_kvs_monthly, export_accounting_monthly")
    .in("plan", ["standard", "pro"])
    .or("export_kvs_monthly.eq.true,export_accounting_monthly.eq.true");

  let sent = 0;
  for (const inst of (insts ?? []) as Array<{
    id: string;
    name: string;
    legal_name: string | null;
    ico: string | null;
    address: string | null;
    city: string | null;
    plan: string;
    export_kvs_monthly: boolean;
    export_accounting_monthly: boolean;
  }>) {
    // Najdi e-mail ownera.
    const { data: member } = await service
      .from("institution_members")
      .select("user_id")
      .eq("institution_id", inst.id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    if (!member) continue;
    const { data: userRes } = await service.auth.admin.getUserById(
      (member as { user_id: string }).user_id,
    );
    const email = userRes?.user?.email;
    if (!email) continue;

    const attachments: { filename: string; content: Buffer }[] = [];

    if (inst.export_kvs_monthly) {
      const full = await buildReport(service, inst.id, "intake", range);
      const data = applyColumnTemplate(full, KVS_COLUMNS);
      const buf = await renderKvsEvidence({
        institution: {
          name: inst.name,
          legalName: inst.legal_name,
          ico: inst.ico,
          address: [inst.address, inst.city].filter(Boolean).join(", ") || null,
        },
        periodLabel: label,
        generatedLabel: isoDate(now),
        headers: data.headers,
        rows: data.rows,
        widths: [1.2, 1.4, 1, 1.2, 1.1, 1.3, 1.1],
      });
      attachments.push({ filename: `evidence-kvs-${range.from}.pdf`, content: buf });
      await logExport(service, {
        institutionId: inst.id,
        kind: "kvs",
        format: "pdf",
        label: "Evidence pro KVS (PDF) — naplánováno",
        range,
      });
    }

    if (inst.export_accounting_monthly) {
      const acc = await buildReport(service, inst.id, "accounting", range);
      const buf = await buildXlsx([
        { name: "Účetní export", headers: acc.headers, rows: acc.rows },
      ]);
      attachments.push({
        filename: `ucetni-export-${range.from}.xlsx`,
        content: Buffer.from(buf),
      });
      // CSV varianta není potřeba — XLSX stačí; log:
      await logExport(service, {
        institutionId: inst.id,
        kind: "accounting",
        format: "xlsx",
        label: "Účetní export — naplánováno",
        range,
      });
    }

    if (attachments.length === 0) continue;

    const res = await sendEmail({
      to: email,
      subject: `Naplánovaný export — ${label}`,
      react: ScheduledExportEmail({
        institutionName: inst.name,
        exportLabel: "Naplánovaný měsíční export",
        periodLabel: label,
      }),
      attachments,
    });
    if (res.ok) sent += 1;
  }
  return sent;
}

interface ScheduleRow {
  id: string;
  institution_id: string;
  animal_id: string | null;
  type: AnimalTaskType;
  priority: AnimalTaskPriority;
  title: string;
  description: string | null;
  freq: TaskScheduleFreq;
  interval: number;
  start_date: string;
  end_date: string | null;
  lead_days: number;
  next_run: string;
}

/**
 * Z aktivních šablon vytvoří konkrétní úkoly. Pro každou šablonu projde
 * všechny termíny, jejichž „okno vzniku" (next_run − předstih) už nastalo,
 * a pro každý vytvoří úkol s termínem = datum výskytu. Pak posune next_run
 * a šablonu deaktivuje, pokud přesáhla end_date.
 */
async function materializeSchedules(
  service: ReturnType<typeof createServiceClient>,
  today: string,
): Promise<number> {
  const { data } = await service
    .from("task_schedules")
    .select(
      "id, institution_id, animal_id, type, priority, title, description, freq, interval, start_date, end_date, lead_days, next_run",
    )
    .eq("active", true)
    .lte("next_run", addDays(today, 90));

  const schedules = (data ?? []) as unknown as ScheduleRow[];
  if (schedules.length === 0) return 0;

  interface PlannedTask {
    schedule_id: string;
    schedule_date: string;
    institution_id: string;
    animal_id: string | null;
    type: AnimalTaskType;
    priority: AnimalTaskPriority;
    title: string;
    description: string | null;
    due_date: string;
  }

  const planned: PlannedTask[] = [];
  const updates: Array<{ id: string; next_run: string; active: boolean }> = [];

  for (const s of schedules) {
    let run = s.next_run;
    let active = true;
    let guard = 0;
    // Vytvoř úkol pro každý termín, jehož předstih už nastal.
    while (guard < 1000) {
      guard += 1;
      if (s.end_date && run > s.end_date) {
        active = false;
        break;
      }
      const opensOn = subtractDays(run, s.lead_days);
      if (opensOn > today) break;
      planned.push({
        schedule_id: s.id,
        schedule_date: run,
        institution_id: s.institution_id,
        animal_id: s.animal_id,
        type: s.type,
        priority: s.priority,
        title: s.title,
        description: s.description,
        due_date: run,
      });
      run = advanceDate(run, s.freq, s.interval);
    }
    updates.push({ id: s.id, next_run: run, active });
  }

  let generated = 0;

  if (planned.length > 0) {
    // Vynech termíny, které už jako úkol existují (dedup přes schedule_id+datum).
    const scheduleIds = [...new Set(planned.map((p) => p.schedule_id))];
    const { data: existing } = await service
      .from("animal_tasks")
      .select("schedule_id, schedule_date")
      .in("schedule_id", scheduleIds);

    const seen = new Set(
      (existing ?? []).map(
        (e: { schedule_id: string | null; schedule_date: string | null }) =>
          `${e.schedule_id}:${e.schedule_date}`,
      ),
    );

    const toInsert = planned
      .filter((p) => !seen.has(`${p.schedule_id}:${p.schedule_date}`))
      .map((p) => ({
        institution_id: p.institution_id,
        animal_id: p.animal_id,
        type: p.type,
        priority: p.priority,
        title: p.title,
        description: p.description,
        due_date: p.due_date,
        status: "open" as const,
        source: "auto" as const,
        schedule_id: p.schedule_id,
        schedule_date: p.schedule_date,
      }));

    if (toInsert.length > 0) {
      const { error, count } = await service
        .from("animal_tasks")
        .insert(toInsert, { count: "exact" });
      if (!error) generated = count ?? toInsert.length;
    }
  }

  // Posuň next_run / deaktivuj prošlé šablony.
  const nowIso = new Date().toISOString();
  for (const u of updates) {
    await service
      .from("task_schedules")
      .update({
        next_run: u.next_run,
        active: u.active,
        last_generated_at: nowIso,
      })
      .eq("id", u.id);
  }

  return generated;
}

function addDays(iso: string, days: number): string {
  return isoDate(new Date(new Date(iso + "T00:00:00Z").getTime() + days * DAY_MS));
}

function isClosed(status: string): boolean {
  return ["adopted", "transferred", "deceased"].includes(status);
}

/** Datum v časové zóně Europe/Prague jako YYYY-MM-DD (kvůli „den předem"). */
function pragueDate(d: Date): string {
  // en-CA formátuje jako YYYY-MM-DD
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Prague" });
}

interface MeetingReminderRow {
  id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_user_id: string | null;
  institution_id: string;
  meeting_at: string;
  meeting_location: string | null;
  animals: { name: string } | null;
  institutions: { name: string; email: string | null } | null;
}

/**
 * Pošle připomínku osobní schůzky den předem. Najde žádosti ve stavu
 * „osobní schůzka", jejichž termín (v Praze) připadá na zítřek a u nichž
 * ještě připomínka neodešla.
 */
async function sendMeetingReminders(
  service: ReturnType<typeof createServiceClient>,
): Promise<number> {
  const now = new Date();
  const tomorrow = pragueDate(new Date(now.getTime() + DAY_MS));
  // Okno: od teď do +2 dny pokryje zítřejší termíny bez ohledu na posun zóny.
  const horizon = new Date(now.getTime() + 2 * DAY_MS).toISOString();

  const { data } = await service
    .from("applications")
    .select(
      `id, applicant_name, applicant_email, applicant_user_id, institution_id,
       meeting_at, meeting_location,
       animals(name), institutions(name, email)`,
    )
    .eq("status", "in_person_meeting")
    .is("meeting_reminder_sent_at", null)
    .not("meeting_at", "is", null)
    .gte("meeting_at", now.toISOString())
    .lte("meeting_at", horizon);

  const rows = (data ?? []) as unknown as MeetingReminderRow[];
  let sent = 0;

  for (const r of rows) {
    if (pragueDate(new Date(r.meeting_at)) !== tomorrow) continue;

    const label = new Date(r.meeting_at).toLocaleString("cs-CZ", {
      timeZone: "Europe/Prague",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    await sendEmail({
      to: r.applicant_email,
      subject: `Připomínka: zítra schůzka kvůli ${r.animals?.name ?? "adopci"}`,
      react: ApplicationMeetingReminderEmail({
        applicantName: r.applicant_name.split(/\s+/)[0] || r.applicant_name,
        animalName: r.animals?.name ?? "zvíře",
        institutionName: r.institutions?.name ?? "útulek",
        meetingLabel: label,
        location: r.meeting_location,
      }),
      replyTo: r.institutions?.email ?? undefined,
    });

    await service
      .from("applications")
      .update({ meeting_reminder_sent_at: new Date().toISOString() })
      .eq("id", r.id);

    if (r.applicant_user_id) {
      await service.from("notifications").insert({
        user_id: r.applicant_user_id,
        institution_id: r.institution_id,
        type: "application_status_change",
        title: "Připomínka: zítra máte osobní schůzku",
        body: label,
        link: "/profil",
        metadata: { application_id: r.id },
      });
    }

    sent += 1;
  }

  return sent;
}

interface OpenTaskRow {
  id: string;
  type: AnimalTaskType;
  title: string;
  due_date: string | null;
  institution_id: string;
  animal_id: string | null;
  animals: { name: string } | null;
}

async function sendDigests(
  service: ReturnType<typeof createServiceClient>,
  today: string,
): Promise<number> {
  const { data: tasks } = await service
    .from("animal_tasks")
    .select("id, type, title, due_date, institution_id, animal_id, animals(name)")
    .eq("status", "open")
    .order("due_date", { ascending: true, nullsFirst: false });

  const rows = (tasks ?? []) as unknown as OpenTaskRow[];
  if (rows.length === 0) return 0;

  // Seskup podle instituce
  const byInstitution = new Map<string, OpenTaskRow[]>();
  for (const r of rows) {
    const list = byInstitution.get(r.institution_id) ?? [];
    list.push(r);
    byInstitution.set(r.institution_id, list);
  }

  let sent = 0;
  for (const [institutionId, instTasks] of byInstitution) {
    // Najdi ownera instituce
    const { data: member } = await service
      .from("institution_members")
      .select("user_id")
      .eq("institution_id", institutionId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    if (!member) continue;

    const { data: userRes } = await service.auth.admin.getUserById(
      (member as { user_id: string }).user_id,
    );
    const email = userRes?.user?.email;
    if (!email) continue;

    const { data: inst } = await service
      .from("institutions")
      .select("name, task_digest_enabled")
      .eq("id", institutionId)
      .maybeSingle();
    const instRow = inst as
      | { name: string; task_digest_enabled: boolean }
      | null;
    // Útulek si může ranní souhrn vypnout.
    if (instRow && instRow.task_digest_enabled === false) continue;
    const institutionName = instRow?.name ?? "Útulek";

    const overdue: DigestTask[] = [];
    const todayTasks: DigestTask[] = [];
    const upcoming: DigestTask[] = [];

    for (const t of instTasks) {
      const item: DigestTask = {
        id: t.id,
        title: t.title,
        typeLabel: ANIMAL_TASK_TYPE_LABEL[t.type],
        dueLabel: t.due_date,
        isOverdue: !!t.due_date && t.due_date < today,
        animalId: t.animal_id,
        animalName: t.animals?.name ?? null,
      };
      if (t.due_date && t.due_date < today) overdue.push(item);
      else if (t.due_date === today) todayTasks.push(item);
      else upcoming.push(item);
    }

    const res = await sendEmail({
      to: email,
      subject:
        overdue.length > 0
          ? `${overdue.length} úkolů po termínu — Zozio`
          : `Denní přehled úkolů — Zozio`,
      react: TaskDigestEmail({
        institutionName,
        overdue,
        today: todayTasks,
        upcoming,
      }),
    });
    if (res.ok) sent += 1;
  }

  return sent;
}
