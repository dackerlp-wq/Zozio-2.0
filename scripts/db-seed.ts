/**
 * Idempotentní seed pro Zozio dev DB.
 * Vytvoří 2 testovací útulky a ~20 zvířat s reálnými Unsplash fotkami.
 *
 *   npx tsx scripts/db-seed.ts
 */
import { Client } from "pg";

const SHELTERS = [
  {
    slug: "utulek-hostivar",
    name: "Útulek Hostivař",
    description:
      "Pražský útulek pro psy a kočky. Pomáháme zvířátkům najít nový domov od roku 1998.",
    region: "Praha",
    city: "Praha",
    address: "Pod Dálnicí 467, Praha 10",
    email: "info@utulek-hostivar.cz",
    phone: "+420 274 778 256",
    website: "https://utulek-hostivar.cz",
    lat: 50.0533,
    lng: 14.5468,
    is_published: true,
    is_verified: true,
  },
  {
    slug: "psi-domov-brno",
    name: "Psí domov Brno",
    description:
      "Pomáháme opuštěným psům najít trvalý domov v Brně a okolí.",
    region: "Jihomoravský kraj",
    city: "Brno",
    address: "Vinařská 463, Brno",
    email: "info@psidomov-brno.cz",
    phone: "+420 543 245 678",
    website: "https://psidomov-brno.cz",
    lat: 49.1873,
    lng: 16.6079,
    is_published: true,
    is_verified: true,
  },
];

const ANIMALS = [
  {
    name: "Bobík",
    species: "dog",
    breed: "Kříženec retrievera",
    age_years: 3,
    sex: "male",
    size: "medium",
    color: "Zlatá",
    energy_level: "high",
    personality_tags: ["Vhodný k dětem", "Aktivní", "Společenský"],
    good_with_children: "yes",
    good_with_dogs: "yes",
    is_neutered: true,
    description:
      "Bobík je veselý kluk, který miluje dlouhé procházky a aportování. Najde si svého člověka mezi aktivními rodinami.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=1200&q=80",
    intake_date: "2024-08-15",
  },
  {
    name: "Luna",
    species: "cat",
    breed: "Britská krátkosrstá",
    age_years: 2,
    sex: "female",
    size: "small",
    color: "Modrá",
    energy_level: "low",
    personality_tags: ["Tichá", "Mazlivá", "Domácí"],
    good_with_children: "yes",
    good_with_cats: "yes",
    is_neutered: true,
    is_urgent: true,
    description:
      "Luna hledá klidný domov, kde si bude moct užívat tichá odpoledne na okně.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=1200&q=80",
    intake_date: "2024-11-02",
  },
  {
    name: "Rocky",
    species: "dog",
    breed: "Stafordšírský bulteriér",
    age_years: 6,
    sex: "male",
    size: "medium",
    color: "Tygrovaná",
    energy_level: "medium",
    personality_tags: ["Klidný", "Jen do bytu", "Zkušený majitel"],
    good_with_children: "unknown",
    good_with_dogs: "no",
    adopter_experience: "experienced_only",
    long_stay_boost: true,
    description:
      "Rocky čeká na svůj domov už přes rok. Potřebuje zkušeného majitele, ale je to skvělý parťák.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=1200&q=80",
    intake_date: "2023-10-12",
  },
  {
    name: "Miška",
    species: "cat",
    breed: "Evropská",
    age_months: 5,
    sex: "female",
    size: "small",
    color: "Černobílá",
    energy_level: "high",
    personality_tags: ["Hravá", "Zvědavá"],
    adoption_status: "reserved",
    description:
      "Miška je veselá holčička, která potřebuje hodně lásky a podnětů.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=1200&q=80",
    intake_date: "2024-12-20",
  },
  {
    name: "Charlie",
    species: "dog",
    breed: "Border kolie",
    age_years: 4,
    sex: "male",
    size: "large",
    color: "Černobílá",
    energy_level: "high",
    personality_tags: ["Inteligentní", "Aktivní", "Sportovní"],
    good_with_children: "yes",
    good_with_dogs: "yes",
    is_neutered: true,
    description:
      "Charlie je chytrý sportovec, který potřebuje rodinu, která ho zabaví. Skvělý pro agility nebo dlouhé túry.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1568572933382-74d440642117?w=1200&q=80",
    intake_date: "2024-09-08",
  },
  {
    name: "Stella",
    species: "cat",
    breed: "Mainská mývalí",
    age_years: 3,
    sex: "female",
    size: "large",
    color: "Stříbrná tabby",
    energy_level: "medium",
    personality_tags: ["Něžná", "Společenská"],
    good_with_children: "yes",
    good_with_cats: "yes",
    is_neutered: true,
    description: "Stella je nádherná dáma s velkým srdcem a hustou srstí.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1606214174585-fe31582dc6ee?w=1200&q=80",
    intake_date: "2024-10-25",
  },
  {
    name: "Max",
    species: "dog",
    breed: "Německý ovčák",
    age_years: 5,
    sex: "male",
    size: "large",
    color: "Černá a zlatá",
    energy_level: "high",
    personality_tags: ["Loajální", "Ostražitý", "Zkušený majitel"],
    good_with_dogs: "yes",
    adopter_experience: "experienced_only",
    is_neutered: true,
    description:
      "Max je oddaný parťák, který hledá svého jednoho člověka. Hodí se k aktivním lidem.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=1200&q=80",
    intake_date: "2024-07-30",
  },
  {
    name: "Bella",
    species: "dog",
    breed: "Bígl",
    age_years: 2,
    sex: "female",
    size: "small",
    color: "Tříbarevná",
    energy_level: "high",
    personality_tags: ["Hravá", "Společenská", "Vhodná k dětem"],
    good_with_children: "yes",
    good_with_dogs: "yes",
    is_neutered: true,
    description: "Bella je věčně dobře naložená slečna, která zbožňuje lidi i psy.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1505628346881-b72b27e84530?w=1200&q=80",
    intake_date: "2024-09-15",
  },
  {
    name: "Felix",
    species: "cat",
    breed: "Evropská",
    age_years: 7,
    sex: "male",
    size: "medium",
    color: "Mourovatý",
    energy_level: "low",
    personality_tags: ["Klidný", "Mazlivý"],
    is_neutered: true,
    long_stay_boost: true,
    description:
      "Felix je seniorský pán, který chce klid a teplé místo na pelech. Ideální pro starší adoptanty.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=1200&q=80",
    intake_date: "2023-12-01",
  },
  {
    name: "Riky",
    species: "dog",
    breed: "Jack Russell teriér",
    age_years: 1,
    sex: "male",
    size: "small",
    color: "Bílá s černými skvrnami",
    energy_level: "high",
    personality_tags: ["Energický", "Inteligentní"],
    good_with_children: "yes",
    is_neutered: false,
    description:
      "Riky je mladý živel plný energie. Najde svého parťáka v aktivní rodině.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1546238232-20216dec9f72?w=1200&q=80",
    intake_date: "2024-11-18",
  },
  {
    name: "Coco",
    species: "cat",
    breed: "Sphynx",
    age_years: 4,
    sex: "female",
    size: "small",
    color: "Béžová",
    energy_level: "medium",
    personality_tags: ["Společenská", "Vyžaduje péči"],
    adopter_experience: "experienced_only",
    is_neutered: true,
    description:
      "Coco je exotická kráska, která potřebuje zkušeného majitele rozumějícího jejím potřebám.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=1200&q=80",
    intake_date: "2024-08-22",
  },
  {
    name: "Tobík",
    species: "dog",
    breed: "Kříženec",
    age_years: 8,
    sex: "male",
    size: "medium",
    color: "Hnědo-bílá",
    energy_level: "low",
    personality_tags: ["Klidný", "Bezproblémový", "Senior"],
    good_with_dogs: "yes",
    is_neutered: true,
    long_stay_boost: true,
    description:
      "Tobík je senior, kterého opustila rodina. Hledá klidný domov na své poslední roky.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?w=1200&q=80",
    intake_date: "2024-02-10",
  },
  {
    name: "Daisy",
    species: "cat",
    breed: "Ragdoll",
    age_years: 2,
    sex: "female",
    size: "medium",
    color: "Krémovo-modrá",
    energy_level: "low",
    personality_tags: ["Tichá", "Mazlivá"],
    good_with_children: "yes",
    is_neutered: true,
    description: "Daisy je něžná ragdolka, která miluje lidskou společnost.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=1200&q=80",
    intake_date: "2024-12-05",
  },
  {
    name: "Hugo",
    species: "dog",
    breed: "Labrador",
    age_years: 3,
    sex: "male",
    size: "large",
    color: "Černá",
    energy_level: "high",
    personality_tags: ["Vodomil", "Aktivní", "Vhodný k dětem"],
    good_with_children: "yes",
    good_with_dogs: "yes",
    is_neutered: true,
    description:
      "Hugo je klasický labradorský klučina — milý, aktivní a zbožňuje vodu i děti.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1605568427561-40dd23c2acea?w=1200&q=80",
    intake_date: "2024-10-08",
  },
  {
    name: "Nina",
    species: "dog",
    breed: "Kříženec ovčáka",
    age_years: 4,
    sex: "female",
    size: "medium",
    color: "Černá",
    energy_level: "medium",
    personality_tags: ["Ostražitá", "Loajální"],
    good_with_dogs: "yes",
    is_neutered: true,
    is_urgent: true,
    description:
      "Nina hledá člověka, který jí dá druhou šanci. Je opatrná, ale s časem otevře srdce.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1200&q=80",
    intake_date: "2024-11-22",
  },
  {
    name: "Oscar",
    species: "cat",
    breed: "Evropská",
    age_years: 1,
    sex: "male",
    size: "small",
    color: "Černá",
    energy_level: "high",
    personality_tags: ["Hravý", "Mladý", "Společenský"],
    good_with_cats: "yes",
    is_neutered: false,
    description: "Oscar je mladý černý parťák hledající rodinu plnou her.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1494256997604-768d1f608cac?w=1200&q=80",
    intake_date: "2024-12-12",
  },
  {
    name: "Sára",
    species: "dog",
    breed: "Husky",
    age_years: 5,
    sex: "female",
    size: "large",
    color: "Šedo-bílá",
    energy_level: "high",
    personality_tags: ["Aktivní", "Nezávislá", "Zkušený majitel"],
    good_with_dogs: "yes",
    adopter_experience: "experienced_only",
    is_neutered: true,
    description:
      "Sára je krásná husky-dáma, která potřebuje hodně pohybu a zkušeného majitele.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1605897472359-85e4b94d685d?w=1200&q=80",
    intake_date: "2024-08-30",
  },
  {
    name: "Mia",
    species: "cat",
    breed: "Perská",
    age_years: 6,
    sex: "female",
    size: "small",
    color: "Bílá",
    energy_level: "low",
    personality_tags: ["Klidná", "Vyžaduje péči o srst"],
    is_neutered: true,
    description:
      "Mia je krásná perská dáma, která hledá klidný domov, kde se o ni budou starat.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1200&q=80",
    intake_date: "2024-09-25",
  },
  {
    name: "Goliáš",
    species: "dog",
    breed: "Bernardýn",
    age_years: 4,
    sex: "male",
    size: "xlarge",
    color: "Bílo-hnědá",
    energy_level: "low",
    personality_tags: ["Klidný", "Vhodný k dětem", "Obří mazel"],
    good_with_children: "yes",
    good_with_dogs: "yes",
    is_neutered: true,
    description:
      "Goliáš je obrovský chlapák s ještě větším srdcem. Potřebuje dům se zahradou.",
    primary_photo_url:
      "https://images.unsplash.com/photo-1568393691080-5e7a91c8c0e7?w=1200&q=80",
    intake_date: "2024-07-15",
  },
];

async function main() {
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

  console.log("→ Seeding institutions");
  const instIds: Record<string, string> = {};
  for (const s of SHELTERS) {
    const res = await client.query(
      `insert into institutions
        (slug, name, description, region, city, address, email, phone, website, lat, lng, is_published, is_verified)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict (slug) do update set
         name = excluded.name,
         description = excluded.description,
         region = excluded.region,
         city = excluded.city,
         address = excluded.address,
         email = excluded.email,
         phone = excluded.phone,
         website = excluded.website,
         lat = excluded.lat,
         lng = excluded.lng,
         is_published = excluded.is_published,
         is_verified = excluded.is_verified
       returning id`,
      [
        s.slug, s.name, s.description, s.region, s.city, s.address,
        s.email, s.phone, s.website, s.lat, s.lng, s.is_published, s.is_verified,
      ],
    );
    instIds[s.slug] = res.rows[0].id;
    console.log(`  ✓ ${s.name}`);
  }

  console.log("→ Wiping existing animals (dev only)");
  await client.query(`delete from animals`);

  console.log("→ Seeding animals");
  // Round-robin across shelters; first 13 to Hostivař, rest to Brno
  const slugs = ["utulek-hostivar", "psi-domov-brno"];
  for (let i = 0; i < ANIMALS.length; i++) {
    const a = ANIMALS[i];
    const instSlug = i < 13 ? slugs[0] : slugs[1];
    const cols = [
      "institution_id", "name", "species", "breed", "age_years", "age_months",
      "sex", "size", "color", "energy_level", "personality_tags",
      "good_with_children", "good_with_dogs", "good_with_cats",
      "adopter_experience", "is_neutered", "is_urgent", "long_stay_boost",
      "description", "primary_photo_url", "intake_date", "adoption_status",
      "published_at",
    ];
    const vals = [
      instIds[instSlug],
      a.name,
      a.species,
      a.breed,
      a.age_years ?? null,
      a.age_months ?? null,
      a.sex,
      a.size ?? null,
      a.color ?? null,
      a.energy_level ?? null,
      a.personality_tags ?? [],
      a.good_with_children ?? "unknown",
      a.good_with_dogs ?? "unknown",
      a.good_with_cats ?? "unknown",
      a.adopter_experience ?? "beginner_ok",
      a.is_neutered ?? null,
      a.is_urgent ?? false,
      a.long_stay_boost ?? false,
      a.description ?? null,
      a.primary_photo_url ?? null,
      a.intake_date ?? null,
      a.adoption_status ?? "available",
      new Date().toISOString(),
    ];
    const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(", ");
    await client.query(
      `insert into animals (${cols.join(", ")}) values (${placeholders})`,
      vals,
    );
    console.log(`  ✓ ${a.name} (${a.species})`);
  }

  const summary = await client.query(`
    select
      (select count(*) from institutions) as institutions,
      (select count(*) from animals) as animals,
      (select count(*) from animals where adoption_status = 'available') as available,
      (select count(*) from animals where is_urgent) as urgent,
      (select count(*) from animals where long_stay_boost) as long_stay;
  `);
  console.log("\n✓ Seed complete:", summary.rows[0]);

  await client.end();
}

main();
