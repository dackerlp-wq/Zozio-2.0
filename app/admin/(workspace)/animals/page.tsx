import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ADOPTION_STATUS_LABEL,
  ADOPTION_STATUS_PILL,
  SPECIES_LABEL,
  SEX_LABEL,
} from "@/lib/format";
import { animalAgeLabel } from "@/lib/animal-age";
import {
  daysInShelter,
  LIST_PRESETS,
  needsAttention,
  parsePreset,
  parseSegment,
  parseSort,
  rowMicroAction,
  secondaryBadges,
  TERMINAL_STATUSES,
  type AnimalListRaw,
  type ListPreset,
  type ListSegment,
  type ListSort,
} from "@/lib/animal-list";
import { AnimalsBoard, type AnimalRowVM } from "./animals-board";

export const metadata = { title: "Zvířata — Zozio Admin" };

interface PageProps {
  searchParams: Promise<{
    q?: string;
    preset?: string;
    segment?: string;
    sort?: string;
    limit?: string;
  }>;
}

const SELECT =
  "id, name, species, breed, sex, age_years, age_months, birth_date, primary_photo_url, adoption_status, legal_status, supervision_status, intake_type, intake_date, protection_until, found_listing_published, is_urgent, kennel:kennels(name)";

const TERMINAL_SQL = `(${TERMINAL_STATUSES.join(",")})`;

export default async function AnimalsAdminPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const q = (sp.q ?? "").trim();
  const preset = parsePreset(sp.preset);
  const segment = parseSegment(sp.segment);
  const sort = parseSort(sp.sort);
  const limit = Math.min(200, Math.max(20, parseInt(sp.limit ?? "20", 10) || 20));
  const todayStr = new Date().toISOString().slice(0, 10);
  const day90 = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const searchTerm = q.replace(/[%,()]/g, "");
  const orFilter = `name.ilike.%${searchTerm}%,record_number.ilike.%${searchTerm}%,chip_number.ilike.%${searchTerm}%,tattoo.ilike.%${searchTerm}%`;

  // Hlavní dotaz se stránkováním + řazením.
  let dq = supabase.from("animals").select(SELECT).eq("institution_id", institutionId);
  if (segment === "active") dq = dq.not("adoption_status", "in", TERMINAL_SQL);
  else if (segment === "archive") dq = dq.in("adoption_status", TERMINAL_STATUSES);
  if (preset === "available") dq = dq.eq("adoption_status", "available");
  else if (preset === "in_protection") dq = dq.eq("legal_status", "in_protection");
  else if (preset === "quarantine") dq = dq.in("supervision_status", ["quarantine", "isolation"]);
  else if (preset === "foster") dq = dq.eq("adoption_status", "foster");
  else if (preset === "long_stay") dq = dq.lte("intake_date", day90);
  else if (preset === "ready_unpublished")
    dq = dq
      .eq("legal_status", "shelter_owned")
      .eq("supervision_status", "released")
      .not("intake_type", "is", null)
      .not("intake_date", "is", null)
      .not("adoption_status", "in", `(available,${TERMINAL_STATUSES.join(",")})`);
  if (q) dq = dq.or(orFilter);
  if (sort === "name_asc") dq = dq.order("name", { ascending: true });
  else if (sort === "stay_desc") dq = dq.order("intake_date", { ascending: true, nullsFirst: false });
  else if (sort === "status") dq = dq.order("adoption_status", { ascending: true });
  else dq = dq.order("intake_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });

  // Počty (segment + preset, head). Funkce vrací thenable s aplikovaným presetem.
  function countFor(p: ListPreset) {
    let c = supabase
      .from("animals")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionId);
    if (segment === "active") c = c.not("adoption_status", "in", TERMINAL_SQL);
    else if (segment === "archive") c = c.in("adoption_status", TERMINAL_STATUSES);
    if (p === "available") c = c.eq("adoption_status", "available");
    else if (p === "in_protection") c = c.eq("legal_status", "in_protection");
    else if (p === "quarantine") c = c.in("supervision_status", ["quarantine", "isolation"]);
    else if (p === "foster") c = c.eq("adoption_status", "foster");
    else if (p === "long_stay") c = c.lte("intake_date", day90);
    else if (p === "ready_unpublished")
      c = c
        .eq("legal_status", "shelter_owned")
        .eq("supervision_status", "released")
        .not("intake_type", "is", null)
        .not("intake_date", "is", null)
        .not("adoption_status", "in", `(available,${TERMINAL_STATUSES.join(",")})`);
    if (q) c = c.or(orFilter);
    return c;
  }

  const [{ data }, ...presetRes] = await Promise.all([
    dq.range(0, limit - 1),
    ...LIST_PRESETS.map((p) => countFor(p.key)),
  ]);

  const rows = (data ?? []) as unknown as AnimalListRaw[];
  const counts: Record<string, number> = {};
  LIST_PRESETS.forEach((p, i) => {
    counts[p.key] = (presetRes[i] as { count: number | null }).count ?? 0;
  });
  const total = counts[preset] ?? counts.all ?? 0;

  // Jména pěstounů pro zobrazené řádky.
  const fosterByAnimal = new Map<string, string>();
  if (rows.length > 0) {
    const { data: fp } = await supabase
      .from("foster_placements")
      .select("animal_id, foster_carers(name)")
      .eq("institution_id", institutionId)
      .is("ended_on", null)
      .in("animal_id", rows.map((r) => r.id));
    for (const f of (fp ?? []) as { animal_id: string; foster_carers: { name: string } | null }[]) {
      if (f.foster_carers?.name) fosterByAnimal.set(f.animal_id, f.foster_carers.name);
    }
  }

  const vms: AnimalRowVM[] = rows.map((a) => {
    const days = daysInShelter(a.intake_date, todayStr);
    const fosterName = fosterByAnimal.get(a.id) ?? null;
    const meta = [
      SPECIES_LABEL[a.species],
      a.breed,
      a.sex !== "unknown" ? SEX_LABEL[a.sex] : null,
      animalAgeLabel(a),
      days != null ? `${days} dní` : null,
      a.kennel?.name ? `kotec ${a.kennel.name}` : fosterName ? `🏡 ${fosterName}` : null,
      a.legal_status === "in_protection" && a.protection_until
        ? `lhůta do ${new Date(a.protection_until + "T00:00:00").toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" })}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      id: a.id,
      name: a.name,
      photo: a.primary_photo_url,
      meta,
      statusLabel: ADOPTION_STATUS_LABEL[a.adoption_status],
      statusPill: ADOPTION_STATUS_PILL[a.adoption_status],
      badges: secondaryBadges(a, days),
      attention: needsAttention(a, todayStr),
      micro: rowMicroAction(a),
    };
  });

  return (
    <AnimalsBoard
      rows={vms}
      total={total}
      shown={rows.length}
      counts={counts}
      params={{ q, preset, segment, sort, limit }}
    />
  );
}
