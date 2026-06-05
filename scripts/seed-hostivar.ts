/**
 * Seed bohatého vzorku dat pro „Útulek Hostivař" — od všeho něco.
 * Spouštět po vyčištění. Idempotentní není; počítá s prázdným útulkem.
 */
import { Client } from "pg";

const INST = "a260ceae-369e-4d9f-9c15-57faa95e3efe";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}
function daysAhead(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

async function main() {
  const url = (process.env.POSTGRES_URL_NON_POOLING ?? "").replace(/[?&]sslmode=[^&]*/g, "");
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Owner pro created_by
  const ownerRes = await c.query(
    `select user_id from institution_members where institution_id=$1 and role='owner' limit 1`,
    [INST],
  );
  const owner: string | null = ownerRes.rows[0]?.user_id ?? null;

  async function ins(table: string, obj: Record<string, unknown>): Promise<string> {
    const keys = Object.keys(obj);
    const vals = keys.map((k) => obj[k]);
    const ph = keys.map((_, i) => `$${i + 1}`).join(", ");
    const r = await c.query(
      `insert into ${table} (${keys.join(", ")}) values (${ph}) returning id`,
      vals,
    );
    return r.rows[0].id as string;
  }

  await c.query("begin");

  // ── Kotce ──────────────────────────────────────────────────────────
  const kA1 = await ins("kennels", {
    institution_id: INST, name: "Kotec A-1", zone: "Budova A", kind: "standard",
    status: "active", capacity: 3, species_allowed: ["dog"], is_heated: true, notes: "Klidní psi",
  });
  const kA2 = await ins("kennels", {
    institution_id: INST, name: "Kotec A-2", zone: "Budova A", kind: "standard",
    status: "active", capacity: 3, species_allowed: ["dog", "cat"],
  });
  const kQ1 = await ins("kennels", {
    institution_id: INST, name: "Karanténa 1", zone: "Karanténní blok", kind: "quarantine",
    status: "active", capacity: 2,
  });
  await ins("kennels", {
    institution_id: INST, name: "Kotec B-1", zone: "Budova B", kind: "standard",
    status: "out_of_service", capacity: 2,
    out_of_service_reason: "dezinfekce", out_of_service_until: daysAhead(8),
  });

  // ── Pěstouni ───────────────────────────────────────────────────────
  const fcJarka = await ins("foster_carers", {
    institution_id: INST, name: "Jaroslava Kostová", email: "jarka@example.cz",
    phone: "+420 603 111 222", city: "Kladno", region: "Středočeský", capacity: 1,
    species_note: "Malí psi", tags: ["small_dogs", "garden", "socialization"],
    is_active: true, created_by: owner,
  });
  const fcPetr = await ins("foster_carers", {
    institution_id: INST, name: "Petr Novák", email: "petr@example.cz",
    phone: "+420 604 333 444", city: "Praha", region: "Praha", capacity: 2,
    species_note: "Velcí psi, léky", tags: ["big_dogs", "meds"], is_active: true, created_by: owner,
  });
  await ins("foster_carers", {
    institution_id: INST, name: "Eva Malá", email: "eva@example.cz",
    phone: "+420 605 555 666", city: "Brno", region: "Jihomoravský", capacity: 2,
    species_note: "Kočky, pooperační péče", tags: ["cats", "post_op"],
    is_active: true, unavailable_until: daysAhead(20), created_by: owner,
  });

  // ── Zvířata ────────────────────────────────────────────────────────
  let seq = 0;
  const rec = () => `2026/${String(++seq).padStart(4, "0")}`;

  async function animal(o: Record<string, unknown>): Promise<string> {
    return ins("animals", { institution_id: INST, record_number: rec(), ...o });
  }

  const rex = await animal({
    name: "Rex", species: "dog", sex: "male", size: "large", breed: "Německý ovčák",
    health_status: "healthy", adoption_status: "available", legal_status: "shelter_owned",
    supervision_status: "released", intake_type: "found", intake_date: daysAgo(40),
    found_location: "Hostivař, les", kennel_id: kA1, is_vaccinated: true,
    good_with_children: "yes", good_with_dogs: "yes", needs_garden: true,
    personality_tags: ["přátelský", "aktivní"], description: "Hodný velký pes.",
  });
  const bara = await animal({
    name: "Bára", species: "dog", sex: "female", size: "small", breed: "Kříženec",
    is_crossbreed: true, adoption_status: "available", legal_status: "shelter_owned",
    supervision_status: "released", intake_type: "surrender", intake_date: daysAgo(130),
    kennel_id: kA1, long_stay_boost: true, good_with_children: "yes", good_with_cats: "yes",
    description: "Dlouho čeká na domov.",
  });
  const max = await animal({
    name: "Max", species: "dog", sex: "male", size: "large", breed: "Labrador",
    adoption_status: "reserved", legal_status: "shelter_owned", supervision_status: "released",
    intake_type: "found", intake_date: daysAgo(25), kennel_id: kA2, is_vaccinated: true,
  });
  const rocky = await animal({
    name: "Rocky", species: "dog", sex: "male", size: "medium",
    adoption_status: "adopted", legal_status: "shelter_owned", supervision_status: "released",
    intake_type: "found", intake_date: daysAgo(90),
  });
  const ares = await animal({
    name: "Áres", species: "dog", sex: "male", size: "large", breed: "Rotvajler",
    adoption_status: "foster", legal_status: "shelter_owned", supervision_status: "released",
    intake_type: "surrender", intake_date: daysAgo(60), good_with_dogs: "yes",
  });
  const uno = await animal({
    name: "Uno", species: "dog", sex: "male", size: "medium",
    adoption_status: "intake", legal_status: "in_protection", supervision_status: "released",
    intake_type: "found", intake_date: daysAgo(3), found_location: "Petrovice",
    protection_until: daysAhead(30), auto_publish: false,
  });
  const cks = await animal({
    name: "Cks", species: "dog", sex: "female", size: "small",
    adoption_status: "intake", legal_status: "shelter_owned", supervision_status: "quarantine",
    health_status: "treated", intake_type: "transfer", intake_date: daysAgo(5), kennel_id: kQ1,
  });
  const bert = await animal({
    name: "Bert", species: "dog", sex: "male", size: "large",
    adoption_status: "deceased", legal_status: "shelter_owned", supervision_status: "released",
    intake_type: "found", intake_date: daysAgo(200),
  });
  const mina = await animal({
    name: "Mína", species: "cat", sex: "female",
    adoption_status: "available", legal_status: "shelter_owned", supervision_status: "released",
    intake_type: "surrender", intake_date: daysAgo(20), kennel_id: kA2, is_vaccinated: true,
    good_with_children: "yes", good_with_cats: "yes",
  });
  const zofka = await animal({
    name: "Žofka", species: "cat", sex: "female",
    adoption_status: "intake", legal_status: "in_protection", supervision_status: "quarantine",
    intake_type: "found", intake_date: daysAgo(4), protection_until: daysAhead(31), kennel_id: kQ1,
  });
  await animal({
    name: "Líza", species: "cat", sex: "female",
    adoption_status: "adopted", legal_status: "shelter_owned", supervision_status: "released",
    intake_type: "surrender", intake_date: daysAgo(75),
  });
  await animal({
    name: "Tom", species: "cat", sex: "male",
    adoption_status: "on_hold", legal_status: "shelter_owned", supervision_status: "monitored",
    intake_type: "found", intake_date: daysAgo(15),
  });
  await animal({
    name: "Ušák", species: "rabbit", sex: "male", health_status: "special_needs",
    adoption_status: "available", legal_status: "shelter_owned", supervision_status: "released",
    intake_type: "surrender", intake_date: daysAgo(18),
  });

  // ── Ustájení (historie přesunů) ────────────────────────────────────
  for (const [aid, kid] of [[rex, kA1], [bara, kA1], [max, kA2], [cks, kQ1], [zofka, kQ1], [mina, kA2]] as const) {
    await ins("kennel_assignments", { animal_id: aid, kennel_id: kid, moved_in_at: new Date().toISOString(), created_by: owner });
  }

  // ── Zdraví ─────────────────────────────────────────────────────────
  await ins("vaccinations", { animal_id: rex, vaccine: "Vzteklina", administered_at: daysAgo(30), valid_until: daysAhead(335), vet_name: "MVDr. Novotná" });
  await ins("vaccinations", { animal_id: mina, vaccine: "Mor koček", administered_at: daysAgo(15), valid_until: daysAhead(350) });
  await ins("treatments", { animal_id: cks, name: "Antibiotika", type: "medication", start_date: daysAgo(4), end_date: daysAhead(3) });
  await ins("vet_records", { animal_id: rex, category: "checkup", title: "Vstupní prohlídka", recorded_at: daysAgo(39), vet_name: "MVDr. Novotná" });

  // ── Karanténa ──────────────────────────────────────────────────────
  await ins("quarantine_records", { animal_id: cks, institution_id: INST, kind: "quarantine", started_on: daysAgo(5), planned_until: daysAhead(9), reason: "Vstupní karanténa", created_by: owner });
  await ins("quarantine_records", { animal_id: zofka, institution_id: INST, kind: "quarantine", started_on: daysAgo(4), planned_until: daysAhead(10), reason: "Nález", created_by: owner });

  // ── Pěstounská péče (aktivní u Jarky → Áres) ───────────────────────
  await ins("foster_placements", { animal_id: ares, institution_id: INST, carer_id: fcJarka, started_on: daysAgo(30), planned_until: daysAhead(60), created_by: owner });

  // ── Adopce (finalizovaná) ──────────────────────────────────────────
  await ins("adoptions", { animal_id: rocky, institution_id: INST, adopter_name: "Jana Marková", adopter_email: "jana@example.cz", stage: "finalized", started_on: daysAgo(30), finalized_on: daysAgo(20), fee: 1500 });

  // ── Žádosti o adopci ───────────────────────────────────────────────
  await ins("applications", { animal_id: rex, institution_id: INST, applicant_name: "Karel Dvořák", applicant_email: "karel@example.cz", applicant_phone: "+420 777 123 456", applicant_city: "Praha", status: "new", applicant_message: "Mám zahradu, zkušenost se psy." });
  await ins("applications", { animal_id: bara, institution_id: INST, applicant_name: "Lucie Horká", applicant_email: "lucie@example.cz", applicant_city: "Kladno", status: "review" });
  await ins("applications", { animal_id: max, institution_id: INST, applicant_name: "Tomáš Black", applicant_email: "tomas@example.cz", status: "in_person_meeting", meeting_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), meeting_location: "Útulek Hostivař" });
  await ins("applications", { animal_id: mina, institution_id: INST, applicant_name: "Petra Svobodová", applicant_email: "petra@example.cz", status: "approved" });

  // ── Úkoly ──────────────────────────────────────────────────────────
  await ins("animal_tasks", { institution_id: INST, animal_id: rex, type: "vet_checkup", priority: "normal", title: "Kontrola u veterináře", status: "open", source: "manual", due_date: daysAhead(3), created_by: owner });
  await ins("animal_tasks", { institution_id: INST, animal_id: null, type: "custom", priority: "high", title: "Zavolat veterináři kvůli objednání", status: "open", source: "manual", due_date: daysAgo(0), created_by: owner });
  await ins("animal_tasks", { institution_id: INST, animal_id: bara, type: "long_stay", priority: "normal", title: "Dlouhý pobyt: Bára — zvážit zviditelnění", status: "open", source: "auto", due_date: daysAgo(2) });
  await ins("animal_tasks", { institution_id: INST, animal_id: uno, type: "protection_deadline", priority: "high", title: "Konec ochranné lhůty: Uno", status: "open", source: "auto", due_date: daysAhead(30) });
  await ins("animal_tasks", { institution_id: INST, animal_id: rocky, type: "adoption_followup", priority: "normal", title: "Pozadopční kontrola: Rocky", status: "done", source: "auto", completed_at: new Date().toISOString(), completed_by: owner });

  // ── Náklady + dary ─────────────────────────────────────────────────
  await ins("animal_costs", { animal_id: rex, institution_id: INST, category: "vet", amount: 1200, spent_on: daysAgo(38), description: "Vstupní prohlídka", source: "manual", created_by: owner });
  await ins("animal_costs", { animal_id: rex, institution_id: INST, category: "vaccination", amount: 450, spent_on: daysAgo(30), description: "Vzteklina", source: "manual", created_by: owner });
  await ins("animal_costs", { animal_id: ares, institution_id: INST, category: "food", amount: 280, spent_on: daysAgo(10), description: "Krmivo (pěstoun)", source: "foster", created_by: owner });
  await ins("animal_costs", { animal_id: cks, institution_id: INST, category: "medication", amount: 600, spent_on: daysAgo(4), description: "Antibiotika", source: "manual", created_by: owner });
  await ins("animal_donations", { animal_id: rex, institution_id: INST, kind: "money", amount: 1000, donor: "Anna Veselá", source: "manual", occurred_on: daysAgo(12), note: "Na péči o Rexe" });
  await ins("animal_donations", { animal_id: mina, institution_id: INST, kind: "in_kind", item: "Pytel granulí 10 kg", donor: "Zoo Market", source: "manual", occurred_on: daysAgo(8) });

  // ── Dokumenty ──────────────────────────────────────────────────────
  await ins("animal_documents", { animal_id: uno, institution_id: INST, title: "Doklad o příjmu", category: "intake", file_path: "seed/uno-intake.pdf", source: "generated", uploaded_by: owner });
  await ins("animal_documents", { animal_id: rex, institution_id: INST, title: "Očkovací průkaz", category: "vaccination", file_path: "seed/rex-vacc.pdf", source: "upload", uploaded_by: owner });

  // ── Incidenty + výstupní záznamy (pro evidenci) ────────────────────
  await ins("animal_incidents", { animal_id: rex, institution_id: INST, kind: "escape", occurred_on: daysAgo(15), resolved_on: daysAgo(15), location: "Zahrada útulku", description: "Přeskočil plot", resolution: "Odchycen do hodiny", reported_to: "—", created_by: owner });
  await ins("animal_exit_records", { animal_id: bert, institution_id: INST, kind: "death", occurred_on: daysAgo(10), reason: "Stáří", vet: "MVDr. Novotná", details: "Přirozený úhyn", created_by: owner });

  await c.query("commit");

  // Souhrn
  const counts = await c.query(
    `select
      (select count(*) from animals where institution_id=$1) animals,
      (select count(*) from kennels where institution_id=$1) kennels,
      (select count(*) from foster_carers where institution_id=$1) carers,
      (select count(*) from applications where institution_id=$1) apps,
      (select count(*) from animal_tasks where institution_id=$1) tasks`,
    [INST],
  );
  console.log("✓ Seed hotový:", JSON.stringify(counts.rows[0]));
  await c.end();
}

main().catch((e) => {
  console.error("Seed selhal:", e);
  process.exit(1);
});
