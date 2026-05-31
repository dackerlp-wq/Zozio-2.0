import Image from "next/image";
import Link from "next/link";
import {
  MapPin,
  CalendarClock,
  Search,
  ScanLine,
  Phone,
  Mail,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { SPECIES_LABEL } from "@/lib/format";
import { animalAgeLabel } from "@/lib/animal-age";
import type { Species } from "@/types/database";

export const metadata = {
  title: "Hledají svého páníčka — nalezená zvířata · Zozio",
  description:
    "Zvířata, která útulky nedávno našly a kterým běží zákonná ochranná lhůta. Poznáváte své zvíře? Vyhledejte podle čísla čipu nebo se ozvěte útulku.",
};

interface FoundInstitution {
  name: string;
  city: string | null;
  slug: string;
  phone: string | null;
  email: string | null;
}

interface FoundRow {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  age_years: number | null;
  age_months: number | null;
  birth_date: string | null;
  primary_photo_url: string | null;
  chip_number: string | null;
  found_listing_published: boolean;
  found_location: string | null;
  found_date: string | null;
  protection_until: string | null;
  institution: FoundInstitution | null;
}

interface PageProps {
  searchParams: Promise<{ chip?: string; misto?: string }>;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Sjednotí číslo čipu pro porovnání — jen písmena a číslice, malá písmena. */
function normalizeChip(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/** Sjednotí text pro porovnání — bez diakritiky, malá písmena. */
function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Externí registry čipů, kam pokračovat, když u nás nic není. */
const CHIP_REGISTRIES: { name: string; url: string; note: string }[] = [
  {
    name: "PETMAXX",
    url: "https://www.petmaxx.com/",
    note: "Celosvětový vyhledávač — prohledá víc registrů naráz",
  },
  {
    name: "EuroPetNet",
    url: "https://www.europetnet.com/",
    note: "Evropská síť registrů čipů",
  },
  {
    name: "Národní registr majitelů zvířat",
    url: "https://www.narodniregistr.cz/vyhledej-cip",
    note: "Vyhledání podle čísla čipu",
  },
  {
    name: "Evidence psů ČR",
    url: "https://www.evidencepsu.cz/hledat-v-evidenci/",
    note: "Hledání podle čipu i tetování",
  },
  {
    name: "Státní veterinární správa",
    url: "https://www.svscr.cz/zdravi-zvirat/registry-psu/",
    note: "Oficiální rozcestník registrů psů",
  },
];

function ChipRegistries() {
  return (
    <div className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
      <h2 className="font-display text-lg font-bold text-ink-900">
        Nenašli jste zvíře u nás? Zkuste celostátní registry čipů
      </h2>
      <p className="mt-1 text-sm text-ink-600">
        Ne každé nalezené zvíře je u nás zveřejněné a čip nemusí být registrovaný
        ve všech databázích. Vyhledání podle čísla čipu nabízejí i tyto registry:
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {CHIP_REGISTRIES.map((r) => (
          <li key={r.url}>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 rounded-2xl bg-cream-warm px-4 py-3 ring-1 ring-ink-900/8 transition hover:ring-meadow-300/60"
            >
              <ExternalLink className="mt-0.5 size-4 shrink-0 text-meadow-600" />
              <span>
                <span className="block text-sm font-semibold text-ink-900">
                  {r.name}
                </span>
                <span className="block text-xs text-ink-500">{r.note}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SELECT = `id, name, species, breed, age_years, age_months, birth_date,
  primary_photo_url, chip_number, found_listing_published,
  found_location, found_date, protection_until,
  institution:institutions!inner(name, city, slug, phone, email, is_published)`;

export default async function FoundAnimalsPage({ searchParams }: PageProps) {
  const { chip = "", misto = "" } = await searchParams;
  const chipQuery = normalizeChip(chip);
  const placeQuery = normalizeText(misto);
  const isSearching = chipQuery.length > 0;
  const hasPlace = placeQuery.length > 0;

  const supabase = await createClient();

  // Základní dotaz: nalezená/odebraná zvířata v ochranné lhůtě u zveřejněných
  // institucí. Bez vyhledávání čipem zobrazujeme jen ta zveřejněná v katalogu;
  // při hledání podle čipu prohledáváme i nezveřejněná (sjednocení majitele je
  // hlavní smysl ochranné lhůty), ale o nich prozradíme jen nezbytné minimum.
  let query = supabase
    .from("animals")
    .select(SELECT)
    .eq("legal_status", "in_protection")
    .in("intake_type", ["found", "confiscation"])
    .eq("institutions.is_published", true)
    .order("found_date", { ascending: false, nullsFirst: false })
    .limit(200);

  if (!isSearching) query = query.eq("found_listing_published", true);

  const { data } = await query;
  const all = (data ?? []) as unknown as FoundRow[];

  // Vyhledávání podle čipu: porovnáváme normalizovaně (ignoruje mezery apod.).
  // Filtr místa nálezu se uplatní navrch (porovnává místo nálezu i město útulku).
  const results = (isSearching
    ? all.filter(
        (a) => a.chip_number && normalizeChip(a.chip_number) === chipQuery,
      )
    : all
  ).filter((a) => {
    if (!hasPlace) return true;
    return (
      normalizeText(a.found_location ?? "").includes(placeQuery) ||
      normalizeText(a.institution?.city ?? "").includes(placeQuery)
    );
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="max-w-2xl">
        <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
          Nalezená zvířata
        </div>
        <h1 className="mt-2 font-display text-4xl font-bold leading-tight text-ink-900 sm:text-5xl">
          Hledají svého páníčka
        </h1>
        <p className="mt-4 text-ink-700">
          Tato zvířata útulky nedávno našly a běží jim zákonná ochranná lhůta,
          během které se může přihlásit původní majitel.{" "}
          <strong>Nejsou nabízena k adopci</strong> — pokud v některém poznáváte
          své ztracené zvíře, co nejdřív kontaktujte příslušný útulek.
        </p>
      </header>

      {/* Vyhledávání podle čísla čipu */}
      <form
        action="/nalezenci"
        method="get"
        className="mt-8 rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8"
      >
        <label
          htmlFor="chip"
          className="flex items-center gap-2 text-sm font-semibold text-ink-900"
        >
          <ScanLine className="size-4 text-meadow-600" />
          Hledáte ztracené zvíře? Zadejte číslo jeho čipu
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id="chip"
            name="chip"
            type="search"
            inputMode="numeric"
            defaultValue={chip}
            placeholder="např. 203098100123456"
            className="w-full rounded-xl bg-cream-warm px-4 py-2.5 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300"
          />
          <button
            type="submit"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-pill bg-meadow-500 px-6 py-2.5 text-sm font-semibold text-cream hover:bg-meadow-600"
          >
            <Search className="size-4" /> Vyhledat
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          Číslo čipu najdete v očkovacím průkazu nebo v registru čipů. Hledáme
          i mezi nalezenými zvířaty, která zatím nejsou v katalogu zveřejněná.
        </p>

        <label
          htmlFor="misto"
          className="mt-5 flex items-center gap-2 text-sm font-semibold text-ink-900"
        >
          <MapPin className="size-4 text-meadow-600" />
          Nebo hledejte podle místa nálezu
        </label>
        <input
          id="misto"
          name="misto"
          type="search"
          defaultValue={misto}
          placeholder="např. Brno nebo Komenského ulice"
          className="mt-3 w-full rounded-xl bg-cream-warm px-4 py-2.5 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300"
        />
        <p className="mt-2 text-xs text-ink-500">
          Prohledáme místo nálezu i město útulku. Můžete vyplnit jen místo, jen
          čip, nebo obojí.
        </p>
        {(isSearching || hasPlace) && (
          <p className="mt-2 text-sm text-ink-700">
            {results.length > 0 ? (
              <>
                Nalezeno {results.length}{" "}
                {isSearching && hasPlace ? (
                  <>
                    pro čip <strong>{chip}</strong> v místě{" "}
                    <strong>{misto}</strong>.
                  </>
                ) : isSearching ? (
                  <>
                    pro čip <strong>{chip}</strong>.
                  </>
                ) : (
                  <>
                    pro místo <strong>{misto}</strong>.
                  </>
                )}
              </>
            ) : (
              <>
                {isSearching ? (
                  <>
                    Žádné nalezené zvíře s čipem <strong>{chip}</strong>
                  </>
                ) : (
                  <>
                    Žádné nalezené zvíře v místě <strong>{misto}</strong>
                  </>
                )}{" "}
                neevidujeme. I tak doporučujeme obrátit se na útulky ve vašem
                okolí.
              </>
            )}{" "}
            <Link
              href="/nalezenci"
              className="font-semibold text-meadow-700 hover:text-meadow-600"
            >
              Zobrazit všechna
            </Link>
          </p>
        )}
      </form>

      {results.length === 0 ? (
        <div className="mt-12 space-y-6">
          <div className="rounded-3xl bg-cream p-10 text-center ring-1 ring-ink-900/8">
            <div className="text-4xl">🐾</div>
            <h2 className="mt-3 font-display text-xl font-bold text-ink-900">
              {isSearching || hasPlace
                ? "Nic jsme nenašli"
                : "Právě teď tu žádné nalezené zvíře není"}
            </h2>
            <p className="mt-2 text-ink-600">
              {isSearching || hasPlace
                ? "Zkuste prosím kontaktovat útulky ve svém okolí přímo nebo prohledat celostátní registry čipů níže."
                : "To je dobrá zpráva — žádnému zvířeti zrovna neběží ochranná lhůta."}
            </p>
          </div>
          <ChipRegistries />
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((a) =>
            // Shoda na nezveřejněné zvíře → jen minimum + kontakt na útulek.
            isSearching && !a.found_listing_published ? (
              <ChipMatchCard key={a.id} animal={a} />
            ) : (
              <FoundCard key={a.id} animal={a} />
            ),
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-10">
          <ChipRegistries />
        </div>
      )}
    </div>
  );
}

/** Veřejná karta zveřejněného nalezence — odkazuje na detail. */
function FoundCard({ animal: a }: { animal: FoundRow }) {
  const until = fmtDate(a.protection_until);
  const found = fmtDate(a.found_date);
  return (
    <Link
      href={`/nalezenci/${a.id}`}
      className="group relative block overflow-hidden rounded-2xl bg-card shadow-soft-sm ring-1 ring-ink-900/5 transition-shadow hover:shadow-soft-lg hover:ring-meadow-300/60"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-cream-warm">
        {a.primary_photo_url ? (
          <Image
            src={a.primary_photo_url}
            alt={a.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-5xl">
            🐾
          </div>
        )}
        <div className="absolute left-3 top-3">
          <span className="rounded-pill bg-sunshine-200 px-3 py-1 text-xs font-semibold text-sunshine-600">
            V ochranné lhůtě
          </span>
        </div>
      </div>

      <div className="space-y-3 p-5">
        <div className="space-y-1">
          <h3 className="font-display text-2xl font-semibold leading-tight text-ink-900">
            {a.name}
          </h3>
          <p className="text-sm text-ink-600">
            {a.breed || SPECIES_LABEL[a.species] || "Zvíře"} · {animalAgeLabel(a)}
          </p>
        </div>

        <dl className="space-y-1.5 text-sm text-ink-700">
          {a.found_location && (
            <div className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" />
              <span>
                Nalezeno: {a.found_location}
                {found ? ` (${found})` : ""}
              </span>
            </div>
          )}
          {until && (
            <div className="flex items-start gap-1.5">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-ink-400" />
              <span>Lhůta do {until}</span>
            </div>
          )}
        </dl>

        {a.institution?.name && (
          <p className="truncate text-xs text-ink-400">
            {a.institution.name}
            {a.institution.city ? ` · ${a.institution.city}` : ""}
          </p>
        )}
      </div>
    </Link>
  );
}

/**
 * Karta pro shodu čipu u nezveřejněného nalezence. Neprozrazuje jméno, foto
 * ani plný profil (ten zůstává gated) — jen že útulek takové zvíře eviduje,
 * základní druh/lokalitu a kontakt, aby se majitel mohl ozvat.
 */
function ChipMatchCard({ animal: a }: { animal: FoundRow }) {
  const until = fmtDate(a.protection_until);
  const found = fmtDate(a.found_date);
  const inst = a.institution;
  return (
    <div className="rounded-2xl bg-sage-50 p-5 ring-1 ring-inset ring-meadow-300/60">
      <div className="flex items-center gap-2 text-meadow-700">
        <CheckCircle2 className="size-5 shrink-0" />
        <span className="font-display text-lg font-bold">Shoda čipu</span>
      </div>
      <p className="mt-2 text-sm text-ink-700">
        Útulek eviduje nalezené zvíře ({SPECIES_LABEL[a.species] ?? "zvíře"}) s
        tímto číslem čipu. Pro ověření a předání kontaktujte útulek.
      </p>

      <dl className="mt-3 space-y-1.5 text-sm text-ink-700">
        {a.found_location && (
          <div className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" />
            <span>
              Nalezeno: {a.found_location}
              {found ? ` (${found})` : ""}
            </span>
          </div>
        )}
        {until && (
          <div className="flex items-start gap-1.5">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-ink-400" />
            <span>Lhůta do {until}</span>
          </div>
        )}
      </dl>

      {inst && (
        <div className="mt-4 border-t border-ink-900/10 pt-3">
          <Link
            href={`/utulek/${inst.slug}`}
            className="font-semibold text-meadow-700 hover:text-meadow-600"
          >
            {inst.name}
            {inst.city ? ` · ${inst.city}` : ""}
          </Link>
          <div className="mt-1.5 flex flex-wrap gap-3 text-sm">
            {inst.phone && (
              <a
                href={`tel:${inst.phone}`}
                className="inline-flex items-center gap-1.5 text-ink-700 hover:text-meadow-700"
              >
                <Phone className="size-4" /> {inst.phone}
              </a>
            )}
            {inst.email && (
              <a
                href={`mailto:${inst.email}`}
                className="inline-flex items-center gap-1.5 text-ink-700 hover:text-meadow-700"
              >
                <Mail className="size-4" /> {inst.email}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
