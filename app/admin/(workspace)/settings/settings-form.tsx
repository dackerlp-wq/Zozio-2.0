"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Loader2, Upload, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZozioButton } from "@/components/zozio/button";
import { cn } from "@/lib/utils";
import { updateSettings, type SettingsValues } from "./actions";

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const [v, setV] = useState<SettingsValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof SettingsValues>(k: K, val: SettingsValues[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  const uploadLogo = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload selhal");
      set("logo_url", data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload selhal");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await updateSettings(v);
      if ("error" in r) setError(r.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Publish toggle */}
      <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <label className="flex cursor-pointer items-start gap-4">
          <input
            type="checkbox"
            checked={v.is_published}
            onChange={(e) => set("is_published", e.target.checked)}
            className="mt-1 size-5 rounded accent-meadow-500"
          />
          <div>
            <div className="font-display text-lg font-bold text-ink-900">
              Zveřejnit útulek na zozio.cz
            </div>
            <p className="text-sm text-ink-600">
              Když je zaškrtnuto, tvůj profil a zvířata se zobrazují veřejně v
              katalogu. Bez toho tě adoptanti nenajdou.
            </p>
          </div>
        </label>
      </section>

      <Section title="Základní informace">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              {v.logo_url ? (
                <div className="relative size-20 overflow-hidden rounded-2xl ring-1 ring-ink-900/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.logo_url} alt="logo" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => set("logo_url", "")}
                    className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-ink-900/70 text-cream"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  className={cn(
                    "inline-flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-ink-900/15 text-ink-400 hover:border-meadow-500 hover:text-meadow-700",
                    uploading && "pointer-events-none opacity-60",
                  )}
                >
                  {uploading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Upload className="size-5" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) uploadLogo(e.target.files[0]);
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <FieldRow label="Název útulku *">
            <Input
              required
              value={v.name}
              onChange={(e) => set("name", e.target.value)}
              className="admin-input"
            />
          </FieldRow>
          <FieldRow label="Popis">
            <textarea
              value={v.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
              className="admin-input resize-y"
              placeholder="Pár vět o vašem útulku…"
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Kontakt">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Email">
            <Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} className="admin-input" />
          </FieldRow>
          <FieldRow label="Telefon">
            <Input type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} className="admin-input" />
          </FieldRow>
          <FieldRow label="Web">
            <Input value={v.website} onChange={(e) => set("website", e.target.value)} className="admin-input" placeholder="https://" />
          </FieldRow>
          <FieldRow label="Adresa">
            <Input value={v.address} onChange={(e) => set("address", e.target.value)} className="admin-input" />
          </FieldRow>
          <FieldRow label="Kraj">
            <Input value={v.region} onChange={(e) => set("region", e.target.value)} className="admin-input" />
          </FieldRow>
          <FieldRow label="Město">
            <Input value={v.city} onChange={(e) => set("city", e.target.value)} className="admin-input" />
          </FieldRow>
        </div>
      </Section>

      <Section title="Poloha & sociální sítě">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="GPS šířka (lat)">
            <Input
              type="number"
              step="any"
              value={v.lat ?? ""}
              onChange={(e) => set("lat", e.target.value ? Number(e.target.value) : null)}
              className="admin-input"
              placeholder="50.0755"
            />
          </FieldRow>
          <FieldRow label="GPS délka (lng)">
            <Input
              type="number"
              step="any"
              value={v.lng ?? ""}
              onChange={(e) => set("lng", e.target.value ? Number(e.target.value) : null)}
              className="admin-input"
              placeholder="14.4378"
            />
          </FieldRow>
          <FieldRow label="Facebook URL">
            <Input value={v.facebook_url} onChange={(e) => set("facebook_url", e.target.value)} className="admin-input" />
          </FieldRow>
          <FieldRow label="Instagram URL">
            <Input value={v.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} className="admin-input" />
          </FieldRow>
        </div>
      </Section>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl bg-peach-100 p-4 text-sm text-terracotta-600 ring-1 ring-inset ring-peach-300">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-ink-900/8 bg-sage-50/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <ZozioButton type="submit" variant="meadow" size="lg" disabled={isPending || uploading || !v.name}>
          {isPending ? "Ukládám…" : "Uložit nastavení"}
        </ZozioButton>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-meadow-700">
            <CheckCircle2 className="size-4" /> Uloženo
          </span>
        )}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
      <h2 className="mb-5 font-display text-xl font-bold text-ink-900">{title}</h2>
      {children}
    </section>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
