"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZozioButton } from "@/components/zozio/button";

interface AdoptFiltersProps {
  initialQ: string;
  initialSpecies: string;
  initialSize: string;
  initialCity: string;
}

export function AdoptFilters({
  initialQ,
  initialSpecies,
  initialSize,
  initialCity,
}: AdoptFiltersProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      const s = typeof v === "string" ? v.trim() : "";
      if (s) params.set(k, s);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/adopt?${qs}` : "/adopt");
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(e.currentTarget);
      }}
      className="rounded-3xl bg-cream p-5 shadow-soft-sm ring-1 ring-ink-900/8 md:p-6"
    >
      <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="q">Hledat</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <Input
              id="q"
              name="q"
              defaultValue={initialQ}
              placeholder="Jméno, plemeno, povaha..."
              className="h-12 rounded-xl border-ink-900/15 bg-cream-warm pl-10 text-base"
            />
          </div>
        </div>

        <SelectField
          name="species"
          label="Druh"
          defaultValue={initialSpecies}
          options={[
            { value: "", label: "Vše" },
            { value: "dog", label: "Pes" },
            { value: "cat", label: "Kočka" },
            { value: "rabbit", label: "Králík" },
            { value: "other", label: "Jiné" },
          ]}
        />

        <SelectField
          name="size"
          label="Velikost"
          defaultValue={initialSize}
          options={[
            { value: "", label: "Vše" },
            { value: "small", label: "Malé" },
            { value: "medium", label: "Střední" },
            { value: "large", label: "Velké" },
            { value: "xlarge", label: "Obří" },
          ]}
        />

        <div className="space-y-2">
          <Label htmlFor="city">Město</Label>
          <Input
            id="city"
            name="city"
            defaultValue={initialCity}
            placeholder="Praha, Brno..."
            className="h-12 rounded-xl border-ink-900/15 bg-cream-warm text-base"
          />
        </div>

        <ZozioButton
          type="submit"
          variant="meadow"
          size="lg"
          disabled={isPending}
          className="h-12 md:mt-0"
        >
          {isPending ? "Hledám…" : "Hledat"}
        </ZozioButton>
      </div>

      {/* Persist page=1 when filters change */}
      <input type="hidden" name="page" value="" readOnly />
    </form>
  );
}

function SelectField({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="h-12 w-full rounded-xl border border-ink-900/15 bg-cream-warm px-3 text-base text-ink-900 outline-none focus:border-meadow-500 focus:ring-4 focus:ring-meadow-300/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
