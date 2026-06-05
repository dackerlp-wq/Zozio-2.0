"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Heart,
  Pencil,
  PhoneCall,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fosterTagLabel, isMatchableTag } from "@/lib/foster-tags";
import type { Species } from "@/types/database";
import type { FosterCarerValues } from "../actions";
import { deleteFosterCarer, placeAnimalWithCarer } from "../actions";
import {
  addCheckin,
  endFosterPlacement,
} from "../../animals/[id]/foster-actions";
import { CarerForm } from "../foster-list";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

const SPECIES_ICON: Record<Species, string> = {
  dog: "🐕",
  cat: "🐈",
  rabbit: "🐇",
  other: "🐾",
};

export interface PlacementRow {
  id: string;
  animalId: string;
  animalName: string;
  species: Species | null;
  started_on: string;
  planned_until: string | null;
  ended_on: string | null;
  end_reason: string | null;
  fee: number | null;
  notes: string | null;
}

export interface CandidateVM {
  animalId: string;
  name: string;
  record: string | null;
  score: number;
  tone: "high" | "mid" | "block" | "full";
  reasons: { label: string; ok: boolean }[];
}

export interface TimelineEntry {
  id: string;
  date: string;
  kind: "checkin" | "comm";
  title: string;
  detail: string | null;
}

export interface ReimbursementVM {
  items: { id: string; label: string; amount: number }[];
  total: number;
}

interface Meta {
  email: string | null;
  phone: string | null;
  address: string | null;
  capacity: number | null;
  activeCount: number;
  full: boolean;
  unavailableUntil: string | null;
}

export function CarerDetail({
  carerId,
  initial,
  meta,
  placements,
  candidates,
  timeline,
  reimbursement,
}: {
  carerId: string;
  initial: FosterCarerValues;
  meta: Meta;
  placements: PlacementRow[];
  candidates: CandidateVM[];
  timeline: TimelineEntry[];
  reimbursement: ReimbursementVM;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active = placements.filter((p) => !p.ended_on);
  const past = placements.filter((p) => p.ended_on);

  const today = new Date().toISOString().slice(0, 10);
  const unavailable =
    !!meta.unavailableUntil && meta.unavailableUntil >= today;

  // Stavová pilulka: plná kapacita / nedostupný / volno.
  const status = meta.full
    ? {
        label: `Plná kapacita ${meta.activeCount}/${meta.capacity}`,
        cls: "bg-sunshine-200 text-sunshine-600",
      }
    : unavailable
      ? {
          label: `Nedostupný do ${formatDate(meta.unavailableUntil)}`,
          cls: "bg-ink-900/8 text-ink-500",
        }
      : {
          label:
            meta.capacity != null
              ? `Volno ${meta.activeCount}/${meta.capacity}`
              : "K dispozici",
          cls: "bg-sage-100 text-sage-700",
        };

  function run(fn: () => Promise<{ error: string } | { ok: true }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

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
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
                {initial.name}
              </h2>
              <span
                className={cn(
                  "rounded-full px-3 py-0.5 text-xs font-semibold",
                  status.cls,
                )}
              >
                {status.label}
              </span>
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
            value={
              meta.capacity != null
                ? `${meta.activeCount} / ${meta.capacity}${meta.full ? " (plná)" : ""}`
                : null
            }
          />
          <Detail
            label="Dostupnost"
            value={unavailable ? `Nedostupný do ${formatDate(meta.unavailableUntil)}` : "K dispozici"}
          />
          <Detail label="Druhy / velikosti" value={initial.species_note || null} />
          <div className="sm:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              Dovednosti / štítky
            </div>
            {initial.tags.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {initial.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-pill bg-cream-warm px-2 py-0.5 text-xs font-semibold text-ink-700"
                  >
                    {isMatchableTag(t) && (
                      <span className="size-1.5 rounded-full bg-sage-500" aria-hidden />
                    )}
                    {fosterTagLabel(t)}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-0.5 text-ink-900">—</div>
            )}
          </div>
          {initial.notes && (
            <div className="sm:col-span-2">
              <Detail label="Poznámka" value={initial.notes} />
            </div>
          )}
        </div>
      )}

      {/* Aktuální umístění */}
      <section>
        <h3 className="font-display text-xl font-bold text-ink-900">
          🏡 Aktuální umístění
        </h3>
        {active.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Žádné běžící umístění.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {active.map((p) => (
              <ActivePlacement key={p.id} p={p} pending={pending} run={run} />
            ))}
          </ul>
        )}
      </section>

      {/* + Umístit zvíře */}
      <section className="rounded-3xl border border-dashed border-ink-900/15 bg-cream-warm/40 p-5">
        <h3 className="font-display text-base font-bold text-ink-900">
          + Umístit zvíře
        </h3>
        <p className="mt-0.5 text-sm text-ink-500">
          {meta.full
            ? "Kapacita plná — nejdřív ukonči některý pobyt."
            : "Doporučení podle štítků pěstouna a atributů zvířete."}
        </p>
        {candidates.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">Žádná vhodná zvířata k umístění.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {candidates.map((c) => (
              <li
                key={c.animalId}
                className="flex items-center gap-3 rounded-2xl bg-cream p-3 ring-1 ring-ink-900/8"
              >
                <span
                  className={cn(
                    "w-12 shrink-0 text-center font-display text-lg font-bold",
                    c.tone === "high"
                      ? "text-sage-700"
                      : c.tone === "mid"
                        ? "text-sunshine-600"
                        : "text-ink-400",
                  )}
                >
                  {c.score} %
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/animals/${c.animalId}/pestoun`}
                    className="font-semibold text-ink-900 hover:underline"
                  >
                    {c.name}
                    {c.record && (
                      <span className="text-ink-400"> · {c.record}</span>
                    )}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-500">
                    {c.reasons.slice(0, 4).map((r, i) => (
                      <span
                        key={i}
                        className={cn(
                          "font-semibold",
                          r.ok ? "text-sage-700" : "text-terracotta-600",
                        )}
                      >
                        {r.ok ? "✓" : "✗"} {r.label}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={pending || meta.full}
                  onClick={() =>
                    run(() => placeAnimalWithCarer(carerId, c.animalId))
                  }
                  className="shrink-0 rounded-pill bg-meadow-500 px-3 py-1.5 text-xs font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
                >
                  Umístit
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Historie */}
      {past.length > 0 && (
        <section>
          <h3 className="font-display text-xl font-bold text-ink-900">
            📜 Historie umístění
          </h3>
          <ul className="mt-3 space-y-2">
            {past.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-cream p-4 ring-1 ring-ink-900/8"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-sand text-lg">
                    {p.species ? SPECIES_ICON[p.species] : "🐾"}
                  </span>
                  <div>
                    <Link
                      href={`/admin/animals/${p.animalId}/pestoun`}
                      className="font-semibold text-ink-900 hover:underline"
                    >
                      {p.animalName}
                    </Link>
                    <div className="text-sm text-ink-500">
                      {formatDate(p.started_on)} – {formatDate(p.ended_on)}
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    p.end_reason?.toLowerCase().includes("adop")
                      ? "bg-meadow-50 text-meadow-700"
                      : "bg-ink-900/8 text-ink-500",
                  )}
                >
                  {p.end_reason || "Ukončeno"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Check-iny & komunikace */}
      {timeline.length > 0 && (
        <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
          <h3 className="font-display text-lg font-bold text-ink-900">
            🗓 Check-iny & komunikace
          </h3>
          <ul className="mt-3 space-y-3 border-l-2 border-ink-900/10 pl-4">
            {timeline.map((t) => (
              <li key={t.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-cream",
                    t.kind === "checkin" ? "bg-meadow-500" : "bg-sunshine-500",
                  )}
                  aria-hidden
                />
                <div className="text-sm font-semibold text-ink-900">{t.title}</div>
                <div className="text-xs text-ink-500">
                  {formatDate(t.date)}
                  {t.detail && ` · ${t.detail}`}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Proplácení */}
      {reimbursement.items.length > 0 && (
        <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
          <h3 className="font-display text-lg font-bold text-ink-900">
            💸 Proplácení
          </h3>
          <ul className="mt-3 divide-y divide-ink-900/8">
            {reimbursement.items.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="text-ink-700">{i.label}</span>
                <span className="font-display font-bold text-ink-900">
                  {i.amount.toLocaleString("cs-CZ")} Kč
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t-2 border-ink-900/10 pt-3 text-sm font-bold text-ink-900">
            <span>Celkem proplaceno</span>
            <span>{reimbursement.total.toLocaleString("cs-CZ")} Kč</span>
          </div>
        </section>
      )}
    </div>
  );
}

function ActivePlacement({
  p,
  pending,
  run,
}: {
  p: PlacementRow;
  pending: boolean;
  run: (fn: () => Promise<{ error: string } | { ok: true }>) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <li className="rounded-2xl bg-cream p-4 ring-1 ring-ink-900/8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-sand text-lg">
            {p.species ? SPECIES_ICON[p.species] : "🐾"}
          </span>
          <div>
            <Link
              href={`/admin/animals/${p.animalId}/pestoun`}
              className="font-display text-lg font-bold text-ink-900 hover:underline"
            >
              {p.animalName}
            </Link>
            <div className="text-sm text-ink-500">
              {formatDate(p.started_on)} – …
              {p.planned_until && <> · plánováno do {formatDate(p.planned_until)}</>}
              {p.fee != null && <> · {p.fee} Kč</>}
            </div>
          </div>
        </div>
        <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-sage-700">
          Probíhá
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/admin/animals/${p.animalId}/pestoun`}
          className="inline-flex items-center gap-1 rounded-pill border-[1.5px] border-meadow-500 px-3 py-1.5 text-xs font-semibold text-meadow-600 hover:bg-meadow-50"
        >
          <ArrowUpRight className="size-3.5" /> Otevřít kartu
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const note = window.prompt("Krátká poznámka ke kontrole péče:");
            if (note === null) return;
            run(() =>
              addCheckin(p.animalId, p.id, {
                checked_on: today,
                method: "phone",
                note,
                photos: [],
              }),
            );
          }}
          className="inline-flex items-center gap-1 rounded-pill border-[1.5px] border-ink-900/15 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-900/30 disabled:opacity-50"
        >
          <PhoneCall className="size-3.5" /> Check-in
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Ukončit pobyt u zvířete ${p.animalName}?`)) return;
            run(() =>
              endFosterPlacement(p.animalId, p.id, {
                ended_on: today,
                end_reason: "Vráceno do útulku",
                return_status: "available",
                notes: "",
              }),
            );
          }}
          className="inline-flex items-center gap-1 rounded-pill border-[1.5px] border-ink-900/15 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-900/30 disabled:opacity-50"
        >
          Ukončit pobyt
        </button>
        <Link
          href={`/admin/animals/${p.animalId}/adopce`}
          className="inline-flex items-center gap-1 rounded-pill border-[1.5px] border-meadow-500 px-3 py-1.5 text-xs font-semibold text-meadow-600 hover:bg-meadow-50"
        >
          <Heart className="size-3.5" /> → Adopce
        </Link>
      </div>
    </li>
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
