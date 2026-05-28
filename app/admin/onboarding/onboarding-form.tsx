"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZozioButton } from "@/components/zozio/button";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slug";

const KRAJE = [
  "Praha",
  "Středočeský",
  "Jihočeský",
  "Plzeňský",
  "Karlovarský",
  "Ústecký",
  "Liberecký",
  "Královéhradecký",
  "Pardubický",
  "Vysočina",
  "Jihomoravský",
  "Olomoucký",
  "Zlínský",
  "Moravskoslezský",
];

const STEPS = ["Identita", "Kontakt", "Lokalita", "Profil", "Souhrn"] as const;

interface FormState {
  type: "shelter" | "rescue_station";
  name: string;
  slug: string;
  legal_name: string;
  ico: string;
  email: string;
  phone: string;
  website: string;
  region: string;
  city: string;
  address: string;
  description: string;
  logo_url: string;
  hero_url: string;
  facebook_url: string;
  instagram_url: string;
}

const fieldClass = "h-12 rounded-xl border-ink-900/15 bg-cream-warm text-base";

export function OnboardingForm({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [slugTouched, setSlugTouched] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "hero" | null>(null);

  const [v, setV] = useState<FormState>({
    type: "shelter",
    name: "",
    slug: "",
    legal_name: "",
    ico: "",
    email: userEmail,
    phone: "",
    website: "",
    region: "",
    city: "",
    address: "",
    description: "",
    logo_url: "",
    hero_url: "",
    facebook_url: "",
    instagram_url: "",
  });

  const set = <K extends keyof FormState>(k: K, val: FormState[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  const effectiveSlug = slugTouched ? v.slug : slugify(v.name);
  const canContinue = step !== 0 || (v.name.trim() && effectiveSlug);

  const upload = async (file: File, target: "logo_url" | "hero_url") => {
    setUploading(target === "logo_url" ? "logo" : "hero");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload selhal");
      set(target, data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload selhal");
    } finally {
      setUploading(null);
    }
  };

  const next = () => {
    setError(null);
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };
  const back = () => {
    setError(null);
    if (step > 0) setStep((s) => s - 1);
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/institutions/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, slug: effectiveSlug }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Něco se pokazilo. Zkus to prosím znovu.");
        return;
      }
      router.push("/admin/dashboard");
      router.refresh();
    });
  };

  return (
    <div className="rounded-3xl bg-cream p-8 shadow-soft-md ring-1 ring-ink-900/8">
      {/* Progress */}
      <ol className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
                i < step && "bg-meadow-500 text-cream",
                i === step && "bg-meadow-500 text-cream ring-4 ring-meadow-100",
                i > step && "bg-cream-warm text-ink-400",
              )}
            >
              {i < step ? <Check className="size-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 rounded-full",
                  i < step ? "bg-meadow-500" : "bg-cream-warm",
                )}
              />
            )}
          </li>
        ))}
      </ol>
      <p className="mb-6 font-display text-xl font-bold text-ink-900">
        {step + 1}. {STEPS[step]}
      </p>

      <div className="space-y-5">
        {step === 0 && (
          <>
            <div className="space-y-2">
              <Label>Typ instituce</Label>
              <div className="flex gap-2">
                {[
                  { value: "shelter" as const, label: "🏠 Útulek" },
                  {
                    value: "rescue_station" as const,
                    label: "🚑 Záchranná stanice",
                  },
                ].map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => set("type", o.value)}
                    className={cn(
                      "flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors",
                      v.type === o.value
                        ? "bg-meadow-500 text-cream"
                        : "bg-cream-warm text-ink-700 hover:bg-meadow-100",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Název útulku *</Label>
              <Input
                id="name"
                required
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Útulek Hostivař"
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Webová adresa</Label>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-ink-400">
                  zozio.cz/utulek/
                </span>
                <Input
                  id="slug"
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", slugify(e.target.value));
                  }}
                  placeholder="utulek-hostivar"
                  className="h-11 rounded-xl border-ink-900/15 bg-cream-warm text-sm"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="legal_name">Právní název</Label>
                <Input
                  id="legal_name"
                  value={v.legal_name}
                  onChange={(e) => set("legal_name", e.target.value)}
                  placeholder="Útulek Hostivař, z. s."
                  className={fieldClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ico">IČO</Label>
                <Input
                  id="ico"
                  value={v.ico}
                  onChange={(e) => set("ico", e.target.value)}
                  placeholder="12345678"
                  className={fieldClass}
                />
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Kontaktní e-mail</Label>
              <Input
                id="email"
                type="email"
                value={v.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="utulek@example.cz"
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                type="tel"
                value={v.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+420 123 456 789"
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Web</Label>
              <Input
                id="website"
                value={v.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://utulek-hostivar.cz"
                className={fieldClass}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="region">Kraj</Label>
              <select
                id="region"
                value={v.region}
                onChange={(e) => set("region", e.target.value)}
                className={cn(fieldClass, "w-full px-3")}
              >
                <option value="">— Vyber kraj —</option>
                {KRAJE.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Město</Label>
              <Input
                id="city"
                value={v.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Praha"
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adresa</Label>
              <Input
                id="address"
                value={v.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Ulice 123, 100 00 Praha"
                className={fieldClass}
              />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <ImageField
              label="Logo"
              url={v.logo_url}
              busy={uploading === "logo"}
              onFile={(f) => upload(f, "logo_url")}
              onClear={() => set("logo_url", "")}
            />
            <ImageField
              label="Úvodní obrázek (hero)"
              url={v.hero_url}
              busy={uploading === "hero"}
              onFile={(f) => upload(f, "hero_url")}
              onClear={() => set("hero_url", "")}
            />
            <div className="space-y-2">
              <Label htmlFor="description">Krátký popis</Label>
              <textarea
                id="description"
                rows={4}
                value={v.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Pár vět o vašem útulku, poslání a tom, jak pomáháte…"
                className="w-full rounded-xl border border-ink-900/15 bg-cream-warm px-3 py-2.5 text-base leading-relaxed outline-none focus:border-meadow-500"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="facebook_url">Facebook</Label>
                <Input
                  id="facebook_url"
                  value={v.facebook_url}
                  onChange={(e) => set("facebook_url", e.target.value)}
                  placeholder="https://facebook.com/…"
                  className={fieldClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram_url">Instagram</Label>
                <Input
                  id="instagram_url"
                  value={v.instagram_url}
                  onChange={(e) => set("instagram_url", e.target.value)}
                  placeholder="https://instagram.com/…"
                  className={fieldClass}
                />
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-sunshine-200 p-4 text-sm text-sunshine-600 ring-1 ring-inset ring-sunshine-400/40">
              Po odeslání bude útulek ve stavu <strong>čeká na ověření</strong>.
              Mezitím můžeš v adminu připravovat profil a zvířata — veřejně se
              zobrazí až po schválení.
            </div>
            <dl className="divide-y divide-ink-900/8 rounded-2xl bg-cream-warm p-5 text-sm">
              <SummaryRow label="Typ" value={v.type === "shelter" ? "Útulek" : "Záchranná stanice"} />
              <SummaryRow label="Název" value={v.name} />
              <SummaryRow label="Adresa profilu" value={`zozio.cz/utulek/${effectiveSlug}`} />
              <SummaryRow label="E-mail" value={v.email} />
              <SummaryRow label="Telefon" value={v.phone} />
              <SummaryRow label="Kraj / město" value={[v.region, v.city].filter(Boolean).join(" / ")} />
            </dl>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-peach-100 p-4 text-sm text-terracotta-600 ring-1 ring-inset ring-peach-300">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        {step > 0 ? (
          <ZozioButton type="button" variant="outline" size="md" onClick={back} disabled={isPending}>
            <ArrowLeft /> Zpět
          </ZozioButton>
        ) : (
          <span />
        )}

        {step < STEPS.length - 1 ? (
          <ZozioButton type="button" variant="meadow" size="md" onClick={next} disabled={!canContinue}>
            Pokračovat <ArrowRight />
          </ZozioButton>
        ) : (
          <ZozioButton
            type="button"
            variant="meadow"
            size="md"
            onClick={submit}
            disabled={isPending || !v.name.trim() || !effectiveSlug}
          >
            {isPending ? "Odesílám…" : "Založit útulek a odeslat ke schválení"}
          </ZozioButton>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-ink-400">{label}</dt>
      <dd className="text-right font-medium text-ink-900">{value || "—"}</dd>
    </div>
  );
}

function ImageField({
  label,
  url,
  busy,
  onFile,
  onClear,
}: {
  label: string;
  url: string;
  busy: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {url ? (
        <div className="flex items-center gap-3 rounded-2xl bg-cream-warm p-3 ring-1 ring-ink-900/8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="size-14 rounded-xl object-cover" />
          <span className="flex-1 truncate text-sm text-ink-600">{url}</span>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full p-1.5 text-ink-400 hover:bg-peach-100 hover:text-terracotta-600"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <label
          className={cn(
            "flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-900/20 bg-cream-warm px-4 py-6 text-sm text-ink-600 hover:border-meadow-300 hover:text-meadow-700",
            busy && "pointer-events-none opacity-60",
          )}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {busy ? "Nahrávám…" : "Nahrát obrázek"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
      )}
    </div>
  );
}
