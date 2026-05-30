"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";

import {
  SUPERVISION_KINDS,
  SUPERVISION_STATUS_HELP,
  SUPERVISION_STATUS_LABEL,
  SUPERVISION_STATUS_PILL,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  AnimalSupervisionStatus,
  QuarantineRecordRow,
} from "@/types/database";

import {
  deleteSupervisionRecord,
  endSupervision,
  startSupervision,
} from "./quarantine-actions";

type ActionResult = { error: string } | { ok: true };

const inputCls =
  "w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300";

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
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

function SubmitRow({
  pending,
  error,
  onCancel,
  label = "Uložit",
}: {
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  label?: string;
}) {
  return (
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
        {pending ? "Ukládám…" : label}
      </button>
    </div>
  );
}

function useSubmit() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<ActionResult>, onDone: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return { pending, error, run };
}

export function QuarantineSection({
  animalId,
  current,
  records,
}: {
  animalId: string;
  current: AnimalSupervisionStatus;
  records: QuarantineRecordRow[];
}) {
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const active = records.find((r) => r.ended_on === null) ?? null;
  const history = records.filter((r) => r.ended_on !== null);

  return (
    <div className="space-y-6">
      {/* Aktuální stav */}
      <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-sm font-semibold",
                SUPERVISION_STATUS_PILL[current],
              )}
            >
              {SUPERVISION_STATUS_LABEL[current]}
            </span>
            {active?.planned_until && (
              <span className="text-sm text-ink-500">
                Plánovaný konec: {formatDate(active.planned_until)}
              </span>
            )}
          </div>
          {current === "released" ? (
            <button
              type="button"
              onClick={() => {
                setStartOpen((v) => !v);
                setEndOpen(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-pill bg-ink-900 px-3 py-1.5 text-sm font-semibold text-cream hover:bg-ink-800"
            >
              {startOpen ? <X className="size-4" /> : <Plus className="size-4" />}
              {startOpen ? "Zavřít" : "Zahájit dohled"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEndOpen((v) => !v);
                setStartOpen(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-3 py-1.5 text-sm font-semibold text-cream hover:bg-meadow-600"
            >
              {endOpen ? "Zavřít" : "Ukončit & uvolnit"}
            </button>
          )}
        </div>

        <p className="mt-3 text-sm text-ink-600">
          {SUPERVISION_STATUS_HELP[current]}
        </p>

        {startOpen && current === "released" && (
          <div className="mt-4 rounded-2xl bg-cream-warm/60 p-4 ring-1 ring-ink-900/8">
            <StartForm animalId={animalId} close={() => setStartOpen(false)} />
          </div>
        )}

        {endOpen && active && (
          <div className="mt-4 rounded-2xl bg-cream-warm/60 p-4 ring-1 ring-ink-900/8">
            <EndForm
              animalId={animalId}
              recordId={active.id}
              close={() => setEndOpen(false)}
            />
          </div>
        )}
      </section>

      {/* Historie epizod */}
      <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h2 className="mb-4 font-display text-xl font-bold text-ink-900">
          <span className="mr-2">🧫</span>Historie dohledu
          {history.length > 0 && (
            <span className="ml-2 text-sm font-semibold text-ink-400">
              {history.length}
            </span>
          )}
        </h2>
        {records.length === 0 ? (
          <p className="text-sm text-ink-500">Zatím žádné epizody dohledu.</p>
        ) : (
          <ul className="divide-y divide-ink-900/8">
            {records.map((r) => (
              <li key={r.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        SUPERVISION_STATUS_PILL[r.kind],
                      )}
                    >
                      {SUPERVISION_STATUS_LABEL[r.kind]}
                    </span>
                    {r.ended_on === null && (
                      <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-sage-700">
                        Probíhá
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-ink-500">
                    {formatDate(r.started_on)} –{" "}
                    {r.ended_on ? formatDate(r.ended_on) : "nyní"}
                    {r.planned_until && r.ended_on === null && (
                      <> · plán do {formatDate(r.planned_until)}</>
                    )}
                  </div>
                  {r.reason && (
                    <p className="mt-1 text-sm text-ink-700">
                      <span className="font-semibold">Důvod:</span> {r.reason}
                    </p>
                  )}
                  {r.exam_results && (
                    <p className="mt-0.5 text-sm text-ink-700">
                      <span className="font-semibold">Vyšetření:</span>{" "}
                      {r.exam_results}
                    </p>
                  )}
                  {r.vet_decision && (
                    <p className="mt-0.5 text-sm text-ink-700">
                      <span className="font-semibold">Rozhodnutí vet.:</span>{" "}
                      {r.vet_decision}
                    </p>
                  )}
                  {r.notes && (
                    <p className="mt-0.5 text-sm text-ink-600">{r.notes}</p>
                  )}
                </div>
                <DeleteButton animalId={animalId} recordId={r.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StartForm({
  animalId,
  close,
}: {
  animalId: string;
  close: () => void;
}) {
  const { pending, error, run } = useSubmit();
  const [kind, setKind] = useState<AnimalSupervisionStatus>("quarantine");
  const [startedOn, setStartedOn] = useState(today());
  const [plannedUntil, setPlannedUntil] = useState("");
  const [reason, setReason] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            startSupervision(animalId, {
              kind,
              started_on: startedOn,
              planned_until: plannedUntil,
              reason,
            }),
          close,
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Režim">
          <select
            value={kind}
            onChange={(e) =>
              setKind(e.target.value as AnimalSupervisionStatus)
            }
            className={inputCls}
          >
            {SUPERVISION_KINDS.map((k) => (
              <option key={k} value={k}>
                {SUPERVISION_STATUS_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Začátek">
          <input
            type="date"
            value={startedOn}
            onChange={(e) => setStartedOn(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Plánovaný konec">
          <input
            type="date"
            value={plannedUntil}
            onChange={(e) => setPlannedUntil(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Důvod">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="např. nově přijaté zvíře"
            className={inputCls}
          />
        </Field>
      </div>
      <SubmitRow
        pending={pending}
        error={error}
        onCancel={close}
        label="Zahájit"
      />
    </form>
  );
}

function EndForm({
  animalId,
  recordId,
  close,
}: {
  animalId: string;
  recordId: string;
  close: () => void;
}) {
  const { pending, error, run } = useSubmit();
  const [endedOn, setEndedOn] = useState(today());
  const [exam, setExam] = useState("");
  const [decision, setDecision] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            endSupervision(animalId, recordId, {
              ended_on: endedOn,
              exam_results: exam,
              vet_decision: decision,
              notes,
            }),
          close,
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Datum ukončení">
          <input
            type="date"
            value={endedOn}
            onChange={(e) => setEndedOn(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Rozhodnutí veterináře">
          <input
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            placeholder="např. uvolnit do běžné části"
            className={inputCls}
          />
        </Field>
      </div>
      <div className="mt-3 grid gap-3">
        <Field label="Výsledky vyšetření">
          <textarea
            rows={2}
            value={exam}
            onChange={(e) => setExam(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Poznámka">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <SubmitRow
        pending={pending}
        error={error}
        onCancel={close}
        label="Ukončit & uvolnit"
      />
    </form>
  );
}

function DeleteButton({
  animalId,
  recordId,
}: {
  animalId: string;
  recordId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await deleteSupervisionRecord(animalId, recordId);
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
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Smazat epizodu"
      className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-berry"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
