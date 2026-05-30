"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FosterCarerValues } from "../actions";
import { deleteFosterCarer } from "../actions";
import { CarerForm } from "../foster-list";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

export interface PlacementRow {
  id: string;
  animalId: string;
  animalName: string;
  started_on: string;
  planned_until: string | null;
  ended_on: string | null;
  end_reason: string | null;
  fee: number | null;
  notes: string | null;
}

export function CarerDetail({
  carerId,
  initial,
  meta,
  placements,
}: {
  carerId: string;
  initial: FosterCarerValues;
  meta: { email: string | null; phone: string | null; address: string | null };
  placements: PlacementRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active = placements.filter((p) => !p.ended_on);
  const past = placements.filter((p) => p.ended_on);

  function remove() {
    if (
      !confirm(
        "Opravdu smazat pěstouna? Pokud má historii umístění, místo toho ho deaktivuj.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await deleteFosterCarer(carerId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push("/admin/foster");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/foster"
          className="text-sm font-semibold text-ink-500 hover:text-ink-900"
        >
          ← Pěstouni
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
                {initial.name}
              </h2>
              {!initial.is_active && (
                <span className="rounded-full bg-ink-900/8 px-2 py-0.5 text-xs font-semibold text-ink-500">
                  Neaktivní
                </span>
              )}
            </div>
            <p className="mt-1 text-ink-600">
              {[initial.city, meta.phone, meta.email]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-pill bg-cream-warm px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-900/8"
            >
              {editing ? <X className="size-4" /> : <Pencil className="size-4" />}
              {editing ? "Zavřít" : "Upravit"}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-sm font-semibold text-berry hover:bg-berry/10 disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              Smazat
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-berry">{error}</p>}
      </div>

      {editing && (
        <div className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
          <CarerForm
            initial={initial}
            carerId={carerId}
            onDone={() => setEditing(false)}
            submitLabel="Uložit změny"
          />
        </div>
      )}

      {!editing && (
        <div className="grid gap-3 rounded-3xl bg-cream p-6 text-sm ring-1 ring-ink-900/8 sm:grid-cols-2">
          <Detail label="Telefon" value={meta.phone} />
          <Detail label="E-mail" value={meta.email} />
          <Detail label="Adresa" value={meta.address} />
          <Detail
            label="Kapacita"
            value={initial.capacity != null ? String(initial.capacity) : null}
          />
          <Detail label="Druhy / velikosti" value={initial.species_note || null} />
          <Detail label="Poznámka" value={initial.notes || null} />
        </div>
      )}

      <div>
        <h3 className="font-display text-xl font-bold text-ink-900">
          Aktuální umístění
        </h3>
        {active.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">
            Žádné běžící umístění. Zvíře předáš do dočasné péče v jeho profilu
            (záložka „Pěstoun").
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {active.map((p) => (
              <PlacementItem key={p.id} p={p} />
            ))}
          </ul>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <h3 className="font-display text-xl font-bold text-ink-900">
            Historie
          </h3>
          <ul className="mt-3 space-y-2">
            {past.map((p) => (
              <PlacementItem key={p.id} p={p} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
        {label}
      </div>
      <div className="mt-0.5 text-ink-900">{value || "—"}</div>
    </div>
  );
}

function PlacementItem({ p }: { p: PlacementRow }) {
  return (
    <li className="rounded-2xl bg-cream p-4 ring-1 ring-ink-900/8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/admin/animals/${p.animalId}/pestoun`}
          className="font-display text-lg font-bold text-ink-900 hover:underline"
        >
          {p.animalName}
        </Link>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            p.ended_on
              ? "bg-ink-900/8 text-ink-500"
              : "bg-sage-100 text-sage-700",
          )}
        >
          {p.ended_on ? "Ukončeno" : "Probíhá"}
        </span>
      </div>
      <div className="mt-1 text-sm text-ink-600">
        {formatDate(p.started_on)} – {formatDate(p.ended_on)}
        {p.planned_until && !p.ended_on && (
          <> · plánováno do {formatDate(p.planned_until)}</>
        )}
        {p.fee != null && <> · {p.fee} Kč</>}
      </div>
      {p.end_reason && (
        <div className="mt-1 text-sm text-ink-500">{p.end_reason}</div>
      )}
      {p.notes && <div className="mt-1 text-sm text-ink-500">{p.notes}</div>}
    </li>
  );
}
