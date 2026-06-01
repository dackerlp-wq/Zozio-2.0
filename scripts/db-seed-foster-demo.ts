/**
 * Demo seed pro PÁROVÁNÍ PĚSTOUNŮ.
 *
 * Přidá jedno plně vyplněné zvíře (velký pes, vyžaduje léky + pooperační péči,
 * potřebuje zahradu, nesnáší děti ani jiná zvířata) a několik pěstounů s
 * různou shodou — od 100 % po blokující „Nevhodný".
 *
 *   npx dotenvx run -f .env.local -- npx tsx scripts/db-seed-foster-demo.ts
 *   npx dotenvx run -f .env.local -- npx tsx scripts/db-seed-foster-demo.ts --wipe
 *
 * Prefix „[FT] " u zvířete i pěstounů pro snadné dohledání / smazání.
 */
import { Client } from "pg";

const INSTITUTION_ID = "a260ceae-369e-4d9f-9c15-57faa95e3efe"; // Útulek Hostivař
const PHOTO = "https://images.unsplash.com/photo-1568572933382-74d440642117?w=1200&q=80";

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
function daysAhead(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

interface CarerSeed {
  name: string;
  city: string;
  phone: string;
  capacity: number;
  tags: string[];
  note: string;
}

// Požadavky zvířete (odvozené automaticky):
//   require: big_dogs(block), meds(důl.), post_op(důl.), garden(dopl.), no_children(důl.)
//   exclude: children(block), other_pets(block)
const CARERS: CarerSeed[] = [
  {
    name: "[FT] Hana Veselá — perfektní shoda",
    city: "Praha 10",
    phone: "+420 601 111 111",
    capacity: 3,
    tags: ["big_dogs", "meds", "post_op", "garden", "no_children"],
    note: "Splňuje úplně vše → ~100 %.",
  },
  {
    name: "[FT] Petr Novák — vysoká shoda",
    city: "Říčany",
    phone: "+420 602 222 222",
    capacity: 2,
    tags: ["big_dogs", "meds", "post_op", "garden"],
    note: "Chybí jen bez dětí → vysoké %.",
  },
  {
    name: "[FT] Eva Malá — střední shoda",
    city: "Kladno",
    phone: "+420 603 333 333",
    capacity: 2,
    tags: ["big_dogs"],
    note: "Jen druh sedí, péči nezvládá → střední %.",
  },
  {
    name: "[FT] Jana Kočičí — nevhodná (nebere velké psy)",
    city: "Praha 6",
    phone: "+420 604 444 444",
    capacity: 2,
    tags: ["cats", "garden", "meds"],
    note: "Blokující: nemá velké psy.",
  },
  {
    name: "[FT] Rodina Dětná — nevhodná (děti doma)",
    city: "Beroun",
    phone: "+420 605 555 555",
    capacity: 2,
    tags: ["big_dogs", "meds", "post_op", "garden", "children"],
    note: "Blokující: děti v domácnosti.",
  },
  {
    name: "[FT] Martin Zvířecí — nevhodný (jiná zvířata)",
    city: "Praha 9",
    phone: "+420 606 666 666",
    capacity: 2,
    tags: ["big_dogs", "garden", "other_pets"],
    note: "Blokující: jiná zvířata doma.",
  },
  {
    name: "[FT] Lucie Plná — plná kapacita",
    city: "Praha 5",
    phone: "+420 607 777 777",
    capacity: 0,
    tags: ["big_dogs", "meds", "post_op", "garden", "no_children"],
    note: "Ideální, ale kapacita 0 → plno.",
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
    await client.query(
      `delete from animals where institution_id = $1 and name like '[FT] %'`,
      [INSTITUTION_ID],
    );
    await client.query(
      `delete from foster_carers where institution_id = $1 and name like '[FT] %'`,
      [INSTITUTION_ID],
    );
    console.log("→ Smazána předchozí [FT] demo data");
  }

  // Pěstounská péče musí být povolená, ať se záložka zobrazí.
  await client.query(
    `update institutions set foster_enabled = true where id = $1`,
    [INSTITUTION_ID],
  );

  // 1) Plně vyplněné zvíře
  const animalCols = [
    "institution_id", "name", "species", "breed", "age_years", "sex", "size",
    "color", "energy_level", "personality_tags", "is_neutered", "is_vaccinated",
    "is_chipped", "chip_number", "health_status", "description", "primary_photo_url",
    "intake_date", "intake_type", "legal_status", "supervision_status", "adoption_status",
    "good_with_children", "good_with_dogs", "good_with_cats", "suitable_housing",
    "needs_garden", "care_difficulty", "adopter_experience", "published_at",
  ];
  const animalVals = [
    INSTITUTION_ID,
    "[FT] Rex — ukázka párování",
    "dog",
    "Německý ovčák",
    5,
    "male",
    "large",
    "Černá a pálená",
    "high",
    ["aktivní", "hlídací"],
    true,
    true,
    true,
    "203164000222001",
    "treated",
    "Velký pes po operaci kyčle, potřebuje doléčit, podávat léky a klidný režim se zahradou. Nesnáší malé děti ani jiná zvířata.",
    PHOTO,
    daysAgo(30),
    "surrender",
    "shelter_owned",
    "released",
    "available",
    "no", // good_with_children
    "no", // good_with_dogs
    "unknown", // good_with_cats
    "house", // suitable_housing
    true, // needs_garden
    "high", // care_difficulty
    "experienced_only", // adopter_experience
    new Date().toISOString(),
  ];
  const ph = animalCols.map((_, i) => `$${i + 1}`).join(", ");
  const animalRes = await client.query(
    `insert into animals (${animalCols.join(", ")}) values (${ph}) returning id`,
    animalVals,
  );
  const animalId: string = animalRes.rows[0].id;
  console.log(`→ Zvíře vytvořeno: ${animalId}`);

  // 2) Aktivní léčba → požadavek "meds"
  await client.query(
    `insert into treatments (animal_id, type, name, dosage, frequency, start_date, end_date, notes)
     values ($1, 'medication', 'Carprofen', '1 tableta', '2× denně', $2, $3, 'Analgezie po operaci kyčle')`,
    [animalId, daysAgo(10), daysAhead(20)],
  );

  // 3) Chronický stav → požadavek "post_op"
  await client.query(
    `insert into animal_conditions (animal_id, institution_id, label, is_public)
     values ($1, $2, 'Stav po operaci kyčle', false)`,
    [animalId, INSTITUTION_ID],
  );

  // 4) Pěstouni s různou shodou
  for (const c of CARERS) {
    await client.query(
      `insert into foster_carers
        (institution_id, name, phone, city, capacity, species_note, notes, is_active, tags)
       values ($1, $2, $3, $4, $5, $6, $7, true, $8)`,
      [INSTITUTION_ID, c.name, c.phone, c.city, c.capacity, "", c.note, c.tags],
    );
    console.log(`  ✓ ${c.name} [${c.tags.join(", ")}] cap=${c.capacity}`);
  }

  console.log(`\n✓ Hotovo. Otevři: /admin/animals/${animalId}/pestoun`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
