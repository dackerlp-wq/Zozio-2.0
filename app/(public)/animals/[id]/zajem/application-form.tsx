"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Heart } from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface Prefill {
  name: string;
  email: string;
  phone: string;
  city: string;
}

const FIELD = "mt-1.5 h-11 rounded-xl border-ink-900/15 bg-cream";

export function ApplicationForm({
  animalId,
  animalName,
  prefill,
  foster = false,
}: {
  animalId: string;
  animalName: string;
  prefill: Prefill;
  foster?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-3xl bg-meadow-100 p-8 text-center ring-1 ring-meadow-300/40">
        <CheckCircle2 className="mx-auto size-12 text-meadow-600" />
        <h2 className="mt-4 font-display text-2xl font-bold text-ink-900">
          Žádost odeslána!
        </h2>
        <p className="mt-2 text-ink-700">
          Útulek dostal tvůj zájem o {animalName} a brzy se ti ozve na zadaný
          e-mail nebo telefon.
        </p>
        <ZozioButton asChild variant="meadow" size="md" className="mt-6">
          <Link href="/adopt">Procházet další zvířata</Link>
        </ZozioButton>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);

    const payload = {
      animal_id: animalId,
      applicant_name: String(fd.get("name") ?? ""),
      applicant_email: String(fd.get("email") ?? ""),
      applicant_phone: String(fd.get("phone") ?? ""),
      applicant_city: String(fd.get("city") ?? ""),
      applicant_message:
        (foster ? "[Nabídka dočasné péče] " : "") + String(fd.get("message") ?? ""),
      website: String(fd.get("website") ?? ""), // honeypot
      applicant_data: {
        housing_type: String(fd.get("housing_type") ?? ""),
        experience: String(fd.get("experience") ?? ""),
        has_garden: fd.get("has_garden") === "on",
        has_children: fd.get("has_children") === "on",
        has_pets: fd.get("has_pets") === "on",
        intent: foster ? "foster" : "adoption",
      },
    };

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Něco se pokazilo. Zkus to prosím znovu.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Nepodařilo se odeslat. Zkontroluj připojení a zkus to znovu.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Honeypot — skryté před lidmi */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label>
          Nevyplňuj
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Jméno a příjmení *</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={prefill.name}
            placeholder="Jana Nováková"
            className={FIELD}
          />
        </div>
        <div>
          <Label htmlFor="email">E-mail *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={prefill.email}
            placeholder="jana@email.cz"
            className={FIELD}
          />
        </div>
        <div>
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={prefill.phone}
            placeholder="+420 …"
            className={FIELD}
          />
        </div>
        <div>
          <Label htmlFor="city">Město</Label>
          <Input
            id="city"
            name="city"
            defaultValue={prefill.city}
            placeholder="Praha"
            className={FIELD}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="housing_type">Kde bydlíš?</Label>
          <select
            id="housing_type"
            name="housing_type"
            defaultValue=""
            className={`${FIELD} w-full px-3 text-sm`}
          >
            <option value="">Neuvedeno</option>
            <option value="apartment">Byt</option>
            <option value="house">Dům</option>
            <option value="other">Jiné</option>
          </select>
        </div>
        <div>
          <Label htmlFor="experience">Zkušenosti se zvířaty</Label>
          <select
            id="experience"
            name="experience"
            defaultValue=""
            className={`${FIELD} w-full px-3 text-sm`}
          >
            <option value="">Neuvedeno</option>
            <option value="none">Žádné</option>
            <option value="some">Nějaké</option>
            <option value="experienced">Bohaté</option>
          </select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-700">
          Doplňující informace
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <CheckboxLabel name="has_garden" label="Mám zahradu" />
          <CheckboxLabel name="has_children" label="Mám děti" />
          <CheckboxLabel name="has_pets" label="Mám jiná zvířata" />
        </div>
      </fieldset>

      <div>
        <Label htmlFor="message">Pár slov o sobě</Label>
        <textarea
          id="message"
          name="message"
          rows={4}
          placeholder={`Proč by ses chtěl${""} stát novým domovem pro ${animalName}?`}
          className="mt-1.5 w-full rounded-xl border border-ink-900/15 bg-cream px-3 py-2.5 text-sm outline-none focus-visible:border-meadow-500 focus-visible:ring-3 focus-visible:ring-meadow-300/40"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-terracotta-500/10 px-4 py-3 text-sm font-medium text-terracotta-600">
          {error}
        </p>
      )}

      <ZozioButton
        type="submit"
        variant="meadow"
        size="lg"
        className="w-full"
        disabled={submitting}
      >
        <Heart /> {submitting ? "Odesílám…" : "Odeslat zájem o adopci"}
      </ZozioButton>

      <p className="text-center text-xs text-ink-500">
        Odesláním souhlasíš s předáním kontaktních údajů útulku za účelem adopce.
      </p>
    </form>
  );
}

function CheckboxLabel({ name, label }: { name: string; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700">
      <input
        type="checkbox"
        name={name}
        className="size-4 rounded border-ink-900/25 text-meadow-500 focus:ring-meadow-300"
      />
      {label}
    </label>
  );
}
