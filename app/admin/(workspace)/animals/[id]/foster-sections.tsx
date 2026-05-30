"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  deleteFosterPlacement,
  endFosterPlacement,
  startFosterPlacement,
} from "./foster-actions";

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

export interface CarerOption {
  id: string;
  name: string;
}

export interface PlacementItem {
  id: string;
  carerId: string;
  carerName: string;
  started_on: string;
  planned_until: string | null;
  ended_on: string | null;
  end_reason: string | null;
  fee: number | null;
  contract_signed_at: string | null;
  contract_url: string | null;
  notes: string | null;
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

export function FosterSection({
  animalId,
  carers,
  feeEnabled,
  placements,
}: {
  animalId: string;
  carers: CarerOption[];
  feeEnabled: boolean;
  placements: PlacementItem[];
}) {
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const active = placements.find((p) => p.ended_on === null) ?? null;
  const history = placements.filter((p) => p.ended_on !== null);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {active ? (
              <>
                <span className="rounded-full bg-sage-100 px-3 py-1 text-sm font-semibold text-sage-700">
                  V dočasné péči
                </span>
                <Link
                  href={`/admin/foster/${active.carerId}`}
                  className="text-sm font-semibold text-ink-700 hover:underline"
                >
                  {active.carerName}
                </Link>
              </>
            ) : (
              <span className="rounded-full bg-ink-900/8 px-3 py-1 text-sm font-semibold text-ink-500">
                Není v dočasné péči
              </span>
            )}
          </div>
          {active ? (
            <button
              type="button"
              onClick={() => {
                setEndOpen((v) => !v);
                setStartOpen(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-3 py-1.5 text-sm font-semibold text-cream hover:bg-meadow-600"
            >
              {endOpen ? "Zavřít" : "Ukončit dočasnou péči"}
            </button>
          ) : carers.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setStartOpen((v) => !v);
                setEndOpen(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-pill bg-ink-900 px-3 py-1.5 text-sm font-semibold text-cream hover:bg-ink-800"
            >
              {startOpen ? <X className="size-4" /> : <Plus className="size-4" />}
              {startOpen ? "Zavřít" : "Předat pěstounovi"}
            </button>
          ) : null}
        </div>

        <p className="mt-3 text-sm text-ink-600">
          Dočasná péče je možná i během ochranné lhůty. Zvíře zůstává majetkem
          útulku — pěstoun se o něj jen stará mimo útulek.
        </p>

        {carers.length === 0 && !active && (
          <p className="mt-3 text-sm text-ink-500">
            Zatím nemáš žádné pěstouny.{" "}
            <Link href="/admin/foster" className="font-semibold underline">
              Přidej prvního
            </Link>
            .
          </p>
        )}

        {active?.planned_until && (
          <p className="mt-2 text-sm text-ink-500">
            Plánovaný návrat: {formatDate(active.planned_until)}
          </p>
        )}

        {startOpen && !active && (
          <div className="mt-4 rounded-2xl bg-cream-warm/60 p-4 ring-1 ring-ink-900/8">
            <StartForm
              animalId={animalId}
              carers={carers}
              feeEnabled={feeEnabled}
              close={() => setStartOpen(false)}
            />
          </div>
        )}

        {endOpen && active && (
          <div className="mt-4 rounded-2xl bg-cream-warm/60 p-4 ring-1 ring-ink-900/8">
            <EndForm
              animalId={animalId}
              placementId={active.id}
              close={() => setEndOpen(false)}
            />
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h2 className="mb-4 font-display text-xl font-bold text-ink-900">
          <span className="mr-2">🏡</span>Historie dočasné péče
          {history.length > 0 && (
            <span className="ml-2 text-sm font-semibold text-ink-400">
              {history.length}
            </span>
          )}
        </h2>
        {placements.length === 0 ? (
          <p className="text-sm text-ink-500">Zatím žádná umístění.</p>
        ) : (
          <ul className="divide-y divide-ink-900/8">
            {placements.map((p) => (
              <li key={p.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/foster/${p.carerId}`}
                      className="font-semibold text-ink-900 hover:underline"
                    >
                      {p.carerName}
                    </Link>
                    {p.ended_on === null && (
                      <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-sage-700">
                        Probíhá
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-ink-500">
                    {formatDate(p.started_on)} –{" "}
                    {p.ended_on ? formatDate(p.ended_on) : "nyní"}
                    {p.planned_until && p.ended_on === null && (
                      <> · plán do {formatDate(p.planned_until)}</>
                    )}
                    {p.fee != null && <> · {p.fee} Kč</>}
                  </div>
                  {p.end_reason && (
                    <p className="mt-1 text-sm text-ink-700">
                      <span className="font-semibold">Ukončení:</span>{" "}
                      {p.end_reason}
                    </p>
                  )}
                  {p.contract_url && (
                    <a
                      href={p.contract_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-block text-sm font-semibold text-meadow-600 hover:underline"
                    >
                      Smlouva
                    </a>
                  )}
                  {p.notes && (
                    <p className="mt-0.5 text-sm text-ink-600">{p.notes}</p>
                  )}
                </div>
                <DeletePlacement animalId={animalId} placementId={p.id} />
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
  carers,
  feeEnabled,
  close,
}: {
  animalId: string;
  carers: CarerOption[];
  feeEnabled: boolean;
  close: () => void;
}) {
  const { pending, error, run } = useSubmit();
  const [carerId, setCarerId] = useState(carers[0]?.id ?? "");
  const [startedOn, setStartedOn] = useState(today());
  const [plannedUntil, setPlannedUntil] = useState("");
  const [fee, setFee] = useState("");
  const [contractSignedAt, setContractSignedAt] = useState("");
  const [contractUrl, setContractUrl] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            startFosterPlacement(animalId, {
              carer_id: carerId,
              started_on: startedOn,
              planned_until: plannedUntil,
              fee: fee ? Number(fee) : null,
              contract_signed_at: contractSignedAt,
              contract_url: contractUrl,
              notes,
            }),
          close,
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pěstoun *">
          <select
            value={carerId}
            onChange={(e) => setCarerId(e.target.value)}
            className={inputCls}
            required
          >
            {carers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
        <Field label="Plánovaný návrat">
          <input
            type="date"
            value={plannedUntil}
            onChange={(e) => setPlannedUntil(e.target.value)}
            className={inputCls}
          />
        </Field>
        {feeEnabled && (
          <Field label="Příspěvek (Kč)">
            <input
              type="number"
              min={0}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className={inputCls}
            />
          </Field>
        )}
        <Field label="Smlouva podepsána">
          <input
            type="date"
            value={contractSignedAt}
            onChange={(e) => setContractSignedAt(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Odkaz na smlouvu">
          <input
            value={contractUrl}
            onChange={(e) => setContractUrl(e.target.value)}
            placeholder="https://…"
            className={inputCls}
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Poznámka">
          <textarea
            rows={2}
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
        label="Předat do péče"
      />
    </form>
  );
}

const RETURN_OPTIONS: { value: "available" | "intake" | "keep"; label: string }[] =
  [
    { value: "available", label: "Zpět k adopci (dostupné)" },
    { value: "intake", label: "Zpět na příjem" },
    { value: "keep", label: "Ponechat stávající stav" },
  ];

function EndForm({
  animalId,
  placementId,
  close,
}: {
  animalId: string;
  placementId: string;
  close: () => void;
}) {
  const { pending, error, run } = useSubmit();
  const [endedOn, setEndedOn] = useState(today());
  const [endReason, setEndReason] = useState("");
  const [returnStatus, setReturnStatus] = useState<
    "available" | "intake" | "keep"
  >("available");
  const [notes, setNotes] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            endFosterPlacement(animalId, placementId, {
              ended_on: endedOn,
              end_reason: endReason,
              return_status: returnStatus,
              notes,
            }),
          close,
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Konec">
          <input
            type="date"
            value={endedOn}
            onChange={(e) => setEndedOn(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Vrátit do stavu">
          <select
            value={returnStatus}
            onChange={(e) =>
              setReturnStatus(
                e.target.value as "available" | "intake" | "keep",
              )
            }
            className={inputCls}
          >
            {RETURN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3 space-y-3">
        <Field label="Důvod ukončení">
          <input
            value={endReason}
            onChange={(e) => setEndReason(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Poznámka">
          <textarea
            rows={2}
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
        label="Ukončit péči"
      />
    </form>
  );
}

function DeletePlacement({
  animalId,
  placementId,
}: {
  animalId: string;
  placementId: string;
}) {
  const { pending, error, run } = useSubmit();
  return (
    <button
      type="button"
      title={error ?? "Smazat záznam"}
      disabled={pending}
      onClick={() => {
        if (!confirm("Opravdu smazat tento záznam o dočasné péči?")) return;
        run(() => deleteFosterPlacement(animalId, placementId), () => {});
      }}
      className="rounded-lg p-1.5 text-ink-300 hover:bg-berry/10 hover:text-berry disabled:opacity-50"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
