"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";

import {
  ANIMAL_COST_CATEGORIES,
  ANIMAL_COST_CATEGORY_LABEL,
  ANIMAL_INCIDENT_TYPE_LABEL,
  ANIMAL_INCIDENT_TYPE_PILL,
  ANIMAL_INCIDENT_TYPES,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  AnimalCostCategory,
  AnimalCostRow,
  AnimalIncidentRow,
  AnimalIncidentType,
} from "@/types/database";

import {
  addCost,
  addIncident,
  deleteCost,
  deleteIncident,
  resolveIncident,
} from "./evidence-actions";

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

const czk = (n: number) =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(n);

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

export function EvidenceSection({
  animalId,
  costs,
  incidents,
}: {
  animalId: string;
  costs: AnimalCostRow[];
  incidents: AnimalIncidentRow[];
}) {
  const [costOpen, setCostOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);

  const total = costs.reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div className="space-y-6">
      {/* Náklady */}
      <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink-900">
            <span className="mr-2">💰</span>Náklady
            {costs.length > 0 && (
              <span className="ml-2 text-sm font-semibold text-ink-400">
                {czk(total)}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => setCostOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-pill bg-cream-warm px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-ink-900/8"
          >
            {costOpen ? <X className="size-4" /> : <Plus className="size-4" />}
            {costOpen ? "Zavřít" : "Přidat náklad"}
          </button>
        </div>

        {costOpen && (
          <div className="mt-4 rounded-2xl bg-cream-warm/60 p-4 ring-1 ring-ink-900/8">
            <CostForm animalId={animalId} close={() => setCostOpen(false)} />
          </div>
        )}

        {costs.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">Zatím žádné náklady.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-900/8">
            {costs.map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-ink-900/8 px-2 py-0.5 text-xs font-semibold text-ink-600">
                      {ANIMAL_COST_CATEGORY_LABEL[c.category]}
                    </span>
                    <span className="font-semibold text-ink-900">
                      {czk(Number(c.amount))}
                    </span>
                    <span className="text-sm text-ink-500">
                      {formatDate(c.spent_on)}
                    </span>
                  </div>
                  {c.description && (
                    <p className="mt-1 text-sm text-ink-600">{c.description}</p>
                  )}
                  {c.invoice_url && (
                    <a
                      href={c.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-block text-sm font-semibold text-meadow-600 hover:underline"
                    >
                      Faktura
                    </a>
                  )}
                </div>
                <DeleteButton
                  onConfirm={() => deleteCost(animalId, c.id)}
                  confirmText="Opravdu smazat tento náklad?"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Incidenty / úniky */}
      <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink-900">
            <span className="mr-2">⚠️</span>Mimořádné události
            {incidents.length > 0 && (
              <span className="ml-2 text-sm font-semibold text-ink-400">
                {incidents.length}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => setIncidentOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-pill bg-cream-warm px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-ink-900/8"
          >
            {incidentOpen ? (
              <X className="size-4" />
            ) : (
              <Plus className="size-4" />
            )}
            {incidentOpen ? "Zavřít" : "Zaznamenat událost"}
          </button>
        </div>

        {incidentOpen && (
          <div className="mt-4 rounded-2xl bg-cream-warm/60 p-4 ring-1 ring-ink-900/8">
            <IncidentForm
              animalId={animalId}
              close={() => setIncidentOpen(false)}
            />
          </div>
        )}

        {incidents.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">Žádné události.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-900/8">
            {incidents.map((i) => (
              <IncidentItem key={i.id} animalId={animalId} incident={i} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CostForm({
  animalId,
  close,
}: {
  animalId: string;
  close: () => void;
}) {
  const { pending, error, run } = useSubmit();
  const [category, setCategory] = useState<AnimalCostCategory>("vet");
  const [amount, setAmount] = useState("");
  const [spentOn, setSpentOn] = useState(today());
  const [description, setDescription] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            addCost(animalId, {
              category,
              amount: amount ? Number(amount) : 0,
              spent_on: spentOn,
              description,
              invoice_url: invoiceUrl,
            }),
          close,
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kategorie">
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as AnimalCostCategory)
            }
            className={inputCls}
          >
            {ANIMAL_COST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {ANIMAL_COST_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Částka (Kč) *">
          <input
            type="number"
            min={0}
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Datum">
          <input
            type="date"
            value={spentOn}
            onChange={(e) => setSpentOn(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Odkaz na fakturu">
          <input
            value={invoiceUrl}
            onChange={(e) => setInvoiceUrl(e.target.value)}
            placeholder="https://…"
            className={inputCls}
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Popis">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <SubmitRow
        pending={pending}
        error={error}
        onCancel={close}
        label="Přidat náklad"
      />
    </form>
  );
}

function IncidentForm({
  animalId,
  close,
}: {
  animalId: string;
  close: () => void;
}) {
  const { pending, error, run } = useSubmit();
  const [kind, setKind] = useState<AnimalIncidentType>("escape");
  const [occurredOn, setOccurredOn] = useState(today());
  const [resolvedOn, setResolvedOn] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [resolution, setResolution] = useState("");
  const [reportedTo, setReportedTo] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            addIncident(animalId, {
              kind,
              occurred_on: occurredOn,
              resolved_on: resolvedOn,
              location,
              description,
              resolution,
              reported_to: reportedTo,
            }),
          close,
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Typ události">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as AnimalIncidentType)}
            className={inputCls}
          >
            {ANIMAL_INCIDENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ANIMAL_INCIDENT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Datum">
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Vyřešeno dne">
          <input
            type="date"
            value={resolvedOn}
            onChange={(e) => setResolvedOn(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Místo">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Nahlášeno (policie, KVS…)">
          <input
            value={reportedTo}
            onChange={(e) => setReportedTo(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <div className="mt-3 space-y-3">
        <Field label="Popis události">
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Jak vyřešeno">
          <input
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <SubmitRow
        pending={pending}
        error={error}
        onCancel={close}
        label="Zaznamenat"
      />
    </form>
  );
}

function IncidentItem({
  animalId,
  incident,
}: {
  animalId: string;
  incident: AnimalIncidentRow;
}) {
  const [resolving, setResolving] = useState(false);
  const { pending, error, run } = useSubmit();
  const [resolvedOn, setResolvedOn] = useState(today());
  const [resolution, setResolution] = useState("");

  return (
    <li className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              ANIMAL_INCIDENT_TYPE_PILL[incident.kind],
            )}
          >
            {ANIMAL_INCIDENT_TYPE_LABEL[incident.kind]}
          </span>
          <span className="text-sm text-ink-500">
            {formatDate(incident.occurred_on)}
          </span>
          {incident.resolved_on ? (
            <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-sage-700">
              Vyřešeno {formatDate(incident.resolved_on)}
            </span>
          ) : (
            <span className="rounded-full bg-peach-200 px-2 py-0.5 text-xs font-semibold text-terracotta-600">
              Neuzavřeno
            </span>
          )}
        </div>
        {incident.location && (
          <p className="mt-1 text-sm text-ink-600">
            <span className="font-semibold">Místo:</span> {incident.location}
          </p>
        )}
        {incident.description && (
          <p className="mt-0.5 text-sm text-ink-700">{incident.description}</p>
        )}
        {incident.reported_to && (
          <p className="mt-0.5 text-sm text-ink-600">
            <span className="font-semibold">Nahlášeno:</span>{" "}
            {incident.reported_to}
          </p>
        )}
        {incident.resolution && (
          <p className="mt-0.5 text-sm text-ink-600">
            <span className="font-semibold">Řešení:</span>{" "}
            {incident.resolution}
          </p>
        )}

        {!incident.resolved_on &&
          (resolving ? (
            <form
              className="mt-2 flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    resolveIncident(animalId, incident.id, {
                      resolved_on: resolvedOn,
                      resolution,
                    }),
                  () => setResolving(false),
                );
              }}
            >
              <input
                type="date"
                value={resolvedOn}
                onChange={(e) => setResolvedOn(e.target.value)}
                className={cn(inputCls, "w-auto")}
              />
              <input
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Jak vyřešeno"
                className={cn(inputCls, "w-auto flex-1")}
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-pill bg-meadow-500 px-3 py-1.5 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
              >
                Uzavřít
              </button>
              {error && <span className="text-xs text-berry">{error}</span>}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setResolving(true)}
              className="mt-2 rounded-pill bg-cream-warm px-3 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-900/8"
            >
              Označit jako vyřešené
            </button>
          ))}
      </div>
      <DeleteButton
        onConfirm={() => deleteIncident(animalId, incident.id)}
        confirmText="Opravdu smazat tento záznam?"
      />
    </li>
  );
}

function DeleteButton({
  onConfirm,
  confirmText,
}: {
  onConfirm: () => Promise<ActionResult>;
  confirmText: string;
}) {
  const { pending, error, run } = useSubmit();
  return (
    <button
      type="button"
      title={error ?? "Smazat"}
      disabled={pending}
      onClick={() => {
        if (!confirm(confirmText)) return;
        run(onConfirm, () => {});
      }}
      className="rounded-lg p-1.5 text-ink-300 hover:bg-berry/10 hover:text-berry disabled:opacity-50"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
