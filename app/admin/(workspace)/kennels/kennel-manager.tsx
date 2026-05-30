"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import type { KennelRow } from "@/types/database";

import { createKennel, deleteKennel, updateKennel } from "./actions";

export interface KennelWithOccupancy extends KennelRow {
  occupants: string[];
}

type ActionResult = { error: string } | { ok: true };

const inputCls =
  "w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300";

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

interface FormState {
  name: string;
  capacity: string;
  is_quarantine: boolean;
  notes: string;
}

function KennelForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<FormState>;
  submitLabel: string;
  onSubmit: (state: FormState) => Promise<ActionResult>;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<FormState>({
    name: initial?.name ?? "",
    capacity: initial?.capacity ?? "1",
    is_quarantine: initial?.is_quarantine ?? false,
    notes: initial?.notes ?? "",
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await onSubmit(state);
          if ("error" in res) {
            setError(res.error);
            return;
          }
          onCancel();
          router.refresh();
        });
      }}
      className="rounded-2xl bg-cream-warm/60 p-4 ring-1 ring-ink-900/8"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Název">
          <input
            required
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            placeholder="např. Kotec A1"
            className={inputCls}
          />
        </Field>
        <Field label="Kapacita">
          <input
            type="number"
            min="1"
            value={state.capacity}
            onChange={(e) => setState({ ...state, capacity: e.target.value })}
            className={inputCls}
          />
        </Field>
        <label className="flex items-end gap-2 pb-2">
          <input
            type="checkbox"
            checked={state.is_quarantine}
            onChange={(e) =>
              setState({ ...state, is_quarantine: e.target.checked })
            }
            className="size-4 rounded"
          />
          <span className="text-sm font-semibold text-ink-700">Karanténa</span>
        </label>
      </div>
      <div className="mt-3">
        <Field label="Poznámka">
          <input
            value={state.notes}
            onChange={(e) => setState({ ...state, notes: e.target.value })}
            className={inputCls}
          />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        {error && <span className="mr-auto text-xs text-berry">{error}</span>}
        <button
          type="button"
          onClick={onCancel}
          className="rounded-pill px-3 py-1.5 text-sm font-semibold text-ink-600 hover:bg-cream"
        >
          Zrušit
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-meadow-500 px-4 py-1.5 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
        >
          {pending ? "Ukládám…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function KennelCard({ kennel }: { kennel: KennelWithOccupancy }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const occupied = kennel.occupants.length;
  const full = occupied >= kennel.capacity;

  if (editing) {
    return (
      <KennelForm
        initial={{
          name: kennel.name,
          capacity: String(kennel.capacity),
          is_quarantine: kennel.is_quarantine,
          notes: kennel.notes ?? "",
        }}
        submitLabel="Uložit"
        onSubmit={(state) =>
          updateKennel(kennel.id, {
            name: state.name,
            capacity: Number(state.capacity),
            is_quarantine: state.is_quarantine,
            notes: state.notes,
          })
        }
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-2xl bg-cream p-4 ring-1 ring-ink-900/8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-bold text-ink-900">
              {kennel.name}
            </span>
            {kennel.is_quarantine && (
              <span className="inline-flex items-center gap-1 rounded-full bg-peach-200 px-2 py-0.5 text-xs font-semibold text-terracotta-600">
                <ShieldAlert className="size-3" /> Karanténa
              </span>
            )}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                full
                  ? "bg-peach-200 text-terracotta-600"
                  : "bg-sage-100 text-sage-700",
              )}
            >
              {occupied}/{kennel.capacity}
            </span>
          </div>
          {kennel.occupants.length > 0 && (
            <p className="mt-1 truncate text-sm text-ink-600">
              {kennel.occupants.join(", ")}
            </p>
          )}
          {kennel.notes && (
            <p className="mt-1 text-sm text-ink-500">{kennel.notes}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Upravit kotec"
            className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-ink-700"
          >
            <Pencil className="size-4" />
          </button>
          {confirming ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteKennel(kennel.id);
                    if ("error" in res) {
                      setError(res.error);
                      setConfirming(false);
                      return;
                    }
                    router.refresh();
                  })
                }
                className="rounded-full bg-berry px-2.5 py-1 text-xs font-semibold text-cream disabled:opacity-50"
              >
                {pending ? "Mažu…" : "Smazat"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-full bg-cream-warm px-2.5 py-1 text-xs font-semibold text-ink-600"
              >
                Zpět
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label="Smazat kotec"
              className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-berry"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-berry">{error}</p>}
    </div>
  );
}

export function KennelManager({ rows }: { rows: KennelWithOccupancy[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-pill bg-ink-900 px-4 py-2 text-sm font-semibold text-cream hover:bg-ink-800"
        >
          {adding ? <X className="size-4" /> : <Plus className="size-4" />}
          {adding ? "Zavřít" : "Přidat kotec"}
        </button>
      </div>

      {adding && (
        <KennelForm
          submitLabel="Vytvořit"
          onSubmit={(state) =>
            createKennel({
              name: state.name,
              capacity: Number(state.capacity),
              is_quarantine: state.is_quarantine,
              notes: state.notes,
            })
          }
          onCancel={() => setAdding(false)}
        />
      )}

      {rows.length === 0 && !adding ? (
        <div className="rounded-3xl bg-cream p-12 text-center ring-1 ring-ink-900/8">
          <div className="text-4xl">🏠</div>
          <h3 className="mt-4 font-display text-xl font-semibold text-ink-900">
            Zatím žádné kotce
          </h3>
          <p className="mt-2 text-ink-600">
            Přidej kotce a začni do nich umisťovat zvířata.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((k) => (
            <KennelCard key={k.id} kennel={k} />
          ))}
        </div>
      )}
    </div>
  );
}
