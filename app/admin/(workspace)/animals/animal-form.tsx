"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  Sparkles,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZozioButton } from "@/components/zozio/button";
import { cn } from "@/lib/utils";
import {
  ANIMAL_INTAKE_TYPE_LABEL,
  ANIMAL_LEGAL_STATUS_HELP,
  ANIMAL_LEGAL_STATUS_LABEL,
  ANIMAL_LEGAL_STATUS_PILL,
  HEALTH_STATUS_LABEL,
  SUPERVISION_STATUS_HELP,
  SUPERVISION_STATUS_LABEL,
  SUPERVISION_STATUS_PILL,
  VET_CARE_NEED_LABEL,
} from "@/lib/format";
import { intakeDefaults } from "@/lib/animal-intake";
import {
  blockers,
  evaluateReadiness,
  warnings,
  type ReadinessInput,
} from "@/lib/animal-readiness";
import type {
  AnimalIntakeType,
  AnimalLegalStatus,
  AnimalSupervisionStatus,
  AnimalVetCareNeed,
} from "@/types/database";
import type { AnimalFormValues } from "./actions";
import { suggestRecordNumber } from "./[id]/intake-actions";
import { generateAnimalCopy, type AnimalCopy } from "./ai-actions";

const INTAKE_TYPES: AnimalIntakeType[] = [
  "found",
  "surrender",
  "transfer",
  "confiscation",
  "born",
  "other",
];

const LEGAL_STATUSES: AnimalLegalStatus[] = [
  "in_protection",
  "shelter_owned",
  "owner_claimed",
  "transferred_out",
];

const EMPTY: AnimalFormValues = {
  name: "",
  species: "dog",
  breed: "",
  is_crossbreed: false,
  breed_secondary: "",
  primary_photo_url: "",
  gallery: [],
  description: "",
  age_years: null,
  age_months: null,
  date_of_birth: "",
  sex: "unknown",
  size: null,
  color: "",
  weight_kg: null,
  is_neutered: null,
  is_vaccinated: false,
  is_chipped: null,
  health_status: "healthy",
  health_notes: "",
  good_with_children: "unknown",
  good_with_dogs: "unknown",
  good_with_cats: "unknown",
  energy_level: null,
  care_difficulty: null,
  suitable_housing: null,
  personality_tags: [],
  story_title: "",
  story_text: "",
  adoption_status: "available",
  is_urgent: false,
  intake_type: null,
  intake_date: "",
  intake_time: "",
  found_location: "",
  found_date: "",
  announced_at: "",
  found_lat: null,
  found_lng: null,
  handed_over_by: "",
  handed_over_phone: "",
  handed_over_email: "",
  intake_condition: "",
  record_number: "",
  chip_number: "",
  tattoo: "",
  ear_tag: "",
  identification_none: false,
  vet_care_need: null,
  supervision_status: "released",
  intake_quarantine_days: null,
  kennel_id: null,
  intake_staff: "",
  intake_notes: "",
  municipality_ref: "",
  registry_name: "",
  auto_publish: true,
  legal_status: "shelter_owned",
  protection_until: "",
};

/** Možnost výběru kotce ve formuláři příjmu. */
export interface KennelChoice {
  id: string;
  name: string;
  capacity: number;
  is_quarantine: boolean;
  occupied: number;
}

/** Výchozí délka karantény/dohledu (dny) podle režimu při příjmu. */
const DEFAULT_SUPERVISION_DAYS: Record<string, number | null> = {
  released: null,
  quarantine: 14,
  isolation: 14,
  monitored: null,
};

interface AnimalFormProps {
  initial?: Partial<AnimalFormValues>;
  onSubmit: (values: AnimalFormValues) => Promise<{ error?: string } | void>;
  submitLabel: string;
  /** Zobrazit sekci Příjem & právní stav (jen při vytváření nového zvířete). */
  showIntake?: boolean;
  /** Kotce útulku pro výběr umístění při příjmu. */
  kennels?: KennelChoice[];
}

const SUPERVISION_OPTIONS: [string, string][] = [
  ["released", SUPERVISION_STATUS_LABEL.released],
  ["quarantine", SUPERVISION_STATUS_LABEL.quarantine],
  ["isolation", SUPERVISION_STATUS_LABEL.isolation],
  ["monitored", SUPERVISION_STATUS_LABEL.monitored],
];

const VET_CARE_OPTIONS: [string, string][] = [
  ["", "— nevybráno —"],
  ["none", VET_CARE_NEED_LABEL.none],
  ["required", VET_CARE_NEED_LABEL.required],
  ["scheduled", VET_CARE_NEED_LABEL.scheduled],
  ["deferred", VET_CARE_NEED_LABEL.deferred],
];

// Zdravotní stav v pořadí: zdravé / nemocné / léčené / handicap / neznámo.
const HEALTH_OPTIONS: [string, string][] = [
  ["healthy", HEALTH_STATUS_LABEL.healthy],
  ["sick", HEALTH_STATUS_LABEL.sick],
  ["treated", HEALTH_STATUS_LABEL.treated],
  ["special_needs", HEALTH_STATUS_LABEL.special_needs],
  ["unknown", HEALTH_STATUS_LABEL.unknown],
];

export function AnimalForm({
  initial,
  onSubmit,
  submitLabel,
  showIntake = false,
  kennels = [],
}: AnimalFormProps) {
  const [v, setV] = useState<AnimalFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [numberPending, startNumber] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  // AI návrh adopčního textu (čeká na schválení uživatelem).
  const [aiPending, startAi] = useTransition();
  const [aiDraft, setAiDraft] = useState<AnimalCopy | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const generateCopy = () => {
    setAiError(null);
    setAiDraft(null);
    startAi(async () => {
      const res = await generateAnimalCopy({
        name: v.name,
        species: v.species,
        breed: v.breed,
        is_crossbreed: v.is_crossbreed,
        breed_secondary: v.breed_secondary,
        age_years: v.age_years,
        age_months: v.age_months,
        sex: v.sex,
        size: v.size,
        color: v.color,
        energy_level: v.energy_level,
        good_with_children: v.good_with_children,
        good_with_dogs: v.good_with_dogs,
        good_with_cats: v.good_with_cats,
        health_status: v.health_status,
        health_notes: v.health_notes,
        personality_tags: v.personality_tags,
      });
      if ("error" in res) setAiError(res.error);
      else setAiDraft(res.data);
    });
  };

  const applyAiDraft = () => {
    if (!aiDraft) return;
    setV((s) => ({
      ...s,
      description: aiDraft.description,
      story_title: aiDraft.story_title,
      story_text: aiDraft.story_text,
      // Sloučí návrh se stávajícími štítky (bez duplicit).
      personality_tags: [
        ...s.personality_tags,
        ...aiDraft.personality_tags.filter(
          (t) => !s.personality_tags.includes(t),
        ),
      ],
    }));
    setAiDraft(null);
  };

  const genNumber = () =>
    startNumber(async () => {
      const res = await suggestRecordNumber();
      if ("ok" in res) set("record_number", res.value);
    });

  const isFound = v.intake_type === "found" || v.intake_type === "confiscation";
  const isSurrender = v.intake_type === "surrender";

  // Živý náhled připravenosti ke zveřejnění (jen v režimu příjmu).
  const readinessInput: ReadinessInput = {
    intake_type: v.intake_type,
    intake_date: v.intake_date || null,
    found_date: v.found_date || null,
    supervision_status: v.supervision_status,
    legal_status: v.legal_status,
    chip_number: v.chip_number || null,
    tattoo: v.tattoo || null,
    ear_tag: v.ear_tag || null,
    identification_none: v.identification_none,
    primary_photo_url: v.primary_photo_url || null,
    is_vaccinated: v.is_vaccinated,
    published_at: null,
  };
  const readinessItems = evaluateReadiness(readinessInput);
  const publishBlockers = blockers(readinessItems, "publish");
  const publishWarnings = warnings(readinessItems);
  const publishReady = publishBlockers.length === 0;

  const set = <K extends keyof AnimalFormValues>(
    key: K,
    val: AnimalFormValues[K],
  ) => setV((s) => ({ ...s, [key]: val }));

  // Výběr způsobu příjmu předvyplní právní stav i režim dohledu podle běžné
  // praxe (nalezenec → ochranná lhůta + karanténa, odebráno → izolace,
  // narozeno → vlastnictví útulku bez karantény). Vše lze ručně přepsat.
  const pickIntakeType = (type: AnimalIntakeType | null) => {
    const d = intakeDefaults(type);
    setV((s) => ({
      ...s,
      intake_type: type,
      legal_status: type ? d.legal_status : s.legal_status,
      protection_until: d.protection ? s.protection_until : "",
      supervision_status: type ? d.supervision_status : s.supervision_status,
      intake_quarantine_days: type
        ? DEFAULT_SUPERVISION_DAYS[d.supervision_status]
        : s.intake_quarantine_days,
    }));
  };

  // Ruční změna režimu dohledu (přepíše návrh ze způsobu příjmu).
  const pickSupervision = (status: AnimalSupervisionStatus) => {
    setV((s) => ({
      ...s,
      supervision_status: status,
      intake_quarantine_days:
        status === "released" ? null : DEFAULT_SUPERVISION_DAYS[status],
    }));
  };

  const uploadFiles = async (files: FileList, target: "primary" | "gallery") => {
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
      if (target === "primary") {
        set("primary_photo_url", urls[0]);
      } else {
        set("gallery", [...v.gallery, ...urls]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload selhal");
    } finally {
      setUploading(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !v.personality_tags.includes(t)) {
      set("personality_tags", [...v.personality_tags, t]);
    }
    setTagInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(v);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic */}
      <Section
        title="Základní údaje"
        icon="🐾"
        subtitle="Jméno, druh a vzhled zvířete."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jméno *" full>
            <Input
              required
              value={v.name}
              onChange={(e) => set("name", e.target.value)}
              className="admin-input"
              placeholder="Bobík"
            />
          </Field>
          <Field label="Druh">
            <Select
              value={v.species}
              onChange={(val) => set("species", val as typeof v.species)}
              options={[
                ["dog", "Pes"],
                ["cat", "Kočka"],
                ["rabbit", "Králík"],
                ["other", "Jiné"],
              ]}
            />
          </Field>
          <Field label="Pohlaví">
            <Select
              value={v.sex}
              onChange={(val) => set("sex", val as typeof v.sex)}
              options={[
                ["unknown", "Neznámé"],
                ["male", "Samec"],
                ["female", "Samice"],
              ]}
            />
          </Field>
          <Field label="Plemeno">
            <Input
              value={v.breed}
              onChange={(e) => set("breed", e.target.value)}
              className="admin-input"
              placeholder="Kříženec retrievera"
            />
          </Field>
          <Field label="Druhé plemeno (kříženec)">
            <Input
              value={v.breed_secondary}
              onChange={(e) => set("breed_secondary", e.target.value)}
              className="admin-input"
            />
          </Field>
          <Field label="Věk (roky)">
            <Input
              type="number"
              min={0}
              max={30}
              value={v.age_years ?? ""}
              onChange={(e) =>
                set("age_years", e.target.value ? Number(e.target.value) : null)
              }
              className="admin-input"
            />
          </Field>
          <Field label="Věk (měsíce)">
            <Input
              type="number"
              min={0}
              max={11}
              value={v.age_months ?? ""}
              onChange={(e) =>
                set("age_months", e.target.value ? Number(e.target.value) : null)
              }
              className="admin-input"
            />
          </Field>
          <Field label="Datum narození (pokud známo)">
            <Input
              type="date"
              value={v.date_of_birth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => set("date_of_birth", e.target.value)}
              className="admin-input"
            />
            <p className="mt-1 text-xs text-ink-400">
              Když je vyplněno, má přednost a věk se počítá automaticky. Jinak se
              věk bere jako stav při příjmu a sám se navyšuje.
            </p>
          </Field>
          <Field label="Velikost">
            <Select
              value={v.size ?? ""}
              onChange={(val) =>
                set("size", (val || null) as typeof v.size)
              }
              options={[
                ["", "—"],
                ["small", "Malé"],
                ["medium", "Střední"],
                ["large", "Velké"],
                ["xlarge", "Obří"],
              ]}
            />
          </Field>
          <Field label="Barva">
            <Input
              value={v.color}
              onChange={(e) => set("color", e.target.value)}
              className="admin-input"
            />
          </Field>
          <Field label="Hmotnost (kg)">
            <Input
              type="number"
              min={0}
              step="0.1"
              value={v.weight_kg ?? ""}
              onChange={(e) =>
                set("weight_kg", e.target.value ? Number(e.target.value) : null)
              }
              className="admin-input"
            />
          </Field>
        </div>
      </Section>

      {/* Intake & legal — jen při vytváření nového zvířete (logicky 2. krok) */}
      {showIntake && (
        <Section
          title="Příjem & právní stav"
          icon="📥"
          subtitle="Jak a kdy se zvíře dostalo do útulku — určuje právní stav i karanténu."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Způsob příjmu (důvod)">
              <Select
                value={v.intake_type ?? ""}
                onChange={(val) =>
                  pickIntakeType((val || null) as AnimalIntakeType | null)
                }
                options={[
                  ["", "— nevybráno —"],
                  ...INTAKE_TYPES.map(
                    (t) => [t, ANIMAL_INTAKE_TYPE_LABEL[t]] as [string, string],
                  ),
                ]}
              />
            </Field>
            <Field label="Interní evidenční číslo">
              <div className="flex gap-2">
                <Input
                  value={v.record_number}
                  onChange={(e) => set("record_number", e.target.value)}
                  placeholder="2026/0001"
                  className="admin-input"
                />
                <button
                  type="button"
                  onClick={genNumber}
                  disabled={numberPending}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-ink-900 px-3 text-sm font-semibold text-cream hover:bg-ink-800 disabled:opacity-50"
                >
                  <Sparkles className="size-4" />
                  {numberPending ? "…" : "Navrhnout"}
                </button>
              </div>
            </Field>
            <Field label="Datum příjmu">
              <Input
                type="date"
                value={v.intake_date}
                onChange={(e) => set("intake_date", e.target.value)}
                className="admin-input"
              />
            </Field>
            <Field label="Čas příjmu">
              <Input
                type="time"
                value={v.intake_time}
                onChange={(e) => set("intake_time", e.target.value)}
                className="admin-input"
              />
            </Field>

            {isFound && (
              <>
                <Field label="Místo nálezu" full>
                  <Input
                    value={v.found_location}
                    onChange={(e) => set("found_location", e.target.value)}
                    placeholder="Obec, ulice…"
                    className="admin-input"
                  />
                </Field>
                <Field label="GPS šířka (lat)">
                  <Input
                    type="number"
                    step="0.000001"
                    value={v.found_lat ?? ""}
                    onChange={(e) =>
                      set("found_lat", e.target.value ? Number(e.target.value) : null)
                    }
                    placeholder="50.0755"
                    className="admin-input"
                  />
                </Field>
                <Field label="GPS délka (lng)">
                  <Input
                    type="number"
                    step="0.000001"
                    value={v.found_lng ?? ""}
                    onChange={(e) =>
                      set("found_lng", e.target.value ? Number(e.target.value) : null)
                    }
                    placeholder="14.4378"
                    className="admin-input"
                  />
                </Field>
                <Field label="Datum nálezu">
                  <Input
                    type="date"
                    value={v.found_date}
                    onChange={(e) => set("found_date", e.target.value)}
                    className="admin-input"
                  />
                </Field>
                <Field label="Datum vyhlášení nálezu">
                  <Input
                    type="date"
                    value={v.announced_at}
                    onChange={(e) => set("announced_at", e.target.value)}
                    className="admin-input"
                  />
                </Field>
              </>
            )}

            <Field label="Kdo zvíře předal / přinesl">
              <Input
                value={v.handed_over_by}
                onChange={(e) => set("handed_over_by", e.target.value)}
                placeholder="Jméno"
                className="admin-input"
              />
            </Field>
            <Field label="Telefon předávajícího">
              <Input
                type="tel"
                value={v.handed_over_phone}
                onChange={(e) => set("handed_over_phone", e.target.value)}
                placeholder="+420…"
                className="admin-input"
              />
            </Field>
            <Field label="E-mail předávajícího">
              <Input
                type="email"
                value={v.handed_over_email}
                onChange={(e) => set("handed_over_email", e.target.value)}
                className="admin-input"
              />
            </Field>
          </div>

          {v.intake_type && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl bg-sage-50 px-4 py-3 text-sm text-ink-700 ring-1 ring-inset ring-ink-900/8">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-meadow-600" />
              <span>{intakeDefaults(v.intake_type).note}</span>
            </div>
          )}

          <div className="mt-5 border-t border-ink-900/8 pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Stav vlastnictví">
                <Select
                  value={v.legal_status}
                  onChange={(val) =>
                    set("legal_status", val as AnimalLegalStatus)
                  }
                  options={LEGAL_STATUSES.map((s) => [
                    s,
                    ANIMAL_LEGAL_STATUS_LABEL[s],
                  ])}
                />
              </Field>
              <Field label="Konec ochranné lhůty">
                <Input
                  type="date"
                  value={v.protection_until}
                  onChange={(e) => set("protection_until", e.target.value)}
                  disabled={v.legal_status !== "in_protection"}
                  className="admin-input"
                />
              </Field>
            </div>
            <div
              className={cn(
                "mt-3 rounded-2xl px-4 py-3 text-sm",
                ANIMAL_LEGAL_STATUS_PILL[v.legal_status],
              )}
            >
              {ANIMAL_LEGAL_STATUS_HELP[v.legal_status]}
              {v.legal_status === "in_protection" && (
                <span className="mt-1 block text-xs opacity-80">
                  Necháš-li datum prázdné a vyplníš datum vyhlášení/nálezu,
                  dopočítá se z nastavení útulku.
                </span>
              )}
            </div>
          </div>

          {(isSurrender || v.legal_status === "owner_claimed") && (
            <p className="mt-3 text-xs text-ink-500">
              Údaje o původním majiteli a vzdání se práv doplníš po vytvoření na
              záložce „Příjem & právo".
            </p>
          )}
        </Section>
      )}

      {/* Identifikace — jen při příjmu */}
      {showIntake && (
        <Section
          title="Identifikace"
          icon="🏷️"
          subtitle="Čip, tetování nebo známka — nebo potvrď, že zvíře identifikaci nemá."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Číslo čipu">
              <Input
                value={v.chip_number}
                onChange={(e) => set("chip_number", e.target.value)}
                disabled={v.identification_none}
                className="admin-input"
              />
            </Field>
            <Field label="Tetování">
              <Input
                value={v.tattoo}
                onChange={(e) => set("tattoo", e.target.value)}
                disabled={v.identification_none}
                className="admin-input"
              />
            </Field>
            <Field label="Známka">
              <Input
                value={v.ear_tag}
                onChange={(e) => set("ear_tag", e.target.value)}
                disabled={v.identification_none}
                className="admin-input"
              />
            </Field>
          </div>
          <div className="mt-4">
            <CheckboxField
              label="Bez identifikace (neevidováno)"
              checked={v.identification_none}
              onChange={(c) =>
                setV((s) => ({
                  ...s,
                  identification_none: c,
                  chip_number: c ? "" : s.chip_number,
                  tattoo: c ? "" : s.tattoo,
                  ear_tag: c ? "" : s.ear_tag,
                }))
              }
            />
          </div>
        </Section>
      )}

      {/* Karanténa, dohled & umístění — jen při příjmu */}
      {showIntake && (
        <Section
          title="Karanténa, dohled & umístění"
          icon="🚧"
          subtitle="Veterinární režim při příjmu a kotec, kam zvíře umístíš."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Potřeba veterinární péče">
              <Select
                value={v.vet_care_need ?? ""}
                onChange={(val) =>
                  set("vet_care_need", (val || null) as AnimalVetCareNeed | null)
                }
                options={VET_CARE_OPTIONS}
              />
            </Field>
            <Field label="Režim dohledu">
              <Select
                value={v.supervision_status}
                onChange={(val) =>
                  pickSupervision(val as AnimalSupervisionStatus)
                }
                options={SUPERVISION_OPTIONS}
              />
            </Field>
            {v.supervision_status !== "released" && (
              <Field label="Plánované trvání karantény (dní)">
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={v.intake_quarantine_days ?? ""}
                  onChange={(e) =>
                    set(
                      "intake_quarantine_days",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="admin-input"
                />
              </Field>
            )}
          </div>
          {v.supervision_status !== "released" && (
            <div
              className={cn(
                "mt-3 rounded-2xl px-4 py-3 text-sm",
                SUPERVISION_STATUS_PILL[v.supervision_status],
              )}
            >
              {SUPERVISION_STATUS_HELP[v.supervision_status]}
              <span className="mt-1 block text-xs opacity-80">
                Příjem rovnou založí epizodu dohledu na záložce Karanténa
                (s plánovaným koncem podle trvání výše).
              </span>
            </div>
          )}

          <div className="mt-5 border-t border-ink-900/8 pt-5">
            <Label>Umístění (kotec)</Label>
            {kennels.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">
                Zatím nemáš žádné kotce. Vytvoř je v sekci Kotce — umístění
                doplníš později na záložce Ustájení.
              </p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => set("kennel_id", null)}
                  className={cn(
                    "rounded-2xl border-2 px-4 py-3 text-left transition-colors",
                    v.kennel_id === null
                      ? "border-meadow-500 bg-meadow-50"
                      : "border-ink-900/10 hover:border-ink-900/20",
                  )}
                >
                  <span className="font-semibold text-ink-900">Bez kotce</span>
                </button>
                {kennels.map((k) => {
                  const full = k.occupied >= k.capacity;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      disabled={full}
                      onClick={() => set("kennel_id", k.id)}
                      className={cn(
                        "rounded-2xl border-2 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        v.kennel_id === k.id
                          ? "border-meadow-500 bg-meadow-50"
                          : "border-ink-900/10 hover:border-ink-900/20",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink-900">
                          {k.name}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            full
                              ? "bg-peach-200 text-terracotta-600"
                              : "bg-sage-100 text-sage-700",
                          )}
                        >
                          {k.occupied}/{k.capacity}
                        </span>
                      </div>
                      {k.is_quarantine && (
                        <span className="mt-1 inline-block text-xs font-semibold text-terracotta-600">
                          Karanténa
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Photos */}
      <Section
        title="Fotky"
        icon="📷"
        subtitle="Hlavní fotka se zobrazí v katalogu i na kartě zvířete."
      >
        <div className="space-y-4">
          <div>
            <Label>Hlavní fotka</Label>
            <div className="mt-2 flex items-center gap-4">
              {v.primary_photo_url ? (
                <div className="relative size-28 overflow-hidden rounded-2xl ring-1 ring-ink-900/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.primary_photo_url}
                    alt="náhled"
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => set("primary_photo_url", "")}
                    className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-ink-900/70 text-cream"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <UploadButton
                  uploading={uploading}
                  onFiles={(f) => uploadFiles(f, "primary")}
                />
              )}
            </div>
          </div>

          <div>
            <Label>Galerie (volitelné)</Label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {v.gallery.map((url) => (
                <div
                  key={url}
                  className="relative size-20 overflow-hidden rounded-xl ring-1 ring-ink-900/10"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "gallery",
                        v.gallery.filter((g) => g !== url),
                      )
                    }
                    className="absolute right-0.5 top-0.5 inline-flex size-5 items-center justify-center rounded-full bg-ink-900/70 text-cream"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              <UploadButton
                uploading={uploading}
                multiple
                onFiles={(f) => uploadFiles(f, "gallery")}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Description — jen v profilu (při příjmu se nevyplňuje) */}
      {!showIntake && (
      <Section
        title="Popis & příběh"
        icon="✍️"
        subtitle="Krátký popis pro katalog a delší příběh na kartu zvířete."
      >
        <div className="space-y-4">
          {/* AI návrh textů — vyplní se z údajů zvířete, člověk schválí. */}
          <div className="rounded-2xl bg-meadow-50/60 p-4 ring-1 ring-meadow-300/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <Sparkles className="size-4 text-meadow-600" />
                Napsat texty pomocí AI
              </div>
              <ZozioButton
                type="button"
                variant="outline"
                size="sm"
                onClick={generateCopy}
                disabled={aiPending || !v.name.trim()}
              >
                {aiPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Generuji…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Vygenerovat návrh
                  </>
                )}
              </ZozioButton>
            </div>
            <p className="mt-2 text-xs text-ink-500">
              AI vytvoří návrh popisu, příběhu a povahových štítků z vyplněných
              údajů. Nic se neuloží automaticky — návrh nejdřív schválíš.
            </p>
            {!v.name.trim() && (
              <p className="mt-1 text-xs text-terracotta-600">
                Nejdřív vyplň jméno zvířete.
              </p>
            )}
            {aiError && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-terracotta-600">
                <AlertCircle className="size-3.5" /> {aiError}
              </p>
            )}
            {aiDraft && (
              <div className="mt-3 space-y-3 rounded-xl bg-cream p-3 ring-1 ring-ink-900/8">
                <div>
                  <p className="text-xs font-semibold text-ink-500">Krátký popis</p>
                  <p className="text-sm text-ink-900">{aiDraft.description}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-500">Nadpis příběhu</p>
                  <p className="text-sm font-medium text-ink-900">
                    {aiDraft.story_title}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-500">Příběh</p>
                  <p className="whitespace-pre-line text-sm text-ink-900">
                    {aiDraft.story_text}
                  </p>
                </div>
                {aiDraft.personality_tags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-ink-500">Štítky</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {aiDraft.personality_tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-sage-50 px-2.5 py-0.5 text-xs font-medium text-ink-700"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <ZozioButton
                    type="button"
                    variant="meadow"
                    size="sm"
                    onClick={applyAiDraft}
                  >
                    <Check className="size-4" /> Použít návrh
                  </ZozioButton>
                  <ZozioButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAiDraft(null)}
                  >
                    <X className="size-4" /> Zahodit
                  </ZozioButton>
                </div>
              </div>
            )}
          </div>
          <Field label="Krátký popis" full>
            <textarea
              value={v.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="admin-input resize-y"
              placeholder="Bobík je veselý kluk, který…"
            />
          </Field>
          <Field label="Nadpis příběhu" full>
            <Input
              value={v.story_title}
              onChange={(e) => set("story_title", e.target.value)}
              className="admin-input"
            />
          </Field>
          <Field label="Příběh" full>
            <textarea
              value={v.story_text}
              onChange={(e) => set("story_text", e.target.value)}
              rows={5}
              className="admin-input resize-y"
            />
          </Field>
        </div>
      </Section>
      )}

      {/* Health */}
      <Section
        title="Zdraví"
        icon="🩺"
        subtitle={
          showIntake
            ? "Pohledový (vizuální) zdravotní stav zvířete při příjmu. Čipování se převezme z identifikace."
            : "Očkování, kastrace, čipování a zdravotní stav."
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {!showIntake && (
            <>
              <CheckboxField
                label="Očkováno"
                checked={v.is_vaccinated}
                onChange={(c) => set("is_vaccinated", c)}
              />
              <CheckboxField
                label="Kastrováno"
                checked={v.is_neutered === true}
                onChange={(c) => set("is_neutered", c)}
              />
              <CheckboxField
                label="Čipováno"
                checked={v.is_chipped === true}
                onChange={(c) => set("is_chipped", c)}
              />
            </>
          )}
          <Field label={showIntake ? "Pohledový stav při příjmu" : "Zdravotní stav"}>
            <Select
              value={v.health_status}
              onChange={(val) =>
                set("health_status", val as typeof v.health_status)
              }
              options={HEALTH_OPTIONS}
            />
          </Field>
          {showIntake && (
            <Field label="Okamžitý stav při příjmu" full>
              <textarea
                value={v.intake_condition}
                onChange={(e) => set("intake_condition", e.target.value)}
                rows={2}
                placeholder="Celkový a zdravotní stav při převzetí — zranění, parazité, kondice…"
                className="admin-input resize-y"
              />
            </Field>
          )}
          <Field label="Zdravotní nálezy / poznámky" full>
            <textarea
              value={v.health_notes}
              onChange={(e) => set("health_notes", e.target.value)}
              rows={2}
              className="admin-input resize-y"
            />
          </Field>
        </div>
      </Section>

      {/* Behavior & lifestyle — jen v profilu (při příjmu se nevyplňuje) */}
      {!showIntake && (
      <Section
        title="Povaha & lifestyle"
        icon="🐶"
        subtitle="Snášenlivost, energie a vhodné prostředí — pomáhá s párováním."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Vhodný k dětem">
            <Select
              value={v.good_with_children}
              onChange={(val) =>
                set("good_with_children", val as Compat)
              }
              options={COMPAT_OPTS}
            />
          </Field>
          <Field label="Vhodný k psům">
            <Select
              value={v.good_with_dogs}
              onChange={(val) => set("good_with_dogs", val as Compat)}
              options={COMPAT_OPTS}
            />
          </Field>
          <Field label="Vhodný ke kočkám">
            <Select
              value={v.good_with_cats}
              onChange={(val) => set("good_with_cats", val as Compat)}
              options={COMPAT_OPTS}
            />
          </Field>
          <Field label="Energie">
            <Select
              value={v.energy_level ?? ""}
              onChange={(val) =>
                set("energy_level", (val || null) as typeof v.energy_level)
              }
              options={[
                ["", "—"],
                ["low", "Klidná"],
                ["medium", "Vyvážená"],
                ["high", "Aktivní"],
              ]}
            />
          </Field>
          <Field label="Náročnost chovu">
            <Select
              value={v.care_difficulty ?? ""}
              onChange={(val) =>
                set("care_difficulty", (val || null) as typeof v.care_difficulty)
              }
              options={[
                ["", "—"],
                ["easy", "Nízká"],
                ["medium", "Střední"],
                ["high", "Vysoká"],
              ]}
            />
          </Field>
          <Field label="Vhodné do">
            <Select
              value={v.suitable_housing ?? ""}
              onChange={(val) =>
                set("suitable_housing", (val || null) as typeof v.suitable_housing)
              }
              options={[
                ["", "—"],
                ["apartment", "Byt"],
                ["house", "Dům"],
                ["both", "Byt i dům"],
              ]}
            />
          </Field>
        </div>

        {/* Tags */}
        <Field label="Štítky" full>
          <div className="flex flex-wrap gap-1.5">
            {v.personality_tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-3 py-1 text-sm font-semibold text-sage-700"
              >
                {t}
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "personality_tags",
                      v.personality_tags.filter((x) => x !== t),
                    )
                  }
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Přidej štítek + Enter"
              className="admin-input"
            />
            <ZozioButton type="button" variant="outline" size="md" onClick={addTag}>
              Přidat
            </ZozioButton>
          </div>
        </Field>
      </Section>
      )}

      {/* Personál & poznámky — jen při příjmu */}
      {showIntake && (
        <Section
          title="Personál & poznámky"
          icon="📝"
          subtitle="Kdo příjem provedl a další evidence (obec, registr nalezenců)."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Přijal (jméno / role)">
              <Input
                value={v.intake_staff}
                onChange={(e) => set("intake_staff", e.target.value)}
                placeholder="Jana Nováková, ošetřovatelka"
                className="admin-input"
              />
            </Field>
            <Field label="Evidenční číslo obce (volitelné)">
              <Input
                value={v.municipality_ref}
                onChange={(e) => set("municipality_ref", e.target.value)}
                className="admin-input"
              />
            </Field>
            <Field label="Registr nalezenců (volitelné)">
              <Input
                value={v.registry_name}
                onChange={(e) => set("registry_name", e.target.value)}
                placeholder="Název registru, pokud nahlášeno"
                className="admin-input"
              />
            </Field>
            <Field label="Obecné poznámky" full>
              <textarea
                value={v.intake_notes}
                onChange={(e) => set("intake_notes", e.target.value)}
                rows={2}
                className="admin-input resize-y"
              />
            </Field>
          </div>
        </Section>
      )}

      {/* Status */}
      <Section
        title={showIntake ? "Zveřejnění & adopce" : "Stav adopce"}
        icon="🏠"
        subtitle="Zveřejnění a viditelnost zvířete v adopčním katalogu."
      >
        {showIntake ? (
          <div className="space-y-4">
            <CheckboxField
              label="Zveřejnit automaticky, jakmile to půjde"
              checked={v.auto_publish}
              onChange={(c) => set("auto_publish", c)}
            />
            <p className="-mt-1 px-1 text-xs text-ink-500">
              Zvíře se založí ve stavu <strong>Příjem</strong>. Se zapnutou
              automatikou se přepne na <strong>K adopci</strong> a zveřejní,
              jakmile projde připraveností níže (vyplněný příjem + uzavřená
              karanténa) — typicky po skončení karantény. Bez automatiky ho
              zveřejníš ručně přepínačem stavu.
            </p>

            {/* Živý náhled připravenosti */}
            <div
              className={cn(
                "rounded-2xl px-4 py-3 text-sm ring-1 ring-inset",
                publishReady
                  ? "bg-meadow-100 text-meadow-700 ring-meadow-300"
                  : "bg-peach-100 text-terracotta-600 ring-peach-300",
              )}
            >
              <div className="flex items-center gap-2 font-semibold">
                {publishReady ? (
                  <Check className="size-4 shrink-0" />
                ) : (
                  <AlertCircle className="size-4 shrink-0" />
                )}
                {publishReady
                  ? v.auto_publish
                    ? "Připraveno — zvíře se po vytvoření rovnou zveřejní."
                    : "Připraveno ke zveřejnění (automatika je vypnutá)."
                  : "Zatím nelze zveřejnit — chybí:"}
              </div>
              {!publishReady && (
                <ul className="mt-2 space-y-1 text-ink-700">
                  {publishBlockers.map((b) => (
                    <li key={b.id} className="flex items-start gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-terracotta-600" />
                      <span>
                        <strong>{b.label}</strong> — {b.hint}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {publishWarnings.length > 0 && (
              <div className="rounded-2xl bg-sunshine-200/60 px-4 py-3 text-sm text-ink-700 ring-1 ring-inset ring-sunshine-600/30">
                <div className="flex items-center gap-2 font-semibold text-sunshine-600">
                  <TriangleAlert className="size-4 shrink-0" />
                  Doporučení (nebrání zveřejnění)
                </div>
                <ul className="mt-2 space-y-1">
                  {publishWarnings.map((w) => (
                    <li key={w.id} className="flex items-start gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sunshine-600" />
                      <span>{w.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {v.legal_status === "in_protection" && (
              <div className="rounded-2xl bg-sage-50 px-4 py-3 text-sm text-ink-700 ring-1 ring-inset ring-ink-900/8">
                Zvíře je v <strong>ochranné lhůtě</strong>. Smí se inzerovat,
                ale <strong>adopční formulář bude blokovaný</strong> až do konce
                lhůty
                {v.protection_until ? ` (${v.protection_until})` : ""} —
                původní majitel se ještě může přihlásit.
              </div>
            )}

            <CheckboxField
              label="Naléhavý případ"
              checked={v.is_urgent}
              onChange={(c) => set("is_urgent", c)}
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Stav">
              <Select
                value={v.adoption_status}
                onChange={(val) =>
                  set("adoption_status", val as typeof v.adoption_status)
                }
                options={[
                  ["intake", "Příjem"],
                  ["available", "K adopci"],
                  ["on_hold", "Pozastaveno"],
                  ["transferred", "Převedeno"],
                  ["unpublished", "Nezveřejněno"],
                ]}
              />
            </Field>
            <CheckboxField
              label="Naléhavý případ"
              checked={v.is_urgent}
              onChange={(c) => set("is_urgent", c)}
            />
          </div>
        )}
      </Section>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl bg-peach-100 p-4 text-sm text-terracotta-600 ring-1 ring-inset ring-peach-300">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-ink-900/8 bg-sage-50/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <ZozioButton
          type="submit"
          variant="meadow"
          size="lg"
          disabled={isPending || uploading || !v.name}
        >
          {isPending ? "Ukládám…" : submitLabel}
        </ZozioButton>
      </div>
    </form>
  );
}

type Compat = "yes" | "no" | "unknown";
const COMPAT_OPTS: [string, string][] = [
  ["unknown", "Nevíme"],
  ["yes", "Ano"],
  ["no", "Ne"],
];

function Section({
  title,
  subtitle,
  icon,
  collapsible,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  /** Sbalitelná (volitelná) sekce — vykreslí se jako rozbalovací panel. */
  collapsible?: boolean;
  children: React.ReactNode;
}) {
  const header = (
    <>
      {icon && (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-lg">
          {icon}
        </span>
      )}
      <div>
        <h2 className="font-display text-xl font-bold leading-tight text-ink-900">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
    </>
  );

  if (collapsible) {
    return (
      <details className="group rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <summary className="flex cursor-pointer list-none items-start gap-3">
          {header}
          <ChevronDown className="ml-auto mt-1 size-5 shrink-0 text-ink-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-5">{children}</div>
      </details>
    );
  }

  return (
    <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
      <div className="mb-5 flex items-start gap-3">{header}</div>
      {children}
    </section>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", full && "sm:col-span-full")}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="admin-input"
    >
      {options.map(([val, label]) => (
        <option key={val} value={val}>
          {label}
        </option>
      ))}
    </select>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-cream-warm px-4 py-3 ring-1 ring-ink-900/8">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 rounded accent-meadow-500"
      />
      <span className="text-sm font-semibold text-ink-700">{label}</span>
    </label>
  );
}

function UploadButton({
  uploading,
  multiple,
  onFiles,
}: {
  uploading: boolean;
  multiple?: boolean;
  onFiles: (files: FileList) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink-900/15 text-ink-400 transition hover:border-meadow-500 hover:text-meadow-700",
        uploading && "pointer-events-none opacity-60",
      )}
    >
      {uploading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <>
          <Upload className="size-5" />
          <span className="text-[10px] font-semibold">Nahrát</span>
        </>
      )}
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
