"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Filter, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZozioButton } from "@/components/zozio/button";
import { cn } from "@/lib/utils";

import type { Facets } from "./facets";

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
  care: string;
  housing: string;
  city: string;
  shelter: string;
}

interface AdoptFiltersProps {
  initial: FilterValues;
  options: FilterOptions;
  facets: Facets;
  activeCount: number;
  resultCount: number;
}

export function AdoptFilters({
  initial,
  options,
  facets,
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
            facets={facets}
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
              facets={facets}
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
  facets,
  activeCount,
  onSubmit,
}: {
  initial: FilterValues;
  options: FilterOptions;
  facets: Facets;
  activeCount: number;
  onSubmit?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Local state — controlled to allow clear-all and instant chips
  const [values, setValues] = useState<FilterValues>(initial);

  const buildUrl = (v: FilterValues): string => {
    const params = new URLSearchParams();
    if (v.q) params.set("q", v.q);
    if (v.species) params.set("species", v.species);
    if (v.sex) params.set("sex", v.sex);
    if (v.age) params.set("age", v.age);
    if (v.size) params.set("size", v.size);
    if (v.breed) params.set("breed", v.breed);
    if (v.color) params.set("color", v.color);
    for (const t of v.tags) params.append("tag", t);
    if (v.vaccinated) params.set("vaccinated", v.vaccinated);
    if (v.neutered) params.set("neutered", v.neutered);
    if (v.handicap) params.set("handicap", v.handicap);
    if (v.care) params.set("care", v.care);
    if (v.housing) params.set("housing", v.housing);
    if (v.city) params.set("city", v.city);
    if (v.shelter) params.set("shelter", v.shelter);
    const qs = params.toString();
    return qs ? `/adopt?${qs}` : "/adopt";
  };

  // Auto-aplikace: použij při kliku na pill/tag/select — okamžitě
  // aktualizuje URL a tím refetchne stránku.
  const apply = (updates: Partial<FilterValues>) => {
    const next = { ...values, ...updates };
    setValues(next);
    startTransition(() => router.push(buildUrl(next)));
  };

  const advancedActiveInitial =
    Boolean(initial.size) ||
    Boolean(initial.color) ||
    initial.tags.length > 0 ||
    Boolean(initial.vaccinated) ||
    Boolean(initial.neutered) ||
    Boolean(initial.handicap) ||
    Boolean(initial.care) ||
    Boolean(initial.housing) ||
    Boolean(initial.shelter);
  const [showAdvanced, setShowAdvanced] = useState(advancedActiveInitial);

  const advancedActiveCount =
    (values.size ? 1 : 0) +
    (values.color ? 1 : 0) +
    values.tags.length +
    (values.vaccinated ? 1 : 0) +
    (values.neutered ? 1 : 0) +
    (values.handicap ? 1 : 0) +
    (values.care ? 1 : 0) +
    (values.housing ? 1 : 0) +
    (values.shelter ? 1 : 0);

  // Lokální set bez submitu — pro text inputs které submitujou na Enter/blur
  const set = <K extends keyof FilterValues>(key: K, val: FilterValues[K]) =>
    setValues((v) => ({ ...v, [key]: val }));

  // Toggle tag + auto-apply
  const toggleTag = (tag: string) => {
    const nextTags = values.tags.includes(tag)
      ? values.tags.filter((t) => t !== tag)
      : [...values.tags, tag];
    apply({ tags: nextTags });
  };

  const clearAll = () => {
    const cleared: FilterValues = {
      q: "", species: "", sex: "", age: "", size: "", breed: "",
      color: "", tags: [], vaccinated: "", neutered: "", handicap: "",
      care: "", housing: "",
      city: "", shelter: "",
    };
    setValues(cleared);
    startTransition(() => router.push("/adopt"));
    onSubmit?.();
  };

  // Submit pro text inputs (Enter/blur) a "Použít a zavřít" button
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => router.push(buildUrl(values)));
    onSubmit?.();
  };

  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      apply({});
    }
  };

  const submitOnBlur = () => {
    // Apply jen pokud se hodnoty změnily oproti URL
    if (
      values.q !== initial.q ||
      values.breed !== initial.breed ||
      values.color !== initial.color ||
      values.city !== initial.city
    ) {
      apply({});
    }
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
          onSubmit={submitOnEnter}
          onBlur={submitOnBlur}
          suggestions={options.search}
        />
      </FieldGroup>

      {/* Species */}
      <FieldGroup label="Druh">
        <PillGroup
          value={values.species}
          onChange={(v) => apply({ species: v })}
          counts={facets.species}
          options={[
            { value: "", label: "Vše" },
            { value: "dog", label: "🐕 Pes" },
            { value: "cat", label: "🐈 Kočka" },
            { value: "rabbit", label: "🐰 Králík" },
            { value: "other", label: "Jiné" },
          ]}
        />
      </FieldGroup>

      {/* Breed */}
      <FieldGroup label="Plemeno">
        <TextWithDatalist
          value={values.breed}
          onChange={(v) => set("breed", v)}
          onSubmit={submitOnEnter}
          onBlur={submitOnBlur}
          placeholder="Vyber nebo napiš…"
          suggestions={options.breeds.filter((b) => (facets.breed[b] ?? 0) > 0)}
        />
      </FieldGroup>

      {/* Sex */}
      <FieldGroup label="Pohlaví">
        <PillGroup
          value={values.sex}
          onChange={(v) => apply({ sex: v })}
          counts={facets.sex}
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
          onChange={(v) => apply({ age: v })}
          counts={facets.age}
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

      {/* City */}
      <FieldGroup label="Město">
        <TextWithDatalist
          value={values.city}
          onChange={(v) => set("city", v)}
          onSubmit={submitOnEnter}
          onBlur={submitOnBlur}
          placeholder="Vyber nebo napiš…"
          suggestions={options.cities.filter((c) => (facets.city[c] ?? 0) > 0)}
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

      {/* Size */}
      <FieldGroup label="Velikost">
        <SelectField
          value={values.size}
          onChange={(v) => apply({ size: v })}
          options={addCountsToOptions(
            [
              { value: "", label: "Vše" },
              { value: "small", label: "Malé" },
              { value: "medium", label: "Střední" },
              { value: "large", label: "Velké" },
              { value: "xlarge", label: "Obří" },
            ],
            facets.size,
          )}
        />
      </FieldGroup>

      {/* Color */}
      <FieldGroup label="Barva">
        <TextWithDatalist
          value={values.color}
          onChange={(v) => set("color", v)}
          onSubmit={submitOnEnter}
          onBlur={submitOnBlur}
          placeholder="Vyber nebo napiš…"
          suggestions={options.colors.filter(
            (c) => (facets.color[c] ?? 0) > 0,
          )}
        />
      </FieldGroup>

      {/* Tags multi-select */}
      <FieldGroup label="Štítky">
        <TagChips
          allTags={options.tags}
          selected={values.tags}
          counts={facets.tags}
          onToggle={toggleTag}
        />
      </FieldGroup>

      {/* Tri-state radios */}
      <FieldGroup label="Očkování">
        <TriState
          name="vaccinated"
          value={values.vaccinated}
          onChange={(v) => apply({ vaccinated: v })}
          counts={facets.vaccinated}
        />
      </FieldGroup>

      <FieldGroup label="Kastrace">
        <TriState
          name="neutered"
          value={values.neutered}
          onChange={(v) => apply({ neutered: v })}
          counts={facets.neutered}
        />
      </FieldGroup>

      <FieldGroup label="Handicap">
        <TriState
          name="handicap"
          value={values.handicap}
          onChange={(v) => apply({ handicap: v })}
          counts={facets.handicap}
        />
      </FieldGroup>

      {/* Care difficulty */}
      <FieldGroup label="Náročnost chovu">
        <PillGroup
          value={values.care}
          onChange={(v) => apply({ care: v })}
          counts={facets.care}
          wrap
          options={[
            { value: "", label: "Vše" },
            { value: "easy", label: "Nízká" },
            { value: "medium", label: "Střední" },
            { value: "high", label: "Vysoká" },
          ]}
        />
      </FieldGroup>

      {/* Suitable housing */}
      <FieldGroup label="Vhodné do">
        <PillGroup
          value={values.housing}
          onChange={(v) => apply({ housing: v })}
          counts={facets.housing}
          total={facets.housingTotal}
          options={[
            { value: "", label: "Vše" },
            { value: "apartment", label: "🏠 Byt" },
            { value: "house", label: "🏡 Dům" },
          ]}
        />
      </FieldGroup>

      {/* Shelter */}
      <FieldGroup label="Útulek">
        <SelectField
          value={values.shelter}
          onChange={(v) => apply({ shelter: v })}
          options={[
            { value: "", label: "Všechny útulky" },
            ...options.shelters
              .filter((s) => (facets.shelter[s.id] ?? 0) > 0)
              .map((s) => {
                const c = facets.shelter[s.id] ?? 0;
                const base = s.city ? `${s.name} · ${s.city}` : s.name;
                return { value: s.id, label: `${base} (${c})` };
              }),
          ]}
        />
      </FieldGroup>

        </div>
      )}

      {/* Sticky footer — primárně pro mobile drawer (zavřít), na desktopu
          slouží jako vizuální status filtru a vyčištění. Pills/selecty
          auto-aplikují bez kliku na tento button. */}
      <div className="sticky -bottom-5 -mx-5 mt-5 flex items-center gap-2 border-t border-ink-900/8 bg-cream px-5 py-4">
        {onSubmit ? (
          <ZozioButton
            type="submit"
            variant="meadow"
            size="md"
            disabled={isPending}
            className="flex-1"
          >
            {isPending ? "Hledám…" : "Hotovo"}
          </ZozioButton>
        ) : (
          <div className="flex-1 text-sm text-ink-600">
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <span className="size-2 animate-pulse rounded-full bg-meadow-500" />
                Hledám…
              </span>
            ) : activeCount > 0 ? (
              <span>
                <span className="font-semibold text-ink-900">{activeCount}</span>{" "}
                {activeCount === 1 ? "filtr aktivní" : activeCount < 5 ? "filtry aktivní" : "filtrů aktivních"}
              </span>
            ) : (
              <span>Klikni pro filtrování</span>
            )}
          </div>
        )}
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
  onSubmit,
  onBlur,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
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
        onKeyDown={onSubmit}
        onBlur={onBlur}
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
  counts,
  total: totalOverride,
  wrap,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  counts?: Record<string, number>;
  /** Použij když součet hodnot nereflektuje skutečný total (např. housing,
      kde "both" se počítá do byt i dům). */
  total?: number;
  wrap?: boolean;
}) {
  // Celkový součet pro "Vše" pill
  const total =
    totalOverride ??
    (counts ? Object.values(counts).reduce((s, n) => s + n, 0) : undefined);

  return (
    <div
      role="radiogroup"
      className={cn("flex gap-1.5", wrap ? "flex-wrap" : "flex-wrap")}
    >
      {options.map((o) => {
        const active = value === o.value;
        const count =
          counts === undefined
            ? undefined
            : o.value === ""
              ? total
              : (counts[o.value] ?? 0);
        const disabled = count === 0 && !active;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            // Druhý klik na aktivní pill = toggle off (zpět na "Vše").
            // "Vše" pill (value="") při kliku vždy nastaví "" — beze změny.
            onClick={() => onChange(active && o.value !== "" ? "" : o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
              active
                ? "bg-meadow-500 text-cream"
                : disabled
                  ? "cursor-not-allowed bg-cream-warm text-ink-400 opacity-50"
                  : "bg-cream-warm text-ink-700 hover:bg-meadow-100",
            )}
          >
            <span>{o.label}</span>
            {count !== undefined && (
              <span
                className={cn(
                  "text-xs font-medium",
                  active ? "text-cream/70" : "text-ink-400",
                )}
              >
                {count}
              </span>
            )}
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
  onSubmit,
  onBlur,
  placeholder,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
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
        onKeyDown={onSubmit}
        onBlur={onBlur}
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
  counts,
  onToggle,
}: {
  allTags: string[];
  selected: string[];
  counts: Record<string, number>;
  onToggle: (tag: string) => void;
}) {
  if (allTags.length === 0) {
    return <p className="text-xs text-ink-400">Zatím žádné štítky</p>;
  }
  // Sort: tags with results first, then disabled at the end
  const sorted = [...allTags].sort((a, b) => {
    const ca = counts[a] ?? 0;
    const cb = counts[b] ?? 0;
    if (ca === 0 && cb !== 0) return 1;
    if (cb === 0 && ca !== 0) return -1;
    return a.localeCompare(b, "cs");
  });
  return (
    <div className="flex flex-wrap gap-1.5">
      {sorted.map((tag) => {
        const active = selected.includes(tag);
        const count = counts[tag] ?? 0;
        const disabled = count === 0 && !active;
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            aria-pressed={active}
            disabled={disabled}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              active
                ? "bg-meadow-500 text-cream"
                : disabled
                  ? "cursor-not-allowed bg-cream-warm text-ink-400 opacity-40"
                  : "bg-cream-warm text-ink-700 hover:bg-meadow-100",
            )}
          >
            <span>{tag}</span>
            <span
              className={cn(
                "text-[10px] font-medium",
                active ? "text-cream/70" : "text-ink-400",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TriState({
  name: _name,
  value,
  onChange,
  counts,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  counts: { yes: number; no: number };
}) {
  return (
    <PillGroup
      value={value}
      onChange={onChange}
      counts={{ yes: counts.yes, no: counts.no }}
      options={[
        { value: "", label: "Nerozhoduje" },
        { value: "yes", label: "Ano" },
        { value: "no", label: "Ne" },
      ]}
    />
  );
}

function addCountsToOptions(
  options: { value: string; label: string }[],
  counts: Record<string, number>,
): { value: string; label: string }[] {
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return options
    .map((o) => {
      const c = o.value === "" ? total : (counts[o.value] ?? 0);
      return { value: o.value, label: `${o.label} (${c})`, _count: c };
    })
    .filter((o) => o.value === "" || o._count > 0)
    .map(({ value, label }) => ({ value, label }));
}
