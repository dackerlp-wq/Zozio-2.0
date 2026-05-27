"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Filter, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZozioButton } from "@/components/zozio/button";
import { cn } from "@/lib/utils";

export interface FilterOptions {
  search: string[];
  breeds: string[];
  colors: string[];
  tags: string[];
  cities: string[];
  shelters: { id: string; name: string; city: string }[];
}

export interface FilterValues {
  q: string;
  species: string;
  sex: string;
  age: string;
  size: string;
  breed: string;
  color: string;
  tags: string[];
  vaccinated: string;
  neutered: string;
  handicap: string;
  city: string;
  shelter: string;
}

interface AdoptFiltersProps {
  initial: FilterValues;
  options: FilterOptions;
  activeCount: number;
  resultCount: number;
}

export function AdoptFilters({
  initial,
  options,
  activeCount,
  resultCount,
}: AdoptFiltersProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile trigger bar */}
      <div className="sticky top-16 z-20 -mx-4 flex items-center justify-between gap-3 border-b border-ink-900/8 bg-cream-warm/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
        <span className="text-sm font-semibold text-ink-700">
          {resultCount.toLocaleString("cs-CZ")} výsledků
        </span>
        <ZozioButton
          type="button"
          variant="meadow"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Filter /> Filtry
          {activeCount > 0 && (
            <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-cream/30 text-xs">
              {activeCount}
            </span>
          )}
        </ZozioButton>
      </div>

      {/* Desktop sidebar — sticky s vlastním scrollem */}
      <aside className="hidden lg:block">
        <div
          className={cn(
            "sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1",
            // Hezký tenký scrollbar v meadow tónu
            "[scrollbar-color:theme(colors.meadow.300)_transparent] [scrollbar-width:thin]",
            "[&::-webkit-scrollbar]:w-1.5",
            "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-meadow-300/60",
            "[&::-webkit-scrollbar-track]:bg-transparent",
          )}
        >
          <FilterForm
            initial={initial}
            options={options}
            activeCount={activeCount}
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Zavřít filtry"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-background p-5 shadow-soft-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-ink-900">
                Filtry
              </h2>
              <ZozioButton
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Zavřít"
              >
                <X />
              </ZozioButton>
            </div>
            <FilterForm
              initial={initial}
              options={options}
              activeCount={activeCount}
              onSubmit={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ---- Form ---------------------------------------------------------------

function FilterForm({
  initial,
  options,
  activeCount,
  onSubmit,
}: {
  initial: FilterValues;
  options: FilterOptions;
  activeCount: number;
  onSubmit?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Local state — controlled to allow clear-all and instant chips
  const [values, setValues] = useState<FilterValues>(initial);

  const advancedActiveInitial =
    Boolean(initial.breed) ||
    Boolean(initial.color) ||
    initial.tags.length > 0 ||
    Boolean(initial.vaccinated) ||
    Boolean(initial.neutered) ||
    Boolean(initial.handicap) ||
    Boolean(initial.shelter) ||
    Boolean(initial.city);
  const [showAdvanced, setShowAdvanced] = useState(advancedActiveInitial);

  const advancedActiveCount =
    (values.breed ? 1 : 0) +
    (values.color ? 1 : 0) +
    values.tags.length +
    (values.vaccinated ? 1 : 0) +
    (values.neutered ? 1 : 0) +
    (values.handicap ? 1 : 0) +
    (values.shelter ? 1 : 0) +
    (values.city ? 1 : 0);

  const set = <K extends keyof FilterValues>(key: K, val: FilterValues[K]) =>
    setValues((v) => ({ ...v, [key]: val }));

  const toggleTag = (tag: string) =>
    setValues((v) => ({
      ...v,
      tags: v.tags.includes(tag)
        ? v.tags.filter((t) => t !== tag)
        : [...v.tags, tag],
    }));

  const clearAll = () => {
    const cleared: FilterValues = {
      q: "", species: "", sex: "", age: "", size: "", breed: "",
      color: "", tags: [], vaccinated: "", neutered: "", handicap: "",
      city: "", shelter: "",
    };
    setValues(cleared);
    startTransition(() => router.push("/adopt"));
    onSubmit?.();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (values.q) params.set("q", values.q);
    if (values.species) params.set("species", values.species);
    if (values.sex) params.set("sex", values.sex);
    if (values.age) params.set("age", values.age);
    if (values.size) params.set("size", values.size);
    if (values.breed) params.set("breed", values.breed);
    if (values.color) params.set("color", values.color);
    for (const t of values.tags) params.append("tag", t);
    if (values.vaccinated) params.set("vaccinated", values.vaccinated);
    if (values.neutered) params.set("neutered", values.neutered);
    if (values.handicap) params.set("handicap", values.handicap);
    if (values.city) params.set("city", values.city);
    if (values.shelter) params.set("shelter", values.shelter);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/adopt?${qs}` : "/adopt"));
    onSubmit?.();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-1 rounded-3xl bg-cream p-5 shadow-soft-sm ring-1 ring-ink-900/8"
    >
      {/* Search */}
      <FieldGroup>
        <SearchField
          value={values.q}
          onChange={(v) => set("q", v)}
          suggestions={options.search}
        />
      </FieldGroup>

      {/* Species */}
      <FieldGroup label="Druh">
        <PillGroup
          value={values.species}
          onChange={(v) => set("species", v)}
          options={[
            { value: "", label: "Vše" },
            { value: "dog", label: "🐕 Pes" },
            { value: "cat", label: "🐈 Kočka" },
            { value: "rabbit", label: "🐰 Králík" },
            { value: "other", label: "Jiné" },
          ]}
        />
      </FieldGroup>

      {/* Sex */}
      <FieldGroup label="Pohlaví">
        <PillGroup
          value={values.sex}
          onChange={(v) => set("sex", v)}
          options={[
            { value: "", label: "Vše" },
            { value: "male", label: "♂ Samec" },
            { value: "female", label: "♀ Samice" },
          ]}
        />
      </FieldGroup>

      {/* Age */}
      <FieldGroup label="Věk">
        <PillGroup
          value={values.age}
          onChange={(v) => set("age", v)}
          wrap
          options={[
            { value: "", label: "Vše" },
            { value: "puppy", label: "Mládě (<1)" },
            { value: "young", label: "Mladé (1–2)" },
            { value: "adult", label: "Dospělé (3–7)" },
            { value: "senior", label: "Senior (8+)" },
          ]}
        />
      </FieldGroup>

      {/* Size */}
      <FieldGroup label="Velikost">
        <SelectField
          value={values.size}
          onChange={(v) => set("size", v)}
          options={[
            { value: "", label: "Vše" },
            { value: "small", label: "Malé" },
            { value: "medium", label: "Střední" },
            { value: "large", label: "Velké" },
            { value: "xlarge", label: "Obří" },
          ]}
        />
      </FieldGroup>

      {/* Advanced toggle */}
      <div className="py-4">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className="flex w-full items-center justify-between gap-2 rounded-2xl bg-cream-warm px-4 py-3 text-sm font-semibold text-ink-700 transition-colors hover:bg-meadow-100"
        >
          <span className="flex items-center gap-2">
            Rozšířené filtry
            {advancedActiveCount > 0 && (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-meadow-500 text-xs text-cream">
                {advancedActiveCount}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn(
              "size-4 transition-transform duration-200",
              showAdvanced && "rotate-180",
            )}
          />
        </button>
      </div>

      {/* Advanced section */}
      {showAdvanced && (
        <div className="space-y-1 border-t border-meadow-300/30 pt-1">

      {/* Breed */}
      <FieldGroup label="Plemeno">
        <TextWithDatalist
          value={values.breed}
          onChange={(v) => set("breed", v)}
          placeholder="Vyber nebo napiš…"
          suggestions={options.breeds}
        />
      </FieldGroup>

      {/* Color */}
      <FieldGroup label="Barva">
        <TextWithDatalist
          value={values.color}
          onChange={(v) => set("color", v)}
          placeholder="Vyber nebo napiš…"
          suggestions={options.colors}
        />
      </FieldGroup>

      {/* Tags multi-select */}
      <FieldGroup label="Štítky">
        <TagChips
          allTags={options.tags}
          selected={values.tags}
          onToggle={toggleTag}
        />
      </FieldGroup>

      {/* Tri-state radios */}
      <FieldGroup label="Očkování">
        <TriState
          name="vaccinated"
          value={values.vaccinated}
          onChange={(v) => set("vaccinated", v)}
        />
      </FieldGroup>

      <FieldGroup label="Kastrace">
        <TriState
          name="neutered"
          value={values.neutered}
          onChange={(v) => set("neutered", v)}
        />
      </FieldGroup>

      <FieldGroup label="Handicap">
        <TriState
          name="handicap"
          value={values.handicap}
          onChange={(v) => set("handicap", v)}
        />
      </FieldGroup>

      {/* Shelter */}
      <FieldGroup label="Útulek">
        <SelectField
          value={values.shelter}
          onChange={(v) => set("shelter", v)}
          options={[
            { value: "", label: "Všechny útulky" },
            ...options.shelters.map((s) => ({
              value: s.id,
              label: s.city ? `${s.name} · ${s.city}` : s.name,
            })),
          ]}
        />
      </FieldGroup>

      {/* City */}
      <FieldGroup label="Město">
        <TextWithDatalist
          value={values.city}
          onChange={(v) => set("city", v)}
          placeholder="Vyber nebo napiš…"
          suggestions={options.cities}
        />
      </FieldGroup>

        </div>
      )}

      {/* Submit */}
      <div className="sticky -bottom-5 -mx-5 mt-5 flex gap-2 border-t border-ink-900/8 bg-cream px-5 py-4">
        <ZozioButton
          type="submit"
          variant="meadow"
          size="md"
          disabled={isPending}
          className="flex-1"
        >
          {isPending ? "Hledám…" : "Použít filtry"}
        </ZozioButton>
        {activeCount > 0 && (
          <ZozioButton
            type="button"
            variant="outline"
            size="md"
            onClick={clearAll}
            disabled={isPending}
            aria-label="Vyčistit všechny filtry"
          >
            <X />
          </ZozioButton>
        )}
      </div>
    </form>
  );
}

// ---- Sub-components -----------------------------------------------------

function FieldGroup({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-ink-900/5 py-4 last:border-b-0">
      {label && (
        <div className="mb-2 font-display text-sm font-bold uppercase tracking-wider text-ink-700">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function SearchField({
  value,
  onChange,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
}) {
  const listId = useId();
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Jméno, povaha…"
        list={listId}
        autoComplete="off"
        className="h-11 rounded-xl border-ink-900/15 bg-cream-warm pl-10 text-sm"
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}

function PillGroup({
  value,
  onChange,
  options,
  wrap,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  wrap?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      className={cn("flex gap-1.5", wrap ? "flex-wrap" : "flex-wrap")}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
              active
                ? "bg-meadow-500 text-cream"
                : "bg-cream-warm text-ink-700 hover:bg-meadow-100",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-xl border border-ink-900/15 bg-cream-warm px-3 text-sm text-ink-900 outline-none focus:border-meadow-500 focus:ring-4 focus:ring-meadow-300/30"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function TextWithDatalist({
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suggestions: string[];
}) {
  const listId = useId();
  return (
    <>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={listId}
        autoComplete="off"
        className="h-11 rounded-xl border-ink-900/15 bg-cream-warm text-sm"
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}

function TagChips({
  allTags,
  selected,
  onToggle,
}: {
  allTags: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  if (allTags.length === 0) {
    return <p className="text-xs text-ink-400">Zatím žádné štítky</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {allTags.map((tag) => {
        const active = selected.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            aria-pressed={active}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              active
                ? "bg-meadow-500 text-cream"
                : "bg-cream-warm text-ink-700 hover:bg-meadow-100",
            )}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

function TriState({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <PillGroup
      value={value}
      onChange={onChange}
      options={[
        { value: "", label: "Nerozhoduje" },
        { value: "yes", label: "Ano" },
        { value: "no", label: "Ne" },
      ]}
    />
  );
}
