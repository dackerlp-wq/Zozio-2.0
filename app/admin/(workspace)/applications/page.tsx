import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { scoreApplication } from "@/lib/animal-adoption-match";
import {
  ACTIVE_STATUSES,
  animalContext,
  APP_BUCKETS,
  isUnread,
  parseAppSegment,
  parseAppSort,
  parseBucket,
  pipelinePill,
  waitingDays,
  type AppBucket,
} from "@/lib/application-list";
import type {
  AdoptionStatus,
  ApplicationStatus,
  Compatibility,
  Json,
} from "@/types/database";

import { ApplicationsBoard, type AppRowVM } from "./applications-board";

export const metadata = { title: "Žádosti — Zozio Admin" };

interface PageProps {
  searchParams: Promise<{
    q?: string;
    bucket?: string;
    segment?: string;
    sort?: string;
    limit?: string;
    group?: string;
  }>;
}

const TERMINAL: ApplicationStatus[] = ["completed", "rejected"];
const ANIMAL_SELECT =
  "id, name, primary_photo_url, adoption_status, good_with_children, good_with_dogs, good_with_cats, needs_garden, suitable_housing, adopter_experience, care_difficulty";

interface RawApp {
  id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  applicant_city: string | null;
  applicant_message: string | null;
  applicant_data: Json;
  status: ApplicationStatus;
  internal_notes: string | null;
  created_at: string;
  animal: {
    id: string;
    name: string;
    primary_photo_url: string | null;
    adoption_status: AdoptionStatus;
    good_with_children: Compatibility;
    good_with_dogs: Compatibility;
    good_with_cats: Compatibility;
    needs_garden: boolean | null;
    suitable_housing: "apartment" | "house" | "both" | null;
    adopter_experience: "beginner_ok" | "experienced_only";
    care_difficulty: "easy" | "medium" | "high" | null;
  } | null;
}

export default async function ApplicationsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const q = (sp.q ?? "").trim();
  const bucket = parseBucket(sp.bucket);
  const segment = parseAppSegment(sp.segment);
  const sort = parseAppSort(sp.sort);
  const group = sp.group === "1";
  const limit = Math.min(200, Math.max(20, parseInt(sp.limit ?? "20", 10) || 20));
  const todayMs = Date.now();
  const searchTerm = q.replace(/[%,()]/g, "");
  const orFilter = `applicant_name.ilike.%${searchTerm}%,applicant_city.ilike.%${searchTerm}%`;

  let dq = supabase
    .from("applications")
    .select(
      `id, applicant_name, applicant_email, applicant_phone, applicant_city, applicant_message, applicant_data, status, internal_notes, created_at, animal:animals!inner(${ANIMAL_SELECT})`,
    )
    .eq("institution_id", institutionId);
  if (segment === "active") dq = dq.not("status", "in", `(${TERMINAL.join(",")})`);
  else if (segment === "archive") dq = dq.in("status", TERMINAL);
  if (bucket === "new") dq = dq.eq("status", "new");
  else if (bucket === "active") dq = dq.in("status", ACTIVE_STATUSES);
  else if (bucket === "completed") dq = dq.eq("status", "completed");
  else if (bucket === "rejected") dq = dq.eq("status", "rejected");
  if (q) dq = dq.or(orFilter);
  if (sort === "waiting") dq = dq.order("created_at", { ascending: true });
  else dq = dq.order("created_at", { ascending: false });

  function countFor(b: AppBucket | "all") {
    let c = supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionId);
    if (segment === "active") c = c.not("status", "in", `(${TERMINAL.join(",")})`);
    else if (segment === "archive") c = c.in("status", TERMINAL);
    if (b === "new") c = c.eq("status", "new");
    else if (b === "active") c = c.in("status", ACTIVE_STATUSES);
    else if (b === "completed") c = c.eq("status", "completed");
    else if (b === "rejected") c = c.eq("status", "rejected");
    if (q) c = c.or(orFilter);
    return c;
  }

  const [{ data }, ...countRes] = await Promise.all([
    dq.range(0, limit - 1),
    ...APP_BUCKETS.map((b) => countFor(b.key)),
  ]);

  const apps = (data ?? []) as unknown as RawApp[];
  const counts: Record<string, number> = {};
  APP_BUCKETS.forEach((b, i) => {
    counts[b.key] = (countRes[i] as { count: number | null }).count ?? 0;
  });
  const total = counts[bucket] ?? counts.all ?? 0;

  let vms: AppRowVM[] = apps.map((a) => {
    const an = a.animal;
    let score: number | null = null;
    if (an) {
      const m = scoreApplication(a.applicant_data, {
        good_with_children: an.good_with_children,
        good_with_dogs: an.good_with_dogs,
        good_with_cats: an.good_with_cats,
        needs_garden: an.needs_garden,
        suitable_housing: an.suitable_housing,
        adopter_experience: an.adopter_experience,
        care_difficulty: an.care_difficulty,
        hasSpecialNeeds: false,
      });
      if (m.chips.length > 0) score = m.score;
    }
    const pill = pipelinePill(a.status);
    return {
      id: a.id,
      applicantName: a.applicant_name,
      animalId: an?.id ?? null,
      animalName: an?.name ?? null,
      animalPhoto: an?.primary_photo_url ?? null,
      animalStatus: an?.adoption_status ?? null,
      city: a.applicant_city,
      createdAt: a.created_at,
      statusLabel: pill.label,
      statusTone: pill.tone,
      unread: isUnread(a.status),
      waiting: waitingDays(a.status, a.created_at, todayMs),
      score,
      note: a.internal_notes,
      context: animalContext(a.status, an?.adoption_status ?? null),
      message: a.applicant_message,
      phone: a.applicant_phone,
      email: a.applicant_email,
    };
  });

  if (sort === "score") {
    vms = [...vms].sort((x, y) => (y.score ?? -1) - (x.score ?? -1));
  }

  return (
    <ApplicationsBoard
      rows={vms}
      total={total}
      shown={apps.length}
      counts={counts}
      params={{ q, bucket, segment, sort, limit, group }}
    />
  );
}
