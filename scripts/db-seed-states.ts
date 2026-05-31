/**
 * Doplňkový seed: testovací zvířata pokrývající VŠECHNY stavy životního cyklu
 * a právní/dohledové osy (po auditu stavů). Přidává (nemaže) zvířata do
 * Útulku Hostivař. Každé jméno má prefix „[T] " pro snadné dohledání/smazání.
 *
 *   npx tsx scripts/db-seed-states.ts
 *   npx tsx scripts/db-seed-states.ts --wipe   # smaže předchozí [T] zvířata
 */
import { Client } from "pg";

const INSTITUTION_ID = "a260ceae-369e-4d9f-9c15-57faa95e3efe"; // Útulek Hostivař

const PHOTO = {
  dog: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=1200&q=80",
  dog2: "https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=1200&q=80",
  dog3: "https://images.unsplash.com/photo-1568572933382-74d440642117?w=1200&q=80",
  cat: "https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=1200&q=80",
  cat2: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=1200&q=80",
  owl: "https://images.unsplash.com/photo-1543549790-8b5f4a028cfb?w=1200&q=80",
};

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

interface Seed {
  name: string;
  species: string;
  breed: string;
  age_years?: number;
  age_months?: number;
  sex: string;
  size?: string;
  color?: string;
  photo: string;
  description: string;
  adoption_status: string;
  legal_status: string;
  supervision_status: string;
  intake_type?: string | null;
  is_urgent?: boolean;
  long_stay_boost?: boolean;
  found_location?: string | null;
  found_date?: string | null;
  announced_at?: string | null;
  found_listing_published?: boolean;
  original_owner?: string | null;
  chip_number?: string | null;
  identification_none?: boolean;
  published?: boolean; // má published_at
  auto_publish?: boolean;
  intake_offset_days: number;
}

const SEEDS: Seed[] = [
  // ── Adopční životní cyklus (shelter_owned, bez dohledu) ──────────────────
  {
    name: "Příjem — čerstvě přijatý",
    species: "dog",
    breed: "Kříženec",
    age_years: 2,
    sex: "male",
    size: "medium",
    color: "Hnědá",
    photo: PHOTO.dog,
    description:
      "Stav PŘÍJEM: nově přijatý, ještě nepřipravený na web (probíhá příjem).",
    adoption_status: "intake",
    legal_status: "shelter_owned",
    supervision_status: "released",
    intake_type: "surrender",
    chip_number: "203164000111001",
    intake_offset_days: 2,
  },
  {
    name: "K adopci — zveřejněný",
    species: "cat",
    breed: "Evropská",
    age_years: 3,
    sex: "female",
    size: "small",
    color: "Mourovatá",
    photo: PHOTO.cat,
    description:
      "Stav K ADOPCI: vyřízený příjem, zveřejněno v adopčním katalogu.",
    adoption_status: "available",
    legal_status: "shelter_owned",
    supervision_status: "released",
    intake_type: "surrender",
    chip_number: "203164000111002",
    published: true,
    auto_publish: true,
    intake_offset_days: 40,
  },
  {
    name: "K adopci — naléhavý",
    species: "dog",
    breed: "Německý ovčák",
    age_years: 6,
    sex: "male",
    size: "large",
    color: "Černá a zlatá",
    photo: PHOTO.dog3,
    description: "Stav K ADOPCI + příznak NALÉHÁ.",
    adoption_status: "available",
    legal_status: "shelter_owned",
    supervision_status: "released",
    intake_type: "transfer",
    is_urgent: true,
    chip_number: "203164000111003",
    published: true,
    intake_offset_days: 25,
  },
  {
    name: "K adopci — dlouho čeká",
    species: "dog",
    breed: "Stafordšírský bulteriér",
    age_years: 7,
    sex: "male",
    size: "medium",
    color: "Tygrovaná",
    photo: PHOTO.dog2,
    description: "Stav K ADOPCI + příznak DLOUHO ČEKÁ (long_stay_boost).",
    adoption_status: "available",
    legal_status: "shelter_owned",
    supervision_status: "released",
    intake_type: "surrender",
    long_stay_boost: true,
    chip_number: "203164000111004",
    published: true,
    intake_offset_days: 420,
  },
  {
    name: "Rezervováno — zkušební doba",
    species: "cat",
    breed: "Britská krátkosrstá",
    age_years: 2,
    sex: "female",
    size: "small",
    color: "Modrá",
    photo: PHOTO.cat2,
    description:
      "Stav REZERVOVÁNO (odvozený): běží zkušební doba adopce.",
    adoption_status: "reserved",
    legal_status: "shelter_owned",
    supervision_status: "released",
    intake_type: "surrender",
    chip_number: "203164000111005",
    published: true,
    intake_offset_days: 60,
  },
  {
    name: "Pozastaveno — dočasně z webu",
    species: "dog",
    breed: "Bígl",
    age_years: 4,
    sex: "female",
    size: "small",
    color: "Tříbarevná",
    photo: PHOTO.dog,
    description:
      "Stav POZASTAVENO (on_hold): dočasně staženo (např. nemoc), vrátí se zpět.",
    adoption_status: "on_hold",
    legal_status: "shelter_owned",
    supervision_status: "released",
    intake_type: "surrender",
    chip_number: "203164000111006",
    intake_offset_days: 80,
  },
  {
    name: "Nezveřejněno — staženo",
    species: "cat",
    breed: "Perská",
    age_years: 5,
    sex: "female",
    size: "small",
    color: "Bílá",
    photo: PHOTO.cat,
    description:
      "Stav NEZVEŘEJNĚNO (unpublished): drženo mimo veřejnou nabídku bez výstupu.",
    adoption_status: "unpublished",
    legal_status: "shelter_owned",
    supervision_status: "released",
    intake_type: "surrender",
    chip_number: "203164000111007",
    intake_offset_days: 90,
  },
  {
    name: "Pěstoun — v dočasné péči",
    species: "dog",
    breed: "Labrador",
    age_months: 4,
    sex: "male",
    size: "medium",
    color: "Černá",
    photo: PHOTO.dog3,
    description: "Stav PĚSTOUN (foster): zvíře je v dočasné péči mimo útulek.",
    adoption_status: "foster",
    legal_status: "shelter_owned",
    supervision_status: "released",
    intake_type: "surrender",
    chip_number: "203164000111008",
    intake_offset_days: 30,
  },
  {
    name: "Adoptováno — trvale",
    species: "cat",
    breed: "Ragdoll",
    age_years: 2,
    sex: "female",
    size: "medium",
    color: "Krémová",
    photo: PHOTO.cat2,
    description:
      "Stav ADOPTOVÁNO (výstup): trvalá adopce uzavřena, vlastnictví převedeno.",
    adoption_status: "adopted",
    legal_status: "transferred_out",
    supervision_status: "released",
    intake_type: "surrender",
    chip_number: "203164000111009",
    published: true,
    intake_offset_days: 120,
  },
  {
    name: "Vráceno — zpět do útulku",
    species: "dog",
    breed: "Jack Russell teriér",
    age_years: 1,
    sex: "male",
    size: "small",
    color: "Bílá s černými skvrnami",
    photo: PHOTO.dog,
    description: "Stav VRÁCENO (výstup): adopce nevyšla, zvíře je zpět.",
    adoption_status: "returned",
    legal_status: "shelter_owned",
    supervision_status: "released",
    intake_type: "surrender",
    chip_number: "203164000111010",
    intake_offset_days: 150,
  },
  {
    name: "Převedeno — jinému subjektu",
    species: "dog",
    breed: "Husky",
    age_years: 5,
    sex: "female",
    size: "large",
    color: "Šedo-bílá",
    photo: PHOTO.dog3,
    description:
      "Stav PŘEVEDENO (výstup): trvale předáno jiné organizaci, vlastnictví pryč.",
    adoption_status: "transferred",
    legal_status: "transferred_out",
    supervision_status: "released",
    intake_type: "transfer",
    chip_number: "203164000111011",
    intake_offset_days: 200,
  },
  {
    name: "Úhyn",
    species: "cat",
    breed: "Evropská",
    age_years: 12,
    sex: "male",
    size: "medium",
    color: "Mourovatý",
    photo: PHOTO.cat,
    description: "Stav ÚHYN (výstup): zvíře zemřelo / bylo utraceno.",
    adoption_status: "deceased",
    legal_status: "shelter_owned",
    supervision_status: "released",
    intake_type: "surrender",
    chip_number: "203164000111012",
    intake_offset_days: 220,
  },

  // ── Ochranná lhůta — TVRDĚ ODDĚLENÉ od adopce (zůstává „intake") ──────────
  {
    name: "Nalezenec — v ochranné lhůtě (v katalogu)",
    species: "dog",
    breed: "Kříženec",
    sex: "male",
    size: "medium",
    color: "Černo-bílá",
    photo: PHOTO.dog2,
    description:
      "NÁLEZENEC v ochranné lhůtě, zveřejněn v katalogu nalezenců. Adopce zamčená.",
    adoption_status: "intake",
    legal_status: "in_protection",
    supervision_status: "quarantine",
    intake_type: "found",
    found_location: "Praha 10, Hostivař — u rybníka",
    found_date: daysAgo(20),
    announced_at: daysAgo(19),
    found_listing_published: true,
    identification_none: true,
    intake_offset_days: 20,
  },
  {
    name: "Nalezenec — v ochranné lhůtě (nezveřejněn)",
    species: "cat",
    breed: "Evropská",
    sex: "female",
    size: "small",
    color: "Zrzavá",
    photo: PHOTO.cat2,
    description:
      "NÁLEZENEC v ochranné lhůtě, zatím NEzveřejněn v katalogu. Adopce zamčená.",
    adoption_status: "intake",
    legal_status: "in_protection",
    supervision_status: "quarantine",
    intake_type: "found",
    found_location: "Praha 4, Krč",
    found_date: daysAgo(8),
    announced_at: daysAgo(7),
    found_listing_published: false,
    identification_none: true,
    intake_offset_days: 8,
  },
  {
    name: "Odebrané — v ochranné lhůtě (izolace)",
    species: "dog",
    breed: "Kříženec ovčáka",
    age_years: 3,
    sex: "female",
    size: "medium",
    color: "Černá",
    photo: PHOTO.dog,
    description:
      "ODEBRANÉ zvíře v ochranné lhůtě, v IZOLACI. Adopce i převod zamčené.",
    adoption_status: "intake",
    legal_status: "in_protection",
    supervision_status: "isolation",
    intake_type: "confiscation",
    is_urgent: true,
    found_listing_published: false,
    identification_none: true,
    intake_offset_days: 5,
  },
  {
    name: "Majitel se přihlásil — vráceno",
    species: "dog",
    breed: "Zlatý retrívr",
    age_years: 4,
    sex: "male",
    size: "large",
    color: "Zlatá",
    photo: PHOTO.dog3,
    description:
      "Původní majitel se přihlásil (owner_claimed) → životní cyklus VRÁCENO.",
    adoption_status: "returned",
    legal_status: "owner_claimed",
    supervision_status: "released",
    intake_type: "found",
    found_location: "Praha 6, Dejvice",
    found_date: daysAgo(35),
    announced_at: daysAgo(34),
    original_owner: "Jan Novák",
    chip_number: "203164000111013",
    intake_offset_days: 35,
  },

  // ── Dohled bez ochranné lhůty (karanténa u vlastního zvířete) ────────────
  {
    name: "Karanténa — vstupní (vlastní)",
    species: "cat",
    breed: "Evropská",
    age_years: 1,
    sex: "male",
    size: "small",
    color: "Černá",
    photo: PHOTO.cat,
    description:
      "Vstupní KARANTÉNA (shelter_owned). Na web se pustí až po uzavření.",
    adoption_status: "intake",
    legal_status: "shelter_owned",
    supervision_status: "quarantine",
    intake_type: "surrender",
    chip_number: "203164000111014",
    intake_offset_days: 3,
  },
];

async function main() {
  const wipe = process.argv.includes("--wipe");
  const url = process.env.POSTGRES_URL_NON_POOLING;
  if (!url) {
    console.error("POSTGRES_URL_NON_POOLING is not set");
    process.exit(1);
  }
  const client = new Client({
    connectionString: url.replace(/[?&]sslmode=[^&]*/g, ""),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  if (wipe) {
    const del = await client.query(
      `delete from animals where institution_id = $1 and name like '[T] %'`,
      [INSTITUTION_ID],
    );
    console.log(`→ Smazáno ${del.rowCount} předchozích [T] zvířat`);
  }

  // Konec ochranné lhůty z nastavení útulku.
  const instRes = await client.query(
    `select protection_period_months from institutions where id = $1`,
    [INSTITUTION_ID],
  );
  const months = instRes.rows[0]?.protection_period_months ?? 4;

  console.log("→ Přidávám testovací zvířata");
  for (const s of SEEDS) {
    const intakeDate = daysAgo(s.intake_offset_days);
    const protectionUntil =
      s.legal_status === "in_protection"
        ? addMonths(s.announced_at ?? s.found_date ?? intakeDate, months)
        : null;
    const cols = [
      "institution_id", "name", "species", "breed", "age_years", "age_months",
      "sex", "size", "color", "energy_level", "personality_tags",
      "is_neutered", "is_vaccinated", "is_chipped", "chip_number",
      "identification_none", "health_status", "description", "primary_photo_url",
      "intake_date", "intake_type", "legal_status", "supervision_status",
      "adoption_status", "is_urgent", "long_stay_boost",
      "found_location", "found_date", "announced_at", "protection_until",
      "found_listing_published", "original_owner", "auto_publish", "published_at",
    ];
    const vals = [
      INSTITUTION_ID,
      `[T] ${s.name}`,
      s.species,
      s.breed,
      s.age_years ?? null,
      s.age_months ?? null,
      s.sex,
      s.size ?? null,
      s.color ?? null,
      "medium",
      [],
      null,
      true,
      s.chip_number ? true : s.identification_none ? false : null,
      s.chip_number ?? null,
      s.identification_none ?? false,
      "healthy",
      s.description,
      s.photo,
      intakeDate,
      s.intake_type ?? null,
      s.legal_status,
      s.supervision_status,
      s.adoption_status,
      s.is_urgent ?? false,
      s.long_stay_boost ?? false,
      s.found_location ?? null,
      s.found_date ?? null,
      s.announced_at ?? null,
      protectionUntil,
      s.found_listing_published ?? false,
      s.original_owner ?? null,
      s.auto_publish ?? false,
      s.published ? new Date().toISOString() : null,
    ];
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    await client.query(
      `insert into animals (${cols.join(", ")}) values (${placeholders})`,
      vals,
    );
    console.log(`  ✓ [T] ${s.name} — ${s.adoption_status} / ${s.legal_status}`);
  }

  const summary = await client.query(
    `select adoption_status, legal_status, supervision_status, count(*)
     from animals where institution_id = $1 and name like '[T] %'
     group by adoption_status, legal_status, supervision_status
     order by adoption_status`,
    [INSTITUTION_ID],
  );
  console.table(summary.rows);
  console.log(`\n✓ Hotovo: ${SEEDS.length} testovacích zvířat v Útulku Hostivař`);

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
