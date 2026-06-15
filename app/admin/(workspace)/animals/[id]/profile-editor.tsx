"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Info, Loader2, Plus, Sparkles, Star, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { SEX_LABEL, SIZE_LABEL, SPECIES_LABEL } from "@/lib/format";
import type {
  AnimalSize,
  Compatibility,
  Sex,
  Species,
  SuitableHousing,
} from "@/types/database";

import {
  addCustomBreed,
  saveAnimalProfile,
  type AnimalProfileValues,
} from "../actions";
import { BreedField } from "../breed-field";
import { generateAnimalCopyForAnimal } from "../ai-actions";

const PRESET_TAGS = [
  "Hravá",
  "Mazlivá",
  "Klidná",
  "Aktivní",
  "Plachá",
  "Hlídací",
  "Společenská",
  "Samotář",
  "Učenlivá",
  "Nezávislá",
];

type Tri = "yes" | "no" | "unknown";

/** Lokální stav formuláře (flat tri-state pro „do bytu"). */
interface FormState {
  name: string;
  species: Species;
  sex: Sex;
  breed: string;
  is_crossbreed: boolean;
  breed_secondary: string;
  photos: string[]; // [0] = hlavní, zbytek = galerie
  date_of_birth: string;
  size: AnimalSize | "";
  color: string;
  personality_tags: string[];
  story_text: string;
  description: string;
  good_with_children: Compatibility;
  good_with_dogs: Compatibility;
  good_with_cats: Compatibility;
  good_in_flat: Tri;
  adoption_fee: number | null;
  is_handicapped: boolean;
  handicap_note: string;
}

function housingToTri(h: SuitableHousing | null): Tri {
  if (h === "apartment" || h === "both") return "yes";
  if (h === "house") return "no";
  return "unknown";
}
function triToHousing(t: Tri): SuitableHousing | null {
  if (t === "yes") return "both";
  if (t === "no") return "house";
  return null;
}

export interface ProfileInitial {
  name: string;
  species: Species;
  sex: Sex;
  breed: string;
  is_crossbreed: boolean;
  breed_secondary: string;
  primary_photo_url: string;
  gallery: string[];
  date_of_birth: string;
  age_years: number | null;
  age_months: number | null;
  size: AnimalSize | null;
  color: string;
  personality_tags: string[];
  story_text: string;
  description: string;
  good_with_children: Compatibility;
  good_with_dogs: Compatibility;
  good_with_cats: Compatibility;
  suitable_housing: SuitableHousing | null;
  adoption_fee: number | null;
  is_handicapped: boolean;
  handicap_note: string;
  /** Výchozí poplatek útulku — jen pro zobrazení nápovědy. */
  institution_fee_default: number | null;
}

export function ProfileEditor({
  animalId,
  initial,
  breedsBySpecies,
  readOnly,
  isAvailable,
}: {
  animalId: string;
  initial: ProfileInitial;
  breedsBySpecies: Record<string, string[]>;
  readOnly: boolean;
  isAvailable: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [breeds, setBreeds] = useState<Record<string, string[]>>(breedsBySpecies);

  function suggestCopy() {
    setError(null);
    setAiPending(true);
    (async () => {
      const res = await generateAnimalCopyForAnimal(animalId);
      if ("error" in res) setError(res.error);
      else
        setForm((f) => ({
          ...f,
          story_text: res.data.story_text,
          description: res.data.description,
        }));
      setAiPending(false);
    })();
  }

  const baseline = useMemo<FormState>(
    () => ({
      name: initial.name,
      species: initial.species,
      sex: initial.sex,
      breed: initial.breed,
      is_crossbreed: initial.is_crossbreed,
      breed_secondary: initial.breed_secondary,
      photos: [initial.primary_photo_url, ...initial.gallery].filter(Boolean),
      date_of_birth: initial.date_of_birth,
      size: initial.size ?? "",
      color: initial.color,
      personality_tags: initial.personality_tags,
      story_text: initial.story_text,
      description: initial.description,
      good_with_children: initial.good_with_children,
      good_with_dogs: initial.good_with_dogs,
      good_with_cats: initial.good_with_cats,
      good_in_flat: housingToTri(initial.suitable_housing),
      adoption_fee: initial.adoption_fee,
      is_handicapped: initial.is_handicapped,
      handicap_note: initial.handicap_note,
    }),
    [initial],
  );

  const [form, setForm] = useState<FormState>(baseline);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // --- Dirty tracking ---
  const dirtyFields = useMemo(() => {
    const out: string[] = [];
    const eqArr = (a: string[], b: string[]) =>
      a.length === b.length && a.every((x, i) => x === b[i]);
    if (form.name !== baseline.name) out.push("jméno");
    if (form.species !== baseline.species) out.push("druh");
    if (form.sex !== baseline.sex) out.push("pohlaví");
    if (
      form.breed !== baseline.breed ||
      form.is_crossbreed !== baseline.is_crossbreed ||
      form.breed_secondary !== baseline.breed_secondary
    )
      out.push("plemeno");
    if (!eqArr(form.photos, baseline.photos)) out.push("fotky");
    if (form.date_of_birth !== baseline.date_of_birth) out.push("narození");
    if (form.size !== baseline.size) out.push("velikost");
    if (form.color !== baseline.color) out.push("barva");
    if (!eqArr(form.personality_tags, baseline.personality_tags))
      out.push("povaha");
    if (form.story_text !== baseline.story_text) out.push("příběh");
    if (form.description !== baseline.description) out.push("krátký popis");
    if (
      form.good_with_children !== baseline.good_with_children ||
      form.good_with_dogs !== baseline.good_with_dogs ||
      form.good_with_cats !== baseline.good_with_cats ||
      form.good_in_flat !== baseline.good_in_flat
    )
      out.push("vhodnost domova");
    if (form.adoption_fee !== baseline.adoption_fee) out.push("adopční poplatek");
    if (
      form.is_handicapped !== baseline.is_handicapped ||
      form.handicap_note !== baseline.handicap_note
    )
      out.push("handicap");
    return out;
  }, [form, baseline]);

  const dirty = dirtyFields.length > 0;

  // --- Foto upload ---
  const fileRef = useRef<HTMLInputElement>(null);
  async function uploadFiles(files: FileList) {
    setUploading(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload selhal");
        urls.push(data.url);
      }
      setForm((f) => ({ ...f, photos: [...f.photos, ...urls] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload selhal");
    } finally {
      setUploading(false);
    }
  }

  // --- Drag reorder galerie ---
  const dragIndex = useRef<number | null>(null);
  function onDrop(target: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from == null || from === target) return;
    setForm((f) => {
      const next = [...f.photos];
      const [moved] = next.splice(from, 1);
      next.splice(target, 0, moved);
      return { ...f, photos: next };
    });
  }

  // --- Plemena pro aktuální druh ---
  const breedOptions = breeds[form.species] ?? [];

  /** Explicitní založení nového plemene (tlačítko „Nové plemeno"). */
  async function handleCreateBreed(name: string): Promise<boolean> {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const res = await addCustomBreed(form.species, trimmed);
    if ("error" in res) {
      setError(res.error);
      return false;
    }
    setBreeds((prev) => ({
      ...prev,
      [form.species]: [...new Set([...(prev[form.species] ?? []), res.name])].sort(
        (a, b) => a.localeCompare(b, "cs"),
      ),
    }));
    set("breed", res.name);
    return true;
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const values: AnimalProfileValues = {
        name: form.name,
        species: form.species,
        sex: form.sex,
        breed: form.breed,
        is_crossbreed: form.is_crossbreed,
        breed_secondary: form.breed_secondary,
        primary_photo_url: form.photos[0] ?? "",
        gallery: form.photos.slice(1),
        date_of_birth: form.date_of_birth,
        birth_date_is_estimate: false,
        age_years: initial.age_years,
        age_months: initial.age_months,
        size: form.size === "" ? null : form.size,
        color: form.color,
        personality_tags: form.personality_tags,
        story_text: form.story_text,
        description: form.description,
        good_with_children: form.good_with_children,
        good_with_dogs: form.good_with_dogs,
        good_with_cats: form.good_with_cats,
        suitable_housing: triToHousing(form.good_in_flat),
        adoption_fee: form.adoption_fee,
        is_handicapped: form.is_handicapped,
        handicap_note: form.handicap_note,
      };
      const res = await saveAnimalProfile(animalId, values);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      // Server re-render přepošle nový `initial` → baseline se přepočítá a
      // dirty zmizí (form drží uložené hodnoty).
      router.refresh();
    });
  }

  const disabled = readOnly || isPending;

  return (
    <div className="space-y-5">
      {/* 1) Základní profil */}
      <Card title="🐾 Základní profil" sub="Jak se zvíře jmenuje a co je zač — část se ukazuje i na webu">
        <div className="grid gap-5 sm:grid-cols-[280px_1fr]">
          {/* Foto */}
          <div>
            <PhotoManager
              photos={form.photos}
              readOnly={readOnly}
              uploading={uploading}
              onPick={() => fileRef.current?.click()}
              onRemove={(i) =>
                set(
                  "photos",
                  form.photos.filter((_, idx) => idx !== i),
                )
              }
              onDragStart={(i) => (dragIndex.current = i)}
              onDrop={onDrop}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
            <p className="mt-2 text-xs text-ink-500">
              První fotka = hlavní (ukazuje se v katalogu). Přetažením změníš
              pořadí.
            </p>
          </div>

          {/* Pole */}
          <div className="space-y-4">
            <Field label="Jméno">
              <input
                className="admin-input"
                value={form.name}
                disabled={disabled}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Druh">
                <select
                  className="admin-input"
                  value={form.species}
                  disabled={disabled}
                  onChange={(e) => set("species", e.target.value as Species)}
                >
                  {(["dog", "cat", "rabbit", "other"] as Species[]).map((s) => (
                    <option key={s} value={s}>
                      {SPECIES_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Pohlaví">
                <select
                  className="admin-input"
                  value={form.sex}
                  disabled={disabled}
                  onChange={(e) => set("sex", e.target.value as Sex)}
                >
                  {(["female", "male", "unknown"] as Sex[]).map((s) => (
                    <option key={s} value={s}>
                      {SEX_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <BreedField
              breedOptions={breedOptions}
              breed={form.breed}
              isCrossbreed={form.is_crossbreed}
              breedSecondary={form.breed_secondary}
              disabled={disabled}
              onBreed={(v) => set("breed", v)}
              onCrossbreed={(v) => set("is_crossbreed", v)}
              onBreedSecondary={(v) => set("breed_secondary", v)}
              onCreate={handleCreateBreed}
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Datum narození">
                <input
                  type="date"
                  className="admin-input"
                  value={form.date_of_birth}
                  disabled={disabled}
                  onChange={(e) => set("date_of_birth", e.target.value)}
                />
              </Field>
              <Field label="Velikost">
                <select
                  className="admin-input"
                  value={form.size}
                  disabled={disabled}
                  onChange={(e) => set("size", e.target.value as AnimalSize | "")}
                >
                  <option value="">—</option>
                  {(["small", "medium", "large", "xlarge"] as AnimalSize[]).map(
                    (s) => (
                      <option key={s} value={s}>
                        {SIZE_LABEL[s]}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Barva">
                <input
                  className="admin-input"
                  value={form.color}
                  disabled={disabled}
                  onChange={(e) => set("color", e.target.value)}
                />
              </Field>
              <Field label="Adopční poplatek (Kč)">
                <input
                  className="admin-input"
                  type="number"
                  min={0}
                  value={form.adoption_fee ?? ""}
                  disabled={disabled}
                  onChange={(e) => set("adoption_fee", e.target.value ? Number(e.target.value) : null)}
                  placeholder={
                    initial.institution_fee_default != null
                      ? `Výchozí útulku: ${initial.institution_fee_default} Kč`
                      : "Prázdné = výchozí z nastavení"
                  }
                />
                <p className="mt-1 text-xs text-ink-400">
                  Prázdné = použije se výchozí poplatek z Nastavení → Adopce.
                </p>
              </Field>
            </div>
          </div>
        </div>
      </Card>

      {/* 2) Veřejná prezentace */}
      <Card title="🌐 Veřejná prezentace" sub="Co uvidí návštěvníci webu">
        {!isAvailable && (
          <div className="mb-4 flex items-start gap-2.5 rounded-md bg-sunshine-200 p-3 text-sm text-ink-700 ring-1 ring-inset ring-sunshine-400/40">
            <Info className="mt-0.5 size-4 shrink-0 text-sunshine-600" />
            <span>
              Profil zatím <b>není veřejný</b> — zobrazí se automaticky po
              přechodu zvířete na „K adopci". Vyplněné údaje se uloží už teď.
            </span>
          </div>
        )}
        <Field label="Krátký popis (do karty v katalogu)">
          <input
            className="admin-input"
            value={form.description}
            disabled={disabled}
            maxLength={120}
            onChange={(e) => set("description", e.target.value)}
          />
          <p className="mt-1.5 text-xs text-ink-500">
            Max. ~90 znaků. Delší text patří do „Příběh" níže.
          </p>
        </Field>
      </Card>

      {/* 3) Povaha & příběh */}
      <Card title="💬 Povaha & příběh" sub="Text pro veřejný profil — pomáhá najít správný domov">
        <Field label="Povahové rysy">
          <TagChips
            value={form.personality_tags}
            disabled={disabled}
            onChange={(tags) => set("personality_tags", tags)}
          />
        </Field>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-600">
              Příběh / popis
            </span>
            {!readOnly && (
              <button
                type="button"
                disabled={aiPending || isPending}
                onClick={suggestCopy}
                className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-50 px-3 py-1 text-xs font-semibold text-meadow-700 hover:bg-meadow-100 disabled:opacity-50"
              >
                {aiPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {aiPending ? "Generuji…" : "Návrh přes AI"}
              </button>
            )}
          </div>
          <textarea
            className="admin-input min-h-24 resize-y leading-relaxed"
            value={form.story_text}
            disabled={disabled}
            onChange={(e) => set("story_text", e.target.value)}
          />
          <p className="mt-1.5 text-xs text-ink-500">
            AI vyplní příběh i krátký popis z údajů o zvířeti — pak si je
            zkontroluj a ulož. Zobrazí se na webu, až bude zvíře „K adopci".
          </p>
        </div>
      </Card>

      {/* 4) Vhodnost domova */}
      <Card title="🧩 Vhodnost domova" sub="Pomáhá filtrovat zájemce — ukazuje se na webu jako ikonky">
        <div className="space-y-3">
          <TriRow
            label="🧒 K dětem"
            value={form.good_with_children}
            disabled={disabled}
            onChange={(v) => set("good_with_children", v)}
          />
          <TriRow
            label="🐕 K jiným psům"
            value={form.good_with_dogs}
            disabled={disabled}
            onChange={(v) => set("good_with_dogs", v)}
          />
          <TriRow
            label="🐈 Ke kočkám"
            value={form.good_with_cats}
            disabled={disabled}
            onChange={(v) => set("good_with_cats", v)}
          />
          <TriRow
            label="🏢 Do bytu"
            value={form.good_in_flat}
            disabled={disabled}
            onChange={(v) => set("good_in_flat", v)}
          />
        </div>
      </Card>

      {/* 5) Handicap */}
      <Card title="♿ Handicap" sub="Samostatný příznak — zvíře může být zdravé i handicapované. Ukazuje se i na veřejném profilu.">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={form.is_handicapped}
            disabled={disabled}
            onChange={(e) => set("is_handicapped", e.target.checked)}
            className="size-5 accent-meadow-500"
          />
          <span className="text-sm font-bold text-ink-900">
            Zvíře je handicapované
          </span>
        </label>
        {form.is_handicapped && (
          <div className="mt-3">
            <Field label="O jaký handicap jde">
              <textarea
                className="admin-input min-h-16 resize-y"
                value={form.handicap_note}
                disabled={disabled}
                placeholder="Např. slepé na levé oko, amputovaná zadní noha, hluché…"
                onChange={(e) => set("handicap_note", e.target.value)}
              />
            </Field>
          </div>
        )}
      </Card>

      {error && (
        <p className="text-sm font-semibold text-meadow-700">{error}</p>
      )}

      {/* Save bar */}
      {!readOnly && dirty && (
        <div className="sticky bottom-4 z-30 flex items-center gap-3 rounded-pill border border-ink-900/10 bg-cream/90 px-5 py-3 shadow-lg backdrop-blur">
          <span className="flex-1 text-sm font-semibold text-ink-500">
            Neuložené změny: <b className="text-ink-700">{dirtyFields.join(", ")}</b>
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setForm(baseline)}
            className="rounded-pill border-[1.5px] border-ink-900/15 px-5 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm disabled:opacity-50"
          >
            Zahodit
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={save}
            className="inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-6 py-2 text-sm font-semibold text-cream shadow-sm hover:bg-meadow-600 disabled:opacity-50"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Uložit profil
          </button>
        </div>
      )}
    </div>
  );
}

// --- Podkomponenty ---------------------------------------------------------

function Card({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
      <h2 className="font-display text-lg font-bold text-ink-900">{title}</h2>
      <p className="mb-4 text-sm text-ink-500">{sub}</p>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function PhotoManager({
  photos,
  readOnly,
  uploading,
  onPick,
  onRemove,
  onDragStart,
  onDrop,
}: {
  photos: string[];
  readOnly: boolean;
  uploading: boolean;
  onPick: () => void;
  onRemove: (i: number) => void;
  onDragStart: (i: number) => void;
  onDrop: (i: number) => void;
}) {
  const main = photos[0];
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-cream-warm ring-1 ring-inset ring-ink-900/6">
        {main ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={main} alt="Hlavní fotka" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-5xl">
            🐾
          </div>
        )}
        {main && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-pill bg-meadow-500 px-2.5 py-1 text-[11px] font-bold text-cream">
            <Star className="size-3" /> Hlavní fotka
          </span>
        )}
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-2">
        {photos.map((url, i) => (
          <div
            key={url}
            draggable={!readOnly}
            onDragStart={() => onDragStart(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(i)}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-md ring-1 ring-inset",
              i === 0 ? "ring-meadow-500" : "ring-ink-900/10",
              !readOnly && "cursor-grab",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="size-full object-cover" />
            {!readOnly && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute right-1 top-1 hidden rounded-full bg-ink-900/70 p-0.5 text-cream group-hover:block"
                aria-label="Odebrat fotku"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button
            type="button"
            onClick={onPick}
            disabled={uploading}
            className="flex aspect-square items-center justify-center rounded-md border-[1.5px] border-dashed border-ink-900/20 text-ink-400 hover:border-meadow-500 hover:text-meadow-600 disabled:opacity-50"
            aria-label="Přidat fotku"
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function TagChips({
  value,
  disabled,
  onChange,
}: {
  value: string[];
  disabled: boolean;
  onChange: (tags: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");
  const all = [...PRESET_TAGS, ...value.filter((t) => !PRESET_TAGS.includes(t))];

  const toggle = (tag: string) =>
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);

  return (
    <div className="flex flex-wrap gap-2">
      {all.map((tag) => {
        const on = value.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            disabled={disabled}
            onClick={() => toggle(tag)}
            className={cn(
              "rounded-pill border-[1.5px] px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50",
              on
                ? "border-meadow-500 bg-meadow-50 text-meadow-700"
                : "border-ink-900/15 bg-cream text-ink-700 hover:border-meadow-500",
            )}
          >
            {on ? "✓ " : ""}
            {tag}
          </button>
        );
      })}
      {!disabled &&
        (adding ? (
          <input
            autoFocus
            value={custom}
            placeholder="vlastní rys…"
            onChange={(e) => setCustom(e.target.value)}
            onBlur={() => {
              const t = custom.trim();
              if (t && !value.includes(t)) onChange([...value, t]);
              setCustom("");
              setAdding(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-32 rounded-pill border-[1.5px] border-meadow-500 bg-cream px-3.5 py-1.5 text-sm outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-pill border-[1.5px] border-dashed border-ink-900/20 px-3.5 py-1.5 text-sm font-semibold text-ink-500 hover:border-meadow-500 hover:text-meadow-600"
          >
            <Plus className="size-3.5" /> vlastní
          </button>
        ))}
    </div>
  );
}

function TriRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: Tri;
  disabled: boolean;
  onChange: (v: Tri) => void;
}) {
  const opts: { v: Tri; label: string; on: string }[] = [
    { v: "yes", label: "Ano", on: "bg-fern-50 text-fern-700" },
    { v: "no", label: "Ne", on: "bg-meadow-50 text-meadow-700" },
    { v: "unknown", label: "Nevím", on: "bg-cream-warm text-ink-700" },
  ];
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm font-bold text-ink-900">
        {label}
      </span>
      <div className="inline-flex overflow-hidden rounded-pill border-[1.5px] border-ink-900/15">
        {opts.map((o, i) => {
          const active = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              disabled={disabled}
              onClick={() => onChange(o.v)}
              className={cn(
                "px-3.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50",
                i > 0 && "border-l-[1.5px] border-ink-900/15",
                active ? o.on : "bg-cream text-ink-400 hover:text-ink-700",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
