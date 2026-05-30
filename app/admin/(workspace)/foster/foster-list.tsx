"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  createFosterCarer,
  updateFosterCarer,
  type FosterCarerValues,
} from "./actions";

const inputCls =
  "w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300";

export interface CarerListItem {
  id: string;
  name: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  capacity: number | null;
  is_active: boolean;
  activeCount: number;
  activeAnimals: string[];
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const EMPTY: FosterCarerValues = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  region: "",
  capacity: null,
  species_note: "",
  notes: "",
  is_active: true,
};

export function FosterList({ carers }: { carers: CarerListItem[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            Pěstouni
          </h2>
          <p className="mt-1 text-ink-600">
            {carers.length} {carers.length === 1 ? "pěstoun" : "pěstounů"} ·
            dočasná péče o zvířata mimo útulek.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600"
        >
          {adding ? <X className="size-4" /> : <Plus className="size-4" />}
          {adding ? "Zavřít" : "Přidat pěstouna"}
        </button>
      </div>

      {adding && (
        <div className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
          <CarerForm onDone={() => setAdding(false)} />
        </div>
      )}

      {carers.length === 0 ? (
        <div className="rounded-3xl bg-cream p-10 text-center ring-1 ring-ink-900/8">
          <p className="text-ink-600">
            Zatím nemáš žádné pěstouny. Přidej prvního a můžeš mu předat zvíře do
            dočasné péče.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {carers.map((c) => (
            <Link
              key={c.id}
              href={`/admin/foster/${c.id}`}
              className="group rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8 transition hover:-translate-y-0.5 hover:shadow-soft-md"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-lg font-bold text-ink-900">
                  {c.name}
                </span>
                {!c.is_active && (
                  <span className="rounded-full bg-ink-900/8 px-2 py-0.5 text-xs font-semibold text-ink-500">
                    Neaktivní
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-ink-500">
                {[c.city, c.phone].filter(Boolean).join(" · ") || "—"}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-semibold",
                    c.activeCount > 0
                      ? "bg-sage-100 text-sage-700"
                      : "bg-ink-900/8 text-ink-500",
                  )}
                >
                  {c.activeCount} v péči
                  {c.capacity != null && ` / ${c.capacity}`}
                </span>
                {c.activeAnimals.slice(0, 3).map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-cream-warm px-2 py-0.5 text-ink-600"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function CarerForm({
  initial = EMPTY,
  carerId,
  onDone,
  submitLabel = "Přidat pěstouna",
}: {
  initial?: FosterCarerValues;
  carerId?: string;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<FosterCarerValues>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FosterCarerValues>(
    k: K,
    val: FosterCarerValues[K],
  ) {
    setV((s) => ({ ...s, [k]: val }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (carerId) {
        const res = await updateFosterCarer(carerId, v);
        if ("error" in res) {
          setError(res.error);
          return;
        }
        onDone?.();
        router.refresh();
        return;
      }
      const res = await createFosterCarer(v);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setV(EMPTY);
      onDone?.();
      router.refresh();
      if ("id" in res) router.push(`/admin/foster/${res.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Jméno *">
          <input
            required
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Kapacita (počet zvířat)">
          <input
            type="number"
            min={0}
            value={v.capacity ?? ""}
            onChange={(e) =>
              set("capacity", e.target.value ? Number(e.target.value) : null)
            }
            className={inputCls}
          />
        </Field>
        <Field label="Telefon">
          <input
            value={v.phone}
            onChange={(e) => set("phone", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            value={v.email}
            onChange={(e) => set("email", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Město">
          <input
            value={v.city}
            onChange={(e) => set("city", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Kraj">
          <input
            value={v.region}
            onChange={(e) => set("region", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Adresa">
        <input
          value={v.address}
          onChange={(e) => set("address", e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label="Jaké druhy / velikosti zvládne">
        <input
          value={v.species_note}
          onChange={(e) => set("species_note", e.target.value)}
          placeholder="např. malí psi, koťata"
          className={inputCls}
        />
      </Field>
      <Field label="Poznámka">
        <textarea
          rows={2}
          value={v.notes}
          onChange={(e) => set("notes", e.target.value)}
          className={inputCls}
        />
      </Field>
      {carerId && (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={v.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
            className="size-5 rounded accent-meadow-500"
          />
          <span className="text-sm font-semibold text-ink-900">Aktivní</span>
        </label>
      )}

      <div className="flex items-center justify-end gap-2">
        {error && <span className="mr-auto text-sm text-berry">{error}</span>}
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-pill px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-cream-warm"
          >
            Zrušit
          </button>
        )}
        <button
          type="submit"
          disabled={pending || !v.name.trim()}
          className="rounded-pill bg-meadow-500 px-5 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
        >
          {pending ? "Ukládám…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
