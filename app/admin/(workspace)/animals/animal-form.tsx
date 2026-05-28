"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Loader2, Upload, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZozioButton } from "@/components/zozio/button";
import { cn } from "@/lib/utils";
import type { AnimalFormValues } from "./actions";

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
};

interface AnimalFormProps {
  initial?: Partial<AnimalFormValues>;
  onSubmit: (values: AnimalFormValues) => Promise<{ error?: string } | void>;
  submitLabel: string;
}

export function AnimalForm({ initial, onSubmit, submitLabel }: AnimalFormProps) {
  const [v, setV] = useState<AnimalFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const set = <K extends keyof AnimalFormValues>(
    key: K,
    val: AnimalFormValues[K],
  ) => setV((s) => ({ ...s, [key]: val }));

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
      {/* Photos */}
      <Section title="Fotky">
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

      {/* Basic */}
      <Section title="Základní údaje">
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
        </div>
      </Section>

      {/* Description */}
      <Section title="Popis & příběh">
        <div className="space-y-4">
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

      {/* Health */}
      <Section title="Zdraví">
        <div className="grid gap-4 sm:grid-cols-3">
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
          <Field label="Zdravotní stav">
            <Select
              value={v.health_status}
              onChange={(val) =>
                set("health_status", val as typeof v.health_status)
              }
              options={[
                ["healthy", "Zdravé"],
                ["treated", "Léčené"],
                ["special_needs", "Handicap / speciální péče"],
              ]}
            />
          </Field>
          <Field label="Zdravotní poznámky" full>
            <textarea
              value={v.health_notes}
              onChange={(e) => set("health_notes", e.target.value)}
              rows={2}
              className="admin-input resize-y"
            />
          </Field>
        </div>
      </Section>

      {/* Behavior & lifestyle */}
      <Section title="Povaha & lifestyle">
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

      {/* Status */}
      <Section title="Stav adopce">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stav">
            <Select
              value={v.adoption_status}
              onChange={(val) =>
                set("adoption_status", val as typeof v.adoption_status)
              }
              options={[
                ["available", "K adopci"],
                ["reserved", "Rezervováno"],
                ["adopted", "Adoptováno"],
                ["on_hold", "Pozastaveno"],
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
      <h2 className="mb-5 font-display text-xl font-bold text-ink-900">
        {title}
      </h2>
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
