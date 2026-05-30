import { NextResponse, type NextRequest } from "next/server";

import { sendEmail } from "@/lib/email/send";
import {
  TaskDigestEmail,
  type DigestTask,
} from "@/lib/email/templates/task-digest";
import { ANIMAL_TASK_TYPE_LABEL } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";
import type { AnimalTaskType } from "@/types/database";

// Připomínky generujeme i posíláme přes service klienta (obchází RLS).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VACCINATION_WINDOW_DAYS = 14;
const TREATMENT_WINDOW_DAYS = 3;
const LONG_STAY_DAYS = 90;

const DAY_MS = 86_400_000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface AutoTaskCandidate {
  institution_id: string;
  animal_id: string;
  type: AnimalTaskType;
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
      title: `Dlouhý pobyt: ${a.name}`,
      description: `${a.name} je k adopci déle než ${LONG_STAY_DAYS} dní. Zvaž zviditelnění nebo přesun do pěstounské péče.`,
      due_date: today,
      source_ref: a.id,
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

  // --- Denní digest ownerům -----------------------------------------------
  const emailsSent = await sendDigests(service, today);

  return NextResponse.json({ ok: true, created, emailsSent });
}

function isClosed(status: string): boolean {
  return ["adopted", "transferred", "deceased"].includes(status);
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
      .select("name")
      .eq("id", institutionId)
      .maybeSingle();
    const institutionName = (inst as { name: string } | null)?.name ?? "Útulek";

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
