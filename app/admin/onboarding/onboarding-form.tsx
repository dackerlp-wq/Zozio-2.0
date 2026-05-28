"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZozioButton } from "@/components/zozio/button";
import { slugify } from "@/lib/slug";

interface OnboardingFormProps {
  userEmail: string;
}

export function OnboardingForm({ userEmail }: OnboardingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [type, setType] = useState<"shelter" | "rescue_station">("shelter");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");

  const effectiveSlug = slugTouched ? slug : slugify(name);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/institutions/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: effectiveSlug,
          type,
          region,
          city,
          email: userEmail,
          phone,
        }),
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
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-3xl bg-cream p-8 shadow-soft-md ring-1 ring-ink-900/8"
    >
      {/* Type */}
      <div className="space-y-2">
        <Label>Typ instituce</Label>
        <div className="flex gap-2">
          {[
            { value: "shelter" as const, label: "🏠 Útulek" },
            { value: "rescue_station" as const, label: "🚑 Záchranná stanice" },
          ].map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setType(o.value)}
              className={
                "flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors " +
                (type === o.value
                  ? "bg-meadow-500 text-cream"
                  : "bg-cream-warm text-ink-700 hover:bg-meadow-100")
              }
            >
              {o.label}
            </button>
          ))}
        </div>
        {type === "rescue_station" && (
          <p className="text-xs text-ink-400">
            Pozn.: záchranné stanice jsou zatím v přípravě — MVP cílí na útulky.
          </p>
        )}
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Název útulku *</Label>
        <Input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Útulek Hostivař"
          className="h-12 rounded-xl border-ink-900/15 bg-cream-warm text-base"
        />
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <Label htmlFor="slug">Webová adresa</Label>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-ink-400">zozio.cz/utulek/</span>
          <Input
            id="slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="utulek-hostivar"
            className="h-11 rounded-xl border-ink-900/15 bg-cream-warm text-sm"
          />
        </div>
      </div>

      {/* Region + City */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="region">Kraj</Label>
          <Input
            id="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Praha"
            className="h-12 rounded-xl border-ink-900/15 bg-cream-warm text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Město</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Praha"
            className="h-12 rounded-xl border-ink-900/15 bg-cream-warm text-base"
          />
        </div>
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone">Telefon</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+420 123 456 789"
          className="h-12 rounded-xl border-ink-900/15 bg-cream-warm text-base"
        />
      </div>

      <p className="text-sm text-ink-600">
        Přihlašovací email: <strong>{userEmail}</strong>
      </p>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl bg-peach-100 p-4 text-sm text-terracotta-600 ring-1 ring-inset ring-peach-300">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <ZozioButton
        type="submit"
        variant="meadow"
        size="lg"
        disabled={isPending || !name || !effectiveSlug}
        className="w-full"
      >
        {isPending ? "Zakládám…" : "Založit útulek a pokračovat"}
      </ZozioButton>
    </form>
  );
}
