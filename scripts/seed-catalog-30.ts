/**
 * Naseje 30 různorodých zvířat (pes/kočka/králík) do publikovaného útulku,
 * aby měl katalog /adopt a AI matching pestrý vzorek. Spustí se přes service
 * klienta (obchází RLS). Idempotentní: maže předchozí běh dle značky v notes.
 *
 *   npx tsx -r dotenv/config scripts/seed-catalog-30.ts dotenv_config_path=.env.local
 */
import { createServiceClient } from "@/lib/supabase/service";

type Compat = "yes" | "no" | "unknown";
type Energy = "low" | "medium" | "high";
type Size = "small" | "medium" | "large" | "xlarge";
type Housing = "apartment" | "house" | "both" | null;

const TAG = "seed-catalog-30";

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const DOG = "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600&q=80";
const DOG2 = "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=600&q=80";
const CAT = "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&q=80";
const CAT2 = "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=600&q=80";
const RAB = "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=600&q=80";

interface Spec {
  name: string;
  species: "dog" | "cat" | "rabbit";
  sex: "male" | "female";
  size?: Size;
  breed?: string;
  cross?: boolean;
  ageDays: number; // stáří přes birth_date
  energy?: Energy;
  kids?: Compat;
  dogs?: Compat;
  cats?: Compat;
  garden?: boolean | null;
  housing?: Housing;
  exp?: "beginner_ok" | "experienced_only";
  care?: "easy" | "medium" | "high" | null;
  health?: "healthy" | "treated" | "special_needs";
  tags?: string[];
  photo?: string | null;
  urgent?: boolean;
  longStay?: boolean;
}

// 30 zvířat — od plně vyplněných po řídké profily (kvůli matchingu).
const SPECS: Spec[] = [
  { name: "Argo", species: "dog", sex: "male", size: "large", breed: "Německý ovčák", ageDays: 1200, energy: "high", kids: "yes", dogs: "yes", cats: "no", garden: true, housing: "house", exp: "experienced_only", care: "medium", health: "healthy", tags: ["aktivní", "učenlivý"], photo: DOG },
  { name: "Lupa", species: "dog", sex: "female", size: "small", breed: "Jack Russell", ageDays: 700, energy: "high", kids: "yes", dogs: "yes", cats: "unknown", garden: false, housing: "both", exp: "beginner_ok", care: "easy", health: "healthy", tags: ["hravá", "mazlivá"], photo: DOG2 },
  { name: "Bruno", species: "dog", sex: "male", size: "xlarge", breed: "Bernardýn", ageDays: 2200, energy: "low", kids: "yes", dogs: "yes", cats: "yes", garden: true, housing: "house", exp: "beginner_ok", care: "medium", health: "treated", tags: ["klidný", "dobrák"], photo: DOG },
  { name: "Cira", species: "dog", sex: "female", size: "medium", breed: "Border kolie", cross: false, ageDays: 900, energy: "high", kids: "yes", dogs: "yes", cats: "no", garden: true, housing: "house", exp: "experienced_only", care: "high", health: "healthy", tags: ["chytrá", "pracovitá"], photo: DOG2 },
  { name: "Dasty", species: "dog", sex: "male", size: "medium", breed: "Kříženec", cross: true, ageDays: 1600, energy: "medium", kids: "unknown", dogs: "yes", cats: "unknown", garden: null, housing: "both", exp: "beginner_ok", care: "easy", health: "healthy", tags: ["přátelský"], photo: null, longStay: true },
  { name: "Ema", species: "dog", sex: "female", size: "small", breed: "Čivava", ageDays: 1100, energy: "low", kids: "no", dogs: "no", cats: "yes", garden: false, housing: "apartment", exp: "beginner_ok", care: "easy", health: "healthy", tags: ["klidná", "do bytu"], photo: DOG },
  { name: "Fody", species: "dog", sex: "male", size: "large", breed: "Labrador", ageDays: 500, energy: "high", kids: "yes", dogs: "yes", cats: "yes", garden: true, housing: "both", exp: "beginner_ok", care: "easy", health: "healthy", tags: ["veselý", "mazlivý"], photo: DOG2, urgent: false },
  { name: "Gita", species: "dog", sex: "female", size: "medium", breed: "Stafordšírský teriér", ageDays: 1400, energy: "medium", kids: "no", dogs: "no", cats: "no", garden: true, housing: "house", exp: "experienced_only", care: "high", health: "treated", tags: ["silná vazba"], photo: DOG, urgent: true },
  { name: "Hektor", species: "dog", sex: "male", size: "large", breed: "Rotvajler", ageDays: 1900, energy: "medium", kids: "unknown", dogs: "no", cats: "unknown", garden: true, housing: "house", exp: "experienced_only", care: "medium", health: "healthy", tags: ["hlídač"], photo: null, longStay: true },
  { name: "Ina", species: "dog", sex: "female", size: "small", breed: "Pudl", ageDays: 2600, energy: "low", kids: "yes", dogs: "yes", cats: "yes", garden: false, housing: "apartment", exp: "beginner_ok", care: "medium", health: "special_needs", tags: ["senior", "klidná"], photo: DOG2 },
  { name: "Jago", species: "dog", sex: "male", size: "medium", breed: "Kříženec", cross: true, ageDays: 300, energy: "high", kids: "yes", dogs: "yes", cats: "unknown", garden: null, housing: "both", exp: "beginner_ok", care: "easy", health: "healthy", tags: ["štěně", "hravý"], photo: DOG },
  { name: "Kaira", species: "dog", sex: "female", size: "large", breed: "Husky", ageDays: 1000, energy: "high", kids: "yes", dogs: "yes", cats: "no", garden: true, housing: "house", exp: "experienced_only", care: "high", health: "healthy", tags: ["energická", "vytrvalá"], photo: null },
  { name: "Mína", species: "cat", sex: "female", size: "small", breed: "Domácí", ageDays: 800, energy: "low", kids: "yes", dogs: "unknown", cats: "yes", garden: null, housing: "apartment", exp: "beginner_ok", care: "easy", health: "healthy", tags: ["mazlivá", "klidná"], photo: CAT },
  { name: "Tom", species: "cat", sex: "male", size: "medium", breed: "Mourovatý", ageDays: 1500, energy: "medium", kids: "unknown", dogs: "no", cats: "yes", garden: null, housing: "both", exp: "beginner_ok", care: "easy", health: "healthy", tags: ["lovec"], photo: CAT2 },
  { name: "Líza", species: "cat", sex: "female", size: "small", breed: "Britská", ageDays: 600, energy: "low", kids: "yes", dogs: "unknown", cats: "no", garden: null, housing: "apartment", exp: "beginner_ok", care: "easy", health: "healthy", tags: ["plachá", "tichá"], photo: CAT },
  { name: "Oskar", species: "cat", sex: "male", size: "medium", breed: "Domácí", ageDays: 2400, energy: "low", kids: "yes", dogs: "yes", cats: "yes", garden: null, housing: "both", exp: "beginner_ok", care: "medium", health: "treated", tags: ["senior", "pohodář"], photo: CAT2, longStay: true },
  { name: "Pája", species: "cat", sex: "female", size: "small", breed: "Zrzavá", ageDays: 200, energy: "high", kids: "unknown", dogs: "unknown", cats: "unknown", garden: null, housing: null, exp: "beginner_ok", care: "easy", health: "healthy", tags: ["koťě"], photo: null },
  { name: "Rusty", species: "cat", sex: "male", size: "medium", breed: "Mainská mývalí", ageDays: 1300, energy: "medium", kids: "yes", dogs: "yes", cats: "yes", garden: null, housing: "house", exp: "beginner_ok", care: "medium", health: "healthy", tags: ["velký", "společenský"], photo: CAT },
  { name: "Sisi", species: "cat", sex: "female", size: "small", breed: "Siamská", ageDays: 1700, energy: "high", kids: "no", dogs: "no", cats: "no", garden: null, housing: "apartment", exp: "experienced_only", care: "medium", health: "special_needs", tags: ["náročná", "upovídaná"], photo: CAT2, urgent: true },
  { name: "Uli", species: "cat", sex: "male", size: "small", breed: "Domácí", ageDays: 400, energy: "medium", kids: "yes", dogs: "unknown", cats: "yes", garden: null, housing: "both", exp: "beginner_ok", care: "easy", health: "healthy", tags: ["hravý"], photo: null },
  { name: "Vendy", species: "cat", sex: "female", size: "medium", breed: "Černá", ageDays: 1100, energy: "low", kids: "yes", dogs: "no", cats: "yes", garden: null, housing: "apartment", exp: "beginner_ok", care: "easy", health: "healthy", tags: ["mazlivá"], photo: CAT },
  { name: "Žiž", species: "cat", sex: "male", size: "medium", breed: "Bílý", ageDays: 2000, energy: "low", kids: "unknown", dogs: "unknown", cats: "unknown", garden: null, housing: null, exp: "beginner_ok", care: null, health: "healthy", tags: [], photo: null, longStay: true },
  { name: "Ušák", species: "rabbit", sex: "male", size: "small", breed: "Zakrslý", ageDays: 500, energy: "medium", kids: "yes", dogs: "no", cats: "no", garden: false, housing: "apartment", exp: "beginner_ok", care: "medium", health: "healthy", tags: ["zvědavý"], photo: RAB },
  { name: "Bělka", species: "rabbit", sex: "female", size: "small", breed: "Beran", ageDays: 900, energy: "low", kids: "yes", dogs: "unknown", cats: "unknown", garden: null, housing: "both", exp: "beginner_ok", care: "easy", health: "healthy", tags: ["klidná"], photo: null },
  { name: "Mrkva", species: "rabbit", sex: "male", size: "small", breed: "Domácí", ageDays: 300, energy: "high", kids: "yes", dogs: "no", cats: "no", garden: true, housing: "house", exp: "beginner_ok", care: "easy", health: "healthy", tags: ["aktivní"], photo: RAB },
  { name: "Cibulka", species: "rabbit", sex: "female", size: "small", breed: "Zakrslý", ageDays: 1400, energy: "low", kids: "unknown", dogs: "unknown", cats: "unknown", garden: null, housing: null, exp: "beginner_ok", care: null, health: "special_needs", tags: [], photo: null, urgent: true },
  { name: "Nelinka", species: "dog", sex: "female", size: "medium", breed: "Bígl", ageDays: 1250, energy: "high", kids: "yes", dogs: "yes", cats: "no", garden: true, housing: "both", exp: "beginner_ok", care: "medium", health: "healthy", tags: ["čmuchal", "veselá"], photo: DOG2 },
  { name: "Otto", species: "dog", sex: "male", size: "large", breed: "Dobrman", ageDays: 1800, energy: "high", kids: "no", dogs: "unknown", cats: "no", garden: true, housing: "house", exp: "experienced_only", care: "high", health: "healthy", tags: ["ostražitý"], photo: null, longStay: true },
  { name: "Pixie", species: "cat", sex: "female", size: "small", breed: "Kalico", ageDays: 350, energy: "high", kids: "yes", dogs: "yes", cats: "yes", garden: null, housing: "both", exp: "beginner_ok", care: "easy", health: "healthy", tags: ["koťě", "hravá"], photo: CAT2 },
  { name: "Quido", species: "dog", sex: "male", size: "small", breed: "Jezevčík", ageDays: 2100, energy: "medium", kids: "yes", dogs: "yes", cats: "yes", garden: false, housing: "apartment", exp: "beginner_ok", care: "easy", health: "treated", tags: ["mazlík"], photo: DOG },
];

(async () => {
  const s = createServiceClient();
  const { data: inst } = await s
    .from("institutions")
    .select("id")
    .eq("slug", "utulek-hostivar")
    .maybeSingle();
  if (!inst) {
    console.error("Útulek utulek-hostivar nenalezen.");
    process.exit(1);
  }
  const institutionId = (inst as { id: string }).id;

  // Smaž případný předchozí běh (dle značky v intake_notes).
  await s.from("animals").delete().eq("institution_id", institutionId).eq("intake_notes", TAG);

  const rows = SPECS.map((a, i) => ({
    institution_id: institutionId,
    name: a.name,
    species: a.species,
    sex: a.sex,
    size: a.size ?? null,
    breed: a.breed ?? null,
    is_crossbreed: a.cross ?? false,
    birth_date: daysAgo(a.ageDays),
    energy_level: a.energy ?? null,
    good_with_children: a.kids ?? "unknown",
    good_with_dogs: a.dogs ?? "unknown",
    good_with_cats: a.cats ?? "unknown",
    needs_garden: a.garden ?? null,
    suitable_housing: a.housing ?? null,
    adopter_experience: a.exp ?? "beginner_ok",
    care_difficulty: a.care ?? null,
    health_status: a.health ?? "healthy",
    personality_tags: a.tags ?? [],
    primary_photo_url: a.photo ?? null,
    is_vaccinated: true,
    is_neutered: i % 3 !== 0,
    is_urgent: a.urgent ?? false,
    long_stay_boost: a.longStay ?? false,
    adoption_status: "available",
    legal_status: "shelter_owned",
    supervision_status: "released",
    intake_type: "found",
    intake_date: daysAgo(a.ageDays > 400 ? 90 : 20),
    intake_notes: TAG,
    description: `${a.name} hledá nový domov.`,
  }));

  const { error, count } = await s.from("animals").insert(rows, { count: "exact" });
  if (error) {
    console.error("INSERT ERROR:", error.message);
    process.exit(1);
  }
  console.log(`✓ Vloženo ${count ?? rows.length} zvířat do útulku Hostivař.`);
})();
