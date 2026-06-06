"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ApplicationQuestionRow } from "@/types/database";

export interface Prefill {
  name: string;
  email: string;
  phone: string;
  city: string;
  housing?: string; // "apartment" | "house" | "other" | ""
  experience?: string; // "none" | "some" | "experienced" | ""
  has_garden?: boolean;
  has_children?: boolean;
  has_pets?: boolean;
}

const HOUSING = [
  { v: "apartment", l: "Byt" },
  { v: "house", l: "Dům" },
  { v: "other", l: "Jiné" },
];
const EXPERIENCE = [
  { v: "none", l: "Žádné" },
  { v: "some", l: "Nějaké" },
  { v: "experienced", l: "Bohaté" },
];

export function ApplicationForm({
  animalId,
  animalName,
  prefill,
  foster: initialFoster = false,
  fosterEligible = false,
  questions = [],
  prefilledFromAI = false,
}: {
  animalId: string;
  animalName: string;
  prefill: Prefill;
  foster?: boolean;
  fosterEligible?: boolean;
  questions?: ApplicationQuestionRow[];
  prefilledFromAI?: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [intent, setIntent] = useState<"adoption" | "foster">(initialFoster ? "foster" : "adoption");
  const [housing, setHousing] = useState(prefill.housing ?? "");
  const [experience, setExperience] = useState(prefill.experience ?? "");
  const [garden, setGarden] = useState(!!prefill.has_garden);
  const [children, setChildren] = useState(!!prefill.has_children);
  const [pets, setPets] = useState(!!prefill.has_pets);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [gdpr, setGdpr] = useState(false);
  const [aiNotice, setAiNotice] = useState(prefilledFromAI);

  // Předvyplnění z AI kvízu uloženého v prohlížeči (nepřihlášený návštěvník).
  useEffect(() => {
    if (prefill.housing || prefill.experience) return; // účet už předvyplnil
    try {
      if (localStorage.getItem("zozio.match.active") === "0") return;
      const raw = localStorage.getItem("zozio.match.prefs");
      if (!raw) return;
      const p = JSON.parse(raw) as {
        housing?: string;
        experience?: string;
        has_garden?: boolean;
        has_children?: boolean;
        has_pets?: boolean;
      };
      if (p.housing) setHousing(p.housing);
      if (p.experience) setExperience(p.experience);
      if (typeof p.has_garden === "boolean") setGarden(p.has_garden);
      if (typeof p.has_children === "boolean") setChildren(p.has_children);
      if (typeof p.has_pets === "boolean") setPets(p.has_pets);
      if (p.housing || p.experience) setAiNotice(true);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) {
    return (
      <div className="rounded-3xl bg-fern-50 p-8 text-center ring-1 ring-fern-600/20">
        <CheckCircle2 className="mx-auto size-12 text-fern-600" />
        <h2 className="mt-4 font-display text-2xl font-bold text-ink-900">Hotovo, odesláno!</h2>
        <p className="mt-2 text-ink-600">
          Útulek dostal tvůj {intent === "foster" ? "zájem o dočasnou péči" : "zájem"} o {animalName}{" "}
          a ozve se ti na e-mail. Stav uvidíš v sekci Můj prostor.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/profil" className="rounded-pill bg-meadow-500 px-5 py-2.5 text-sm font-bold text-cream hover:bg-meadow-600">
            Moje žádosti
          </Link>
          <Link href="/adopt" className="rounded-pill border border-sand2 px-5 py-2.5 text-sm font-bold text-ink-600 hover:bg-cream-warm">
            Procházet další zvířata
          </Link>
        </div>
      </div>
    );
  }

  function setCustomVal(id: string, val: string) {
    setCustom((c) => ({ ...c, [id]: val }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!gdpr) {
      setError("Pro odeslání potřebujeme tvůj souhlas s předáním údajů útulku.");
      return;
    }
    // Povinné vlastní otázky.
    const missing = questions.find((q) => q.required && !(custom[q.id] ?? "").trim());
    if (missing) {
      setError(`Vyplň prosím: ${missing.label}`);
      return;
    }

    setSubmitting(true);
    const form = e.currentTarget;
    const fd = new FormData(form);

    const customAnswers = questions
      .map((q) => ({ label: q.label, answer: (custom[q.id] ?? "").trim() }))
      .filter((c) => c.answer);

    const payload = {
      animal_id: animalId,
      applicant_name: String(fd.get("name") ?? ""),
      applicant_email: String(fd.get("email") ?? ""),
      applicant_phone: String(fd.get("phone") ?? ""),
      applicant_city: String(fd.get("city") ?? ""),
      applicant_message:
        (intent === "foster" ? "[Nabídka dočasné péče] " : "") + String(fd.get("message") ?? ""),
      website: String(fd.get("website") ?? ""), // honeypot
      applicant_data: {
        housing_type: housing,
        experience,
        has_garden: garden,
        has_children: children,
        has_pets: pets,
        intent,
        custom: customAnswers,
        gdpr_consent_at: new Date().toISOString(),
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
      router.refresh(); // ať se případně promítne do počtu zájemců
    } catch {
      setError("Nepodařilo se odeslat. Zkontroluj připojení a zkus to znovu.");
      setSubmitting(false);
    }
  }

  const accent = intent === "foster" ? "sunshine" : "coral";

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {/* Honeypot */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label>
          Nevyplňuj
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {aiNotice && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-ink-900 px-4 py-3 text-sm font-bold text-cream">
          <Sparkles className="size-4 text-sunshine-400" />
          Předvyplnili jsme to z tvého AI matchingu — uprav, co je potřeba.
        </div>
      )}

      {/* Typ zájmu — jen u foster zvířat */}
      {fosterEligible && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setIntent("adoption")}
            className={cn(
              "rounded-2xl border-[1.5px] p-3.5 text-center transition",
              intent === "adoption" ? "border-terracotta-500 bg-peach-100" : "border-sand2",
            )}
          >
            <div className="font-display font-bold text-ink-900">❤️ Adopce</div>
            <div className="text-xs text-ink-500">Trvalý domov</div>
          </button>
          <button
            type="button"
            onClick={() => setIntent("foster")}
            className={cn(
              "rounded-2xl border-[1.5px] p-3.5 text-center transition",
              intent === "foster" ? "border-sunshine-400 bg-sunshine-200/40" : "border-sand2",
            )}
          >
            <div className="font-display font-bold text-ink-900">🏡 Dočasná péče</div>
            <div className="text-xs text-ink-500">Na přechodnou dobu</div>
          </button>
        </div>
      )}

      <Group title="Kontakt">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jméno a příjmení" required>
            <input name="name" required defaultValue={prefill.name} placeholder="Jana Nováková" className={INPUT} />
          </Field>
          <Field label="E-mail" required>
            <input name="email" type="email" required defaultValue={prefill.email} placeholder="jana@email.cz" className={INPUT} />
          </Field>
          <Field label="Telefon">
            <input name="phone" type="tel" defaultValue={prefill.phone} placeholder="+420 …" className={INPUT} />
          </Field>
          <Field label="Město">
            <input name="city" defaultValue={prefill.city} placeholder="Praha" className={INPUT} />
          </Field>
        </div>
      </Group>

      <Group title="O tobě">
        <Field label="Kde bydlíš?">
          <Pills options={HOUSING} value={housing} onChange={setHousing} />
        </Field>
        <Field label="Zkušenosti se zvířaty">
          <Pills options={EXPERIENCE} value={experience} onChange={setExperience} />
        </Field>
        <Field label="Doplňující informace">
          <div className="flex flex-wrap gap-2.5">
            <Check on={garden} onClick={() => setGarden((b) => !b)} label="Mám zahradu" />
            <Check on={children} onClick={() => setChildren((b) => !b)} label="Mám děti" />
            <Check on={pets} onClick={() => setPets((b) => !b)} label="Mám jiná zvířata" />
          </div>
        </Field>
      </Group>

      {questions.length > 0 && (
        <Group title="Otázky od útulku">
          {questions.map((q) => (
            <Field key={q.id} label={q.label} required={q.required}>
              {q.field_type === "textarea" ? (
                <textarea
                  rows={3}
                  value={custom[q.id] ?? ""}
                  onChange={(e) => setCustomVal(q.id, e.target.value)}
                  className={INPUT}
                />
              ) : q.field_type === "boolean" ? (
                <Pills
                  options={[
                    { v: "ano", l: "Ano" },
                    { v: "ne", l: "Ne" },
                  ]}
                  value={custom[q.id] ?? ""}
                  onChange={(val) => setCustomVal(q.id, val)}
                />
              ) : q.field_type === "select" ? (
                <Pills
                  options={q.options.map((o) => ({ v: o, l: o }))}
                  value={custom[q.id] ?? ""}
                  onChange={(val) => setCustomVal(q.id, val)}
                />
              ) : (
                <input
                  value={custom[q.id] ?? ""}
                  onChange={(e) => setCustomVal(q.id, e.target.value)}
                  className={INPUT}
                />
              )}
            </Field>
          ))}
        </Group>
      )}

      <Group title="Pár slov o sobě">
        <textarea
          name="message"
          rows={4}
          placeholder={`Napiš útulku, proč právě ${animalName} a jak by u tebe žil${""}…`}
          className={INPUT}
        />
      </Group>

      {/* GDPR — vědomý souhlas */}
      <button
        type="button"
        onClick={() => setGdpr((b) => !b)}
        className="flex w-full items-start gap-3 text-left"
        aria-pressed={gdpr}
      >
        <span
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-[1.5px] text-sm",
            gdpr ? "border-fern-600 bg-fern-600 text-cream" : "border-sand2",
          )}
        >
          {gdpr ? "✓" : ""}
        </span>
        <span className="text-[13px] font-semibold text-ink-600">
          Souhlasím s předáním svých kontaktních údajů útulku za účelem adopce.{" "}
          <Link href="/zasady-soukromi" className="font-bold text-terracotta-600 hover:underline">
            Zásady soukromí
          </Link>
        </span>
      </button>

      {error && (
        <p className="rounded-2xl bg-peach-100 px-4 py-3 text-sm font-semibold text-terracotta-600 ring-1 ring-terracotta-400/30">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={cn(
          "w-full rounded-pill px-6 py-4 text-base font-bold text-cream shadow-soft-md disabled:opacity-50",
          accent === "sunshine" ? "bg-sunshine-500 hover:bg-sunshine-600 text-ink-900" : "bg-terracotta-500 hover:bg-terracotta-600",
        )}
      >
        {submitting
          ? "Odesílám…"
          : intent === "foster"
            ? "Nabídnout dočasnou péči →"
            : "Odeslat zájem o adopci →"}
      </button>
      <p className="text-center text-xs text-ink-400">Nic tě nezavazuje — je to první krok k seznámení.</p>
    </form>
  );
}

const INPUT =
  "w-full rounded-xl border border-sand2 bg-cream px-3.5 py-2.5 text-sm outline-none focus:border-terracotta-500 focus:bg-card";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-ink-500">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold text-ink-600">
        {label} {required && <span className="text-terracotta-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function Pills({
  options,
  value,
  onChange,
}: {
  options: { v: string; l: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(value === o.v ? "" : o.v)}
          className={cn(
            "rounded-pill border-[1.5px] px-4 py-2 text-sm font-bold transition",
            value === o.v ? "border-terracotta-500 bg-terracotta-500 text-cream" : "border-sand2 text-ink-600 hover:border-terracotta-400",
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-pill border-[1.5px] px-4 py-2 text-sm font-bold transition",
        on ? "border-fern-600 bg-fern-50 text-fern-700" : "border-sand2 text-ink-600",
      )}
    >
      <span className={cn("flex size-4 items-center justify-center rounded border text-[10px]", on ? "border-fern-600 bg-fern-600 text-cream" : "border-sand2")}>
        {on ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}
