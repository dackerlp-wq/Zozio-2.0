"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Pencil,
  Plus,
  ShieldAlert,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  ADOPTION_STATUS_LABEL,
  ADOPTION_STATUS_PILL,
  KENNEL_KIND_ICON,
  KENNEL_KIND_LABEL,
  KENNEL_QUARANTINE_KINDS,
  KENNEL_STATUS_BADGE,
  KENNEL_STATUS_LABEL,
  SPECIES_LABEL,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  AdoptionStatus,
  KennelKind,
  KennelStatus,
  Species,
} from "@/types/database";

import { moveAnimalToKennel } from "../animals/kennel-actions";
import { createKennel, deleteKennel, updateKennel } from "./actions";

export interface BoardAnimal {
  id: string;
  name: string;
  species: Species;
  photo: string | null;
  adoption_status: AdoptionStatus;
  quarantine_until: string | null;
  quarantine_overdue: boolean;
}

export interface BoardKennel {
  id: string;
  name: string;
  zone: string | null;
  kind: KennelKind;
  status: KennelStatus;
  capacity: number;
  species_allowed: Species[];
  notes: string | null;
  occupants: BoardAnimal[];
}

type ActionResult = { error: string } | { ok: true };

const KINDS: KennelKind[] = [
  "standard",
  "quarantine",
  "isolation",
  "intake",
  "outdoor",
  "cattery",
  "maternity",
];
const STATUSES: KennelStatus[] = [
  "active",
  "cleaning",
  "out_of_service",
  "reserved",
];
const SPECIES: Species[] = ["dog", "cat", "rabbit", "other"];
const NO_ZONE = "— Bez zóny —";

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
  });
}

/** Vrátí seznam problémů kotce pro zvýraznění v nástěnce. */
function kennelConflicts(k: BoardKennel): string[] {
  const out: string[] = [];
  if (k.occupants.length > k.capacity)
    out.push(`Přeplněno (${k.occupants.length}/${k.capacity})`);
  if (k.species_allowed.length > 0) {
    const bad = k.occupants.filter((a) => !k.species_allowed.includes(a.species));
    if (bad.length > 0)
      out.push(`Nepovolený druh: ${bad.map((a) => a.name).join(", ")}`);
  }
  if (k.status !== "active" && k.occupants.length > 0)
    out.push(`Obsazený kotec je „${KENNEL_STATUS_LABEL[k.status]}"`);
  const overdue = k.occupants.filter((a) => a.quarantine_overdue);
  if (overdue.length > 0)
    out.push(`Prošlá karanténa: ${overdue.map((a) => a.name).join(", ")}`);
  return out;
}

// ---------------------------------------------------------------------------
// Formulář kotce
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  capacity: string;
  kind: KennelKind;
  status: KennelStatus;
  zone: string;
  species_allowed: Species[];
  notes: string;
}

function KennelForm({
  initial,
  zones,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<FormState>;
  zones: string[];
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
    kind: initial?.kind ?? "standard",
    status: initial?.status ?? "active",
    zone: initial?.zone ?? "",
    species_allowed: initial?.species_allowed ?? [],
    notes: initial?.notes ?? "",
  });

  function toggleSpecies(s: Species) {
    setState((cur) => ({
      ...cur,
      species_allowed: cur.species_allowed.includes(s)
        ? cur.species_allowed.filter((x) => x !== s)
        : [...cur.species_allowed, s],
    }));
  }

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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Název">
          <input
            required
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            placeholder="např. Kotec A1"
            className={inputCls}
          />
        </Field>
        <Field label="Zóna / sekce">
          <input
            list="kennel-zones"
            value={state.zone}
            onChange={(e) => setState({ ...state, zone: e.target.value })}
            placeholder="např. Budova A"
            className={inputCls}
          />
          <datalist id="kennel-zones">
            {zones.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
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
        <Field label="Typ">
          <select
            value={state.kind}
            onChange={(e) =>
              setState({ ...state, kind: e.target.value as KennelKind })
            }
            className={inputCls}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KENNEL_KIND_ICON[k]} {KENNEL_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Stav">
          <select
            value={state.status}
            onChange={(e) =>
              setState({ ...state, status: e.target.value as KennelStatus })
            }
            className={inputCls}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {KENNEL_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Povolené druhy (prázdné = vše)">
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SPECIES.map((s) => {
              const on = state.species_allowed.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSpecies(s)}
                  className={cn(
                    "rounded-pill px-3 py-1 text-xs font-semibold ring-1 transition-colors",
                    on
                      ? "bg-meadow-500 text-cream ring-meadow-500"
                      : "bg-cream text-ink-600 ring-ink-900/10 hover:bg-cream-warm",
                  )}
                >
                  {SPECIES_LABEL[s]}
                </button>
              );
            })}
          </div>
        </Field>
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

// ---------------------------------------------------------------------------
// Přesun zvířete (rychlý výběr cílového kotce)
// ---------------------------------------------------------------------------

function MovePicker({
  animalId,
  currentKennelId,
  kennels,
  label = "Přesunout",
}: {
  animalId: string;
  currentKennelId: string | null;
  kennels: BoardKennel[];
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function move(target: string | null) {
    setOpen(false);
    startTransition(async () => {
      await moveAnimalToKennel(animalId, target);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        title={label}
        className="inline-flex items-center gap-1 rounded-pill bg-cream-warm px-2 py-1 text-xs font-semibold text-ink-600 ring-1 ring-ink-900/10 hover:bg-cream disabled:opacity-50"
      >
        <ArrowLeftRight className="size-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 max-h-64 w-56 overflow-auto rounded-2xl bg-cream p-1.5 shadow-lg ring-1 ring-ink-900/10">
          {currentKennelId && (
            <button
              type="button"
              onClick={() => move(null)}
              className="block w-full rounded-xl px-3 py-1.5 text-left text-sm text-ink-600 hover:bg-cream-warm"
            >
              Vyřadit z kotce
            </button>
          )}
          {kennels
            .filter((k) => k.id !== currentKennelId)
            .map((k) => {
              const full = k.occupants.length >= k.capacity;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => move(k.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-left text-sm text-ink-800 hover:bg-cream-warm"
                >
                  <span className="truncate">
                    {KENNEL_KIND_ICON[k.kind]} {k.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-semibold",
                      full ? "text-terracotta-600" : "text-sage-700",
                    )}
                  >
                    {k.occupants.length}/{k.capacity}
                  </span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar + řádek zvířete
// ---------------------------------------------------------------------------

function Avatar({ a }: { a: BoardAnimal }) {
  if (a.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={a.photo}
        alt=""
        className="size-7 shrink-0 rounded-full object-cover ring-1 ring-ink-900/10"
      />
    );
  }
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sand text-xs font-bold text-ink-500">
      {a.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function OccupantRow({
  a,
  kennels,
  currentKennelId,
}: {
  a: BoardAnimal;
  kennels: BoardKennel[];
  currentKennelId: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-cream-warm/60 px-2 py-1.5">
      <Avatar a={a} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/admin/animals/${a.id}`}
            className="truncate text-sm font-semibold text-ink-900 hover:text-meadow-600 hover:underline"
          >
            {a.name}
          </Link>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              ADOPTION_STATUS_PILL[a.adoption_status],
            )}
          >
            {ADOPTION_STATUS_LABEL[a.adoption_status]}
          </span>
          {a.quarantine_until && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                a.quarantine_overdue
                  ? "bg-peach-200 text-terracotta-600"
                  : "bg-sunshine-200 text-sunshine-600",
              )}
            >
              {a.quarantine_overdue ? "Karanténa prošlá" : "Karanténa do "}
              {!a.quarantine_overdue && formatDate(a.quarantine_until)}
            </span>
          )}
        </div>
      </div>
      <MovePicker
        animalId={a.id}
        currentKennelId={currentKennelId}
        kennels={kennels}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dlaždice kotce
// ---------------------------------------------------------------------------

function KennelTile({
  kennel,
  allKennels,
  zones,
}: {
  kennel: BoardKennel;
  allKennels: BoardKennel[];
  zones: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const occupied = kennel.occupants.length;
  const full = occupied >= kennel.capacity;
  const conflicts = kennelConflicts(kennel);
  const hasConflict = conflicts.length > 0;
  const freeSlots = Math.max(0, kennel.capacity - occupied);
  const pct = Math.min(100, Math.round((occupied / Math.max(1, kennel.capacity)) * 100));

  if (editing) {
    return (
      <KennelForm
        initial={{
          name: kennel.name,
          capacity: String(kennel.capacity),
          kind: kennel.kind,
          status: kennel.status,
          zone: kennel.zone ?? "",
          species_allowed: kennel.species_allowed,
          notes: kennel.notes ?? "",
        }}
        zones={zones}
        submitLabel="Uložit"
        onSubmit={(state) =>
          updateKennel(kennel.id, {
            name: state.name,
            capacity: Number(state.capacity),
            kind: state.kind,
            status: state.status,
            zone: state.zone,
            species_allowed: state.species_allowed,
            notes: state.notes,
          })
        }
        onCancel={() => setEditing(false)}
      />
    );
  }

  const inactive = kennel.status !== "active";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl bg-cream p-4 ring-1 transition-colors",
        hasConflict ? "ring-2 ring-terracotta-500/60" : "ring-ink-900/8",
        inactive && "opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-display text-lg font-bold text-ink-900">
              {kennel.name}
            </span>
            <span
              className="rounded-full bg-ink-900/8 px-2 py-0.5 text-xs font-semibold text-ink-600"
              title={KENNEL_KIND_LABEL[kennel.kind]}
            >
              {KENNEL_KIND_ICON[kennel.kind]} {KENNEL_KIND_LABEL[kennel.kind]}
            </span>
            {KENNEL_QUARANTINE_KINDS.includes(kennel.kind) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-peach-200 px-2 py-0.5 text-xs font-semibold text-terracotta-600">
                <ShieldAlert className="size-3" />
              </span>
            )}
            {inactive && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  KENNEL_STATUS_BADGE[kennel.status],
                )}
              >
                {KENNEL_STATUS_LABEL[kennel.status]}
              </span>
            )}
          </div>
          {kennel.species_allowed.length > 0 && (
            <p className="mt-0.5 text-xs text-ink-400">
              Jen: {kennel.species_allowed.map((s) => SPECIES_LABEL[s]).join(", ")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-bold",
              full
                ? "bg-peach-200 text-terracotta-600"
                : "bg-sage-100 text-sage-700",
            )}
          >
            {occupied}/{kennel.capacity}
          </span>
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
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Kapacitní proužek */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-900/8">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            occupied > kennel.capacity
              ? "bg-terracotta-500"
              : full
                ? "bg-sunshine-600"
                : "bg-meadow-500",
          )}
          style={{ width: `${Math.max(pct, occupied > 0 ? 8 : 0)}%` }}
        />
      </div>

      {/* Obyvatelé */}
      {occupied > 0 ? (
        <div className="space-y-1.5">
          {kennel.occupants.map((a) => (
            <OccupantRow
              key={a.id}
              a={a}
              kennels={allKennels}
              currentKennelId={kennel.id}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-400">Prázdný</p>
      )}

      {freeSlots > 0 && occupied > 0 && (
        <p className="text-xs font-semibold text-meadow-600">
          + {freeSlots} volné místo{freeSlots > 1 ? (freeSlots < 5 ? "a" : "") : ""}
        </p>
      )}

      {kennel.notes && (
        <p className="text-xs text-ink-500">{kennel.notes}</p>
      )}

      {hasConflict && (
        <ul className="space-y-1 rounded-xl bg-peach-100 p-2">
          {conflicts.map((c) => (
            <li
              key={c}
              className="flex items-start gap-1.5 text-xs font-semibold text-terracotta-600"
            >
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              {c}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-berry">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Souhrn + filtry + nástěnka
// ---------------------------------------------------------------------------

type Filter = "all" | "free" | "quarantine" | "issues" | "out_of_service";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink-900/8">
      <div className="font-display text-2xl font-bold text-ink-900">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
        {label}
      </div>
    </div>
  );
}

export function KennelBoard({
  board,
  unassigned,
}: {
  board: BoardKennel[];
  unassigned: BoardAnimal[];
}) {
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const zones = useMemo(
    () =>
      [...new Set(board.map((k) => k.zone).filter((z): z is string => !!z))].sort(
        (a, b) => a.localeCompare(b, "cs"),
      ),
    [board],
  );

  const summary = useMemo(() => {
    let capacity = 0;
    let occupied = 0;
    let free = 0;
    let quarantine = 0;
    let oos = 0;
    for (const k of board) {
      occupied += k.occupants.length;
      if (k.status === "active") {
        capacity += k.capacity;
        free += Math.max(0, k.capacity - k.occupants.length);
      }
      if (KENNEL_QUARANTINE_KINDS.includes(k.kind)) quarantine += 1;
      if (k.status === "out_of_service") oos += 1;
    }
    const issues = board.filter((k) => kennelConflicts(k).length > 0).length;
    return { capacity, occupied, free, quarantine, oos, issues };
  }, [board]);

  const visible = useMemo(() => {
    return board.filter((k) => {
      switch (filter) {
        case "free":
          return k.status === "active" && k.occupants.length < k.capacity;
        case "quarantine":
          return KENNEL_QUARANTINE_KINDS.includes(k.kind);
        case "issues":
          return kennelConflicts(k).length > 0;
        case "out_of_service":
          return k.status === "out_of_service";
        default:
          return true;
      }
    });
  }, [board, filter]);

  // Seskupení dle zóny (zachová pořadí ze serveru).
  const grouped = useMemo(() => {
    const map = new Map<string, BoardKennel[]>();
    for (const k of visible) {
      const key = k.zone ?? NO_ZONE;
      const list = map.get(key) ?? [];
      list.push(k);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [visible]);

  const FILTERS: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: "Vše", count: board.length },
    { id: "free", label: "Volné" },
    { id: "quarantine", label: "Karanténa", count: summary.quarantine },
    { id: "out_of_service", label: "Mimo provoz", count: summary.oos },
    { id: "issues", label: "Problémy", count: summary.issues },
  ];

  return (
    <div className="space-y-5">
      {/* Souhrnný řádek */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat value={summary.capacity} label="Kapacita" />
        <Stat value={summary.occupied} label="Obsazeno" />
        <Stat value={summary.free} label="Volno" />
        <Stat value={summary.quarantine} label="Karanténa" />
        <Stat value={summary.oos} label="Mimo provoz" />
      </div>

      {/* Filtry + přidání */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-pill px-3 py-1.5 text-sm font-semibold ring-1 transition-colors",
                filter === f.id
                  ? "bg-ink-900 text-cream ring-ink-900"
                  : "bg-cream text-ink-600 ring-ink-900/10 hover:bg-cream-warm",
                f.id === "issues" &&
                  f.count! > 0 &&
                  filter !== f.id &&
                  "text-terracotta-600",
              )}
            >
              {f.label}
              {typeof f.count === "number" && (
                <span className="ml-1 opacity-60">{f.count}</span>
              )}
            </button>
          ))}
        </div>
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
          zones={zones}
          submitLabel="Vytvořit"
          onSubmit={(state) =>
            createKennel({
              name: state.name,
              capacity: Number(state.capacity),
              kind: state.kind,
              status: state.status,
              zone: state.zone,
              species_allowed: state.species_allowed,
              notes: state.notes,
            })
          }
          onCancel={() => setAdding(false)}
        />
      )}

      {/* Panel nezařazených zvířat */}
      {unassigned.length > 0 && (
        <section className="rounded-3xl bg-sunshine-200/40 p-4 ring-1 ring-sunshine-600/20">
          <h3 className="mb-2 flex items-center gap-2 font-display text-base font-bold text-ink-900">
            <TriangleAlert className="size-4 text-sunshine-600" />
            Bez kotce
            <span className="text-sm font-semibold text-ink-400">
              {unassigned.length}
            </span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 rounded-pill bg-cream py-1 pl-1 pr-2 ring-1 ring-ink-900/8"
              >
                <Avatar a={a} />
                <Link
                  href={`/admin/animals/${a.id}`}
                  className="text-sm font-semibold text-ink-800 hover:text-meadow-600 hover:underline"
                >
                  {a.name}
                </Link>
                <MovePicker
                  animalId={a.id}
                  currentKennelId={null}
                  kennels={board}
                  label="Přiřadit do kotce"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Nástěnka */}
      {board.length === 0 && !adding ? (
        <div className="rounded-3xl bg-cream p-12 text-center ring-1 ring-ink-900/8">
          <div className="text-4xl">🏠</div>
          <h3 className="mt-4 font-display text-xl font-semibold text-ink-900">
            Zatím žádné kotce
          </h3>
          <p className="mt-2 text-ink-600">
            Přidej kotce a začni do nich umisťovat zvířata.
          </p>
        </div>
      ) : grouped.length === 0 ? (
        <p className="rounded-2xl bg-cream p-6 text-center text-sm text-ink-500 ring-1 ring-ink-900/8">
          Žádné kotce neodpovídají filtru.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([zone, list]) => (
            <div key={zone} className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-500">
                {zone}
                <span className="text-ink-300">{list.length}</span>
              </h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((k) => (
                  <KennelTile
                    key={k.id}
                    kennel={k}
                    allKennels={board}
                    zones={zones}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
