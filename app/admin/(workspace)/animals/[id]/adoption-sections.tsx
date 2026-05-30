"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";

import {
  ADOPTION_STAGE_LABEL,
  ADOPTION_STAGE_PILL,
  ANIMAL_EXIT_TYPE_LABEL,
  ANIMAL_EXIT_TYPE_PILL,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  AdoptionRow,
  AnimalExitRecordRow,
  AnimalExitType,
} from "@/types/database";

import {
  cancelAdoption,
  deleteAdoption,
  deleteExitRecord,
  finalizeAdoption,
  recordExit,
  startAdoption,
} from "./adoption-actions";

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

export interface ApplicationOption {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
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

export function AdoptionSection({
  animalId,
  isClosed,
  feeDefault,
  applications,
  adoptions,
  exits,
}: {
  animalId: string;
  isClosed: boolean;
  feeDefault: number | null;
  applications: ApplicationOption[];
  adoptions: AdoptionRow[];
  exits: AnimalExitRecordRow[];
}) {
  const [startOpen, setStartOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);

  const active = adoptions.find((a) => a.stage === "trial") ?? null;
  const history = adoptions.filter((a) => a.stage !== "trial");

  return (
    <div className="space-y-6">
      {/* Aktuální adopce */}
      <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink-900">
            <span className="mr-2">🏡</span>Adopce
          </h2>
          {active ? (
            <span
              className={cn(
                "rounded-full px-3 py-1 text-sm font-semibold",
                ADOPTION_STAGE_PILL[active.stage],
              )}
            >
              {ADOPTION_STAGE_LABEL[active.stage]}
            </span>
          ) : !isClosed ? (
            <button
              type="button"
              onClick={() => setStartOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-pill bg-ink-900 px-3 py-1.5 text-sm font-semibold text-cream hover:bg-ink-800"
            >
              {startOpen ? <X className="size-4" /> : <Plus className="size-4" />}
              {startOpen ? "Zavřít" : "Zahájit adopci"}
            </button>
          ) : null}
        </div>

        {active ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 rounded-2xl bg-cream-warm/60 p-4 text-sm ring-1 ring-ink-900/8 sm:grid-cols-2">
              <Detail label="Adoptant" value={active.adopter_name} />
              <Detail label="Telefon" value={active.adopter_phone} />
              <Detail label="E-mail" value={active.adopter_email} />
              <Detail label="Předáno" value={formatDate(active.started_on)} />
              <Detail
                label="Konec zkušební doby"
                value={formatDate(active.trial_until)}
              />
              <Detail
                label="Poplatek"
                value={active.fee != null ? `${active.fee} Kč` : null}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFinalizeOpen((v) => !v);
                  setCancelOpen(false);
                }}
                className="rounded-pill bg-meadow-500 px-4 py-1.5 text-sm font-semibold text-cream hover:bg-meadow-600"
              >
                {finalizeOpen ? "Zavřít" : "Uzavřít trvalou adopci"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCancelOpen((v) => !v);
                  setFinalizeOpen(false);
                }}
                className="rounded-pill bg-cream-warm px-4 py-1.5 text-sm font-semibold text-ink-700 hover:bg-ink-900/8"
              >
                {cancelOpen ? "Zavřít" : "Zrušit / vrátit"}
              </button>
            </div>

            {finalizeOpen && (
              <div className="rounded-2xl bg-cream-warm/60 p-4 ring-1 ring-ink-900/8">
                <FinalizeForm
                  animalId={animalId}
                  adoptionId={active.id}
                  feeDefault={active.fee ?? feeDefault}
                  close={() => setFinalizeOpen(false)}
                />
              </div>
            )}
            {cancelOpen && (
              <div className="rounded-2xl bg-cream-warm/60 p-4 ring-1 ring-ink-900/8">
                <CancelForm
                  animalId={animalId}
                  adoptionId={active.id}
                  close={() => setCancelOpen(false)}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-600">
            {isClosed
              ? "Zvíře je v uzavřeném stavu (adoptováno / vráceno / úhyn)."
              : "Žádná běžící adopce. Zahaj zkušební dobu nebo rovnou trvalou adopci."}
          </p>
        )}

        {startOpen && !active && !isClosed && (
          <div className="mt-4 rounded-2xl bg-cream-warm/60 p-4 ring-1 ring-ink-900/8">
            <StartForm
              animalId={animalId}
              feeDefault={feeDefault}
              applications={applications}
              close={() => setStartOpen(false)}
            />
          </div>
        )}
      </section>

      {/* Historie adopcí */}
      {history.length > 0 && (
        <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
          <h2 className="mb-4 font-display text-xl font-bold text-ink-900">
            Historie adopcí
            <span className="ml-2 text-sm font-semibold text-ink-400">
              {history.length}
            </span>
          </h2>
          <ul className="divide-y divide-ink-900/8">
            {history.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink-900">
                      {a.adopter_name}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        ADOPTION_STAGE_PILL[a.stage],
                      )}
                    >
                      {ADOPTION_STAGE_LABEL[a.stage]}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-ink-500">
                    {formatDate(a.started_on)} –{" "}
                    {a.stage === "finalized"
                      ? formatDate(a.finalized_on)
                      : formatDate(a.cancelled_on)}
                    {a.fee != null && a.stage === "finalized" && (
                      <> · {a.fee} Kč</>
                    )}
                  </div>
                  {a.cancel_reason && (
                    <p className="mt-1 text-sm text-ink-600">
                      {a.cancel_reason}
                    </p>
                  )}
                </div>
                <DeleteButton
                  onConfirm={() => deleteAdoption(animalId, a.id)}
                  confirmText="Opravdu smazat tento záznam o adopci?"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Výstupy — vrácení / úhyn / utracení */}
      <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink-900">
            Výstupy
            {exits.length > 0 && (
              <span className="ml-2 text-sm font-semibold text-ink-400">
                {exits.length}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => setExitOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-pill bg-cream-warm px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-ink-900/8"
          >
            {exitOpen ? <X className="size-4" /> : <Plus className="size-4" />}
            {exitOpen ? "Zavřít" : "Zaznamenat výstup"}
          </button>
        </div>

        {exitOpen && (
          <div className="mt-4 rounded-2xl bg-cream-warm/60 p-4 ring-1 ring-ink-900/8">
            <ExitForm animalId={animalId} close={() => setExitOpen(false)} />
          </div>
        )}

        {exits.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">Žádné výstupní záznamy.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-900/8">
            {exits.map((e) => (
              <li key={e.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        ANIMAL_EXIT_TYPE_PILL[e.kind],
                      )}
                    >
                      {ANIMAL_EXIT_TYPE_LABEL[e.kind]}
                    </span>
                    <span className="text-sm text-ink-500">
                      {formatDate(e.occurred_on)}
                    </span>
                  </div>
                  {e.reason && (
                    <p className="mt-1 text-sm text-ink-700">
                      <span className="font-semibold">Důvod:</span> {e.reason}
                    </p>
                  )}
                  {e.vet && (
                    <p className="mt-0.5 text-sm text-ink-700">
                      <span className="font-semibold">Veterinář:</span> {e.vet}
                    </p>
                  )}
                  {e.details && (
                    <p className="mt-0.5 text-sm text-ink-600">{e.details}</p>
                  )}
                </div>
                <DeleteButton
                  onConfirm={() => deleteExitRecord(animalId, e.id)}
                  confirmText="Opravdu smazat tento výstupní záznam?"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
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

function StartForm({
  animalId,
  feeDefault,
  applications,
  close,
}: {
  animalId: string;
  feeDefault: number | null;
  applications: ApplicationOption[];
  close: () => void;
}) {
  const { pending, error, run } = useSubmit();
  const [applicationId, setApplicationId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [startedOn, setStartedOn] = useState(today());
  const [trialUntil, setTrialUntil] = useState("");
  const [fee, setFee] = useState(feeDefault != null ? String(feeDefault) : "");
  const [contractSignedAt, setContractSignedAt] = useState("");
  const [contractUrl, setContractUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [finalizeNow, setFinalizeNow] = useState(false);

  function pickApplication(id: string) {
    setApplicationId(id);
    const app = applications.find((a) => a.id === id);
    if (app) {
      setName(app.name);
      setEmail(app.email ?? "");
      setPhone(app.phone ?? "");
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            startAdoption(animalId, {
              application_id: applicationId || null,
              adopter_name: name,
              adopter_email: email,
              adopter_phone: phone,
              adopter_address: address,
              adopter_id_number: idNumber,
              started_on: startedOn,
              trial_until: trialUntil,
              fee: fee ? Number(fee) : null,
              contract_signed_at: contractSignedAt,
              contract_url: contractUrl,
              notes,
              finalize_immediately: finalizeNow,
            }),
          close,
        );
      }}
    >
      {applications.length > 0 && (
        <div className="mb-3">
          <Field label="Předvyplnit ze schválené žádosti">
            <select
              value={applicationId}
              onChange={(e) => pickApplication(e.target.value)}
              className={inputCls}
            >
              <option value="">— ručně —</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Jméno adoptanta *">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Telefon">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Číslo dokladu (OP)">
          <input
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Adresa">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Předáno">
          <input
            type="date"
            value={startedOn}
            onChange={(e) => setStartedOn(e.target.value)}
            className={inputCls}
          />
        </Field>
        {!finalizeNow && (
          <Field label="Konec zkušební doby">
            <input
              type="date"
              value={trialUntil}
              onChange={(e) => setTrialUntil(e.target.value)}
              className={inputCls}
            />
          </Field>
        )}
        <Field label="Poplatek (Kč)">
          <input
            type="number"
            min={0}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className={inputCls}
          />
        </Field>
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
      <label className="mt-3 flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={finalizeNow}
          onChange={(e) => setFinalizeNow(e.target.checked)}
          className="size-5 rounded accent-meadow-500"
        />
        <span className="text-sm font-semibold text-ink-900">
          Uzavřít rovnou jako trvalou adopci (bez zkušební doby)
        </span>
      </label>
      <SubmitRow
        pending={pending}
        error={error}
        onCancel={close}
        label={finalizeNow ? "Adoptovat" : "Zahájit adopci"}
      />
    </form>
  );
}

function FinalizeForm({
  animalId,
  adoptionId,
  feeDefault,
  close,
}: {
  animalId: string;
  adoptionId: string;
  feeDefault: number | null;
  close: () => void;
}) {
  const { pending, error, run } = useSubmit();
  const [finalizedOn, setFinalizedOn] = useState(today());
  const [fee, setFee] = useState(feeDefault != null ? String(feeDefault) : "");
  const [contractSignedAt, setContractSignedAt] = useState("");
  const [contractUrl, setContractUrl] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            finalizeAdoption(animalId, adoptionId, {
              finalized_on: finalizedOn,
              fee: fee ? Number(fee) : null,
              contract_signed_at: contractSignedAt,
              contract_url: contractUrl,
            }),
          close,
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Datum trvalé adopce">
          <input
            type="date"
            value={finalizedOn}
            onChange={(e) => setFinalizedOn(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Poplatek (Kč)">
          <input
            type="number"
            min={0}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className={inputCls}
          />
        </Field>
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
      <SubmitRow
        pending={pending}
        error={error}
        onCancel={close}
        label="Uzavřít adopci"
      />
    </form>
  );
}

const RETURN_OPTIONS: {
  value: "available" | "returned" | "intake";
  label: string;
}[] = [
  { value: "available", label: "Zpět k adopci (dostupné)" },
  { value: "returned", label: "Vráceno (mimo katalog)" },
  { value: "intake", label: "Zpět na příjem" },
];

function CancelForm({
  animalId,
  adoptionId,
  close,
}: {
  animalId: string;
  adoptionId: string;
  close: () => void;
}) {
  const { pending, error, run } = useSubmit();
  const [cancelledOn, setCancelledOn] = useState(today());
  const [reason, setReason] = useState("");
  const [returnStatus, setReturnStatus] = useState<
    "available" | "returned" | "intake"
  >("available");
  const [recordReturn, setRecordReturn] = useState(true);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            cancelAdoption(animalId, adoptionId, {
              cancelled_on: cancelledOn,
              cancel_reason: reason,
              return_status: returnStatus,
              record_return: recordReturn,
            }),
          close,
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Datum zrušení">
          <input
            type="date"
            value={cancelledOn}
            onChange={(e) => setCancelledOn(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Vrátit do stavu">
          <select
            value={returnStatus}
            onChange={(e) =>
              setReturnStatus(
                e.target.value as "available" | "returned" | "intake",
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
      <div className="mt-3">
        <Field label="Důvod zrušení / vrácení">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={recordReturn}
          onChange={(e) => setRecordReturn(e.target.checked)}
          className="size-5 rounded accent-meadow-500"
        />
        <span className="text-sm font-semibold text-ink-900">
          Založit i strukturovaný záznam o vrácení
        </span>
      </label>
      <SubmitRow
        pending={pending}
        error={error}
        onCancel={close}
        label="Zrušit adopci"
      />
    </form>
  );
}

const EXIT_OPTIONS: { value: AnimalExitType; label: string }[] = [
  { value: "return", label: ANIMAL_EXIT_TYPE_LABEL.return },
  { value: "death", label: ANIMAL_EXIT_TYPE_LABEL.death },
  { value: "euthanasia", label: ANIMAL_EXIT_TYPE_LABEL.euthanasia },
];

function ExitForm({
  animalId,
  close,
}: {
  animalId: string;
  close: () => void;
}) {
  const { pending, error, run } = useSubmit();
  const [kind, setKind] = useState<AnimalExitType>("return");
  const [occurredOn, setOccurredOn] = useState(today());
  const [reason, setReason] = useState("");
  const [vet, setVet] = useState("");
  const [details, setDetails] = useState("");
  const isDeath = kind !== "return";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            recordExit(animalId, {
              kind,
              occurred_on: occurredOn,
              reason,
              details,
              vet,
            }),
          close,
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Typ výstupu">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as AnimalExitType)}
            className={inputCls}
          >
            {EXIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
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
        <Field label={isDeath ? "Příčina" : "Důvod vrácení"}>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputCls}
          />
        </Field>
        {isDeath && (
          <Field label="Veterinář">
            <input
              value={vet}
              onChange={(e) => setVet(e.target.value)}
              className={inputCls}
            />
          </Field>
        )}
      </div>
      <div className="mt-3">
        <Field label="Okolnosti / poznámka">
          <textarea
            rows={2}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
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
