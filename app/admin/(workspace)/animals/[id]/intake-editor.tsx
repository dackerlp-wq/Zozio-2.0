"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, RotateCw } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ANIMAL_INTAKE_TYPE_LABEL,
  ANIMAL_LEGAL_STATUS_LABEL,
  CHIP_CHECK_RESULT_LABEL,
  INTAKE_STAFF_ROLES,
  INTAKE_TYPE_ICON,
  INTAKE_TYPE_LEGAL_NOTE,
  VET_CARE_NEED_LABEL,
} from "@/lib/format";
import type {
  AnimalIntakeType,
  AnimalLegalStatus,
  AnimalVetCareNeed,
  ChipCheckResult,
} from "@/types/database";

import {
  saveIntake,
  setLegalStatus,
  suggestRecordNumber,
  type IntakeFormValues,
} from "./intake-actions";

const INTAKE_TYPES: AnimalIntakeType[] = [
  "found",
  "surrender",
  "transfer",
  "confiscation",
  "born",
  "other",
];

const LEGAL_STATUSES: AnimalLegalStatus[] = [
  "in_protection",
  "shelter_owned",
  "owner_claimed",
  "transferred_out",
];

type IdMethod = "chip" | "tattoo" | "ear_tag" | "none" | "";

function initialIdMethod(v: IntakeFormValues): IdMethod {
  if (v.chip_number?.trim()) return "chip";
  if (v.tattoo?.trim()) return "tattoo";
  if (v.ear_tag?.trim()) return "ear_tag";
  if (v.identification_none) return "none";
  return "";
}

export function IntakeEditor({
  animalId,
  initial,
  legalStatus,
  protectionMonths,
  readOnly,
}: {
  animalId: string;
  initial: IntakeFormValues;
  legalStatus: AnimalLegalStatus;
  protectionMonths: number;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [legalPending, setLegalPending] = useState(false);
  const [confirmClaim, setConfirmClaim] = useState(false);

  const base = useMemo(
    () => ({ ...initial, idMethod: initialIdMethod(initial) }),
    [initial],
  );
  const [form, setForm] = useState(base);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(base),
    [form, base],
  );

  const isFound = form.intake_type === "found" || form.intake_type === "confiscation";

  // --- Ochranná lhůta progress ---
  const protStart = initial.announced_at || initial.found_date || null;
  const protEnd = initial.protection_until || null;
  const protProgress = useMemo(() => {
    if (legalStatus !== "in_protection" || !protEnd) return null;
    // Start lhůty: oznámeno/nález, jinak dopočítej z konce a délky lhůty.
    const startIso = protStart ?? subtractMonths(protEnd, protectionMonths);
    const start = new Date(startIso + "T00:00:00").getTime();
    const end = new Date(protEnd + "T00:00:00").getTime();
    const now = Date.now();
    const pct =
      end > start
        ? Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)))
        : 0;
    const daysLeft = Math.ceil((end - now) / 86_400_000);
    return { pct, daysLeft, start: startIso, end: protEnd };
  }, [legalStatus, protStart, protEnd, protectionMonths]);

  function suggest() {
    startTransition(async () => {
      const res = await suggestRecordNumber();
      if ("ok" in res) set("record_number", res.value);
      else setError(res.error);
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const values: IntakeFormValues = {
        ...form,
        // Identifikace dle vybrané metody.
        chip_number: form.idMethod === "chip" ? form.chip_number : "",
        tattoo: form.idMethod === "tattoo" ? form.tattoo : "",
        ear_tag: form.idMethod === "ear_tag" ? form.ear_tag : "",
        identification_none: form.idMethod === "none",
        // Datum nálezu jen u nálezu/odebrání.
        found_date: isFound ? form.found_date : "",
      };
      const res = await saveIntake(animalId, values);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  }

  function changeLegal(status: AnimalLegalStatus) {
    if (status === legalStatus) return;
    if (status === "owner_claimed") {
      setConfirmClaim(true);
      return;
    }
    runLegal(status);
  }

  function runLegal(status: AnimalLegalStatus) {
    setError(null);
    setLegalPending(true);
    (async () => {
      const res = await setLegalStatus(animalId, status);
      setLegalPending(false);
      setConfirmClaim(false);
      if ("error" in res) setError(res.error);
      else router.refresh();
    })();
  }

  const disabled = readOnly || isPending;

  return (
    <div className="space-y-5">
      {/* Banner ochranné lhůty */}
      {protProgress && (
        <div className="flex items-start gap-3 rounded-xl bg-sunshine-200 p-4 ring-1 ring-inset ring-sunshine-400/40">
          <span className="text-2xl leading-none">⏳</span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-ink-900">
              V ochranné lhůtě — zbývá {Math.max(0, protProgress.daysLeft)} dní
            </p>
            <p className="mt-0.5 text-sm text-ink-700">
              Lhůta běží od <strong>{czDate(protProgress.start)}</strong> do{" "}
              <strong>{czDate(protProgress.end)}</strong> ({protectionMonths} měsíce
              dle § 1058 OZ / zákona 246/1992 Sb.). Původní majitel se může přihlásit.
            </p>
            <div className="mt-2.5 h-2 overflow-hidden rounded-pill bg-sunshine-400/30">
              <div
                className="h-full rounded-pill bg-sunshine-500"
                style={{ width: `${protProgress.pct}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] font-bold text-ink-600">
              <span>{czDate(protProgress.start)}</span>
              <span>{protProgress.pct} % uplynulo</span>
              <span>{czDate(protProgress.end)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Způsob příjmu */}
      <Card title="📥 Způsob příjmu" sub="Určuje právní režim — nález a odebrání spouští ochrannou lhůtu">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {INTAKE_TYPES.map((t) => {
            const on = form.intake_type === t;
            return (
              <button
                key={t}
                type="button"
                disabled={disabled}
                onClick={() => set("intake_type", t)}
                className={cn(
                  "rounded-md border-[1.5px] p-3 text-center text-sm font-semibold transition-colors disabled:opacity-50",
                  on
                    ? "border-meadow-500 bg-meadow-50 text-meadow-700"
                    : "border-ink-900/15 bg-cream text-ink-700 hover:border-meadow-500",
                )}
              >
                <span className="mb-1 block text-xl">{INTAKE_TYPE_ICON[t]}</span>
                {ANIMAL_INTAKE_TYPE_LABEL[t]}
                {INTAKE_TYPE_LEGAL_NOTE[t] && (
                  <small className="mt-0.5 block text-[11px] font-semibold text-ink-400">
                    {INTAKE_TYPE_LEGAL_NOTE[t]}
                  </small>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <FieldLabel>Evidenční číslo</FieldLabel>
            <input
              className="admin-input"
              value={form.record_number}
              disabled={disabled}
              onChange={(e) => set("record_number", e.target.value)}
            />
            {!readOnly && (
              <button
                type="button"
                onClick={suggest}
                disabled={isPending}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-meadow-600 hover:text-meadow-700"
              >
                <RotateCw className="size-3.5" /> Navrhnout další volné
              </button>
            )}
          </div>
          <div>
            <FieldLabel>Datum příjmu</FieldLabel>
            <input
              type="date"
              className="admin-input"
              value={form.intake_date}
              disabled={disabled}
              onChange={(e) => set("intake_date", e.target.value)}
            />
          </div>
          {isFound && (
            <div>
              <FieldLabel>Datum nálezu</FieldLabel>
              <input
                type="date"
                className="admin-input"
                value={form.found_date}
                disabled={disabled}
                onChange={(e) => set("found_date", e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="mt-3">
          <FieldLabel>Místo nálezu / okolnosti</FieldLabel>
          <textarea
            className="admin-input min-h-16 resize-y"
            value={form.found_location}
            disabled={disabled}
            onChange={(e) => set("found_location", e.target.value)}
          />
        </div>

        {/* Podmíněný blok zdroje */}
        <SourceBlock
          type={form.intake_type}
          form={form}
          set={set}
          disabled={disabled}
        />
      </Card>

      {/* Personál & evidence */}
      <Card title="📝 Personál & evidence" sub="Kdo zvíře přijal a vnější evidenční čísla">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Přijal — jméno</FieldLabel>
            <input
              className="admin-input"
              value={form.intake_staff}
              disabled={disabled}
              onChange={(e) => set("intake_staff", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Role</FieldLabel>
            <select
              className="admin-input"
              value={form.intake_staff_role}
              disabled={disabled}
              onChange={(e) => set("intake_staff_role", e.target.value)}
            >
              <option value="">—</option>
              {INTAKE_STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel optional>Evidenční číslo obce</FieldLabel>
            <input
              className="admin-input"
              placeholder="např. OÚ Zájezd 14/2026"
              value={form.municipality_ref}
              disabled={disabled}
              onChange={(e) => set("municipality_ref", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel optional>Registr nalezenců</FieldLabel>
            <input
              className="admin-input"
              placeholder="odkaz / číslo záznamu"
              value={form.registry_name}
              disabled={disabled}
              onChange={(e) => set("registry_name", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3">
          <FieldLabel>Poznámky k příjmu</FieldLabel>
          <textarea
            className="admin-input min-h-16 resize-y"
            placeholder="Interní poznámky — stav při příjmu, předané věci, dohody…"
            value={form.intake_notes}
            disabled={disabled}
            onChange={(e) => set("intake_notes", e.target.value)}
          />
        </div>
      </Card>

      {/* Identifikace */}
      <Card title="🔖 Identifikace" sub="Tvrdý bod připravenosti k adopci — vyber jednu možnost">
        <div className="space-y-2">
          <IdRow
            active={form.idMethod === "chip"}
            disabled={disabled}
            onSelect={() => set("idMethod", "chip")}
            title="Mikročip"
            sub="— vyplň číslo"
            input={
              <input
                className="admin-input sm:w-44"
                placeholder="číslo čipu"
                value={form.chip_number}
                disabled={disabled || form.idMethod !== "chip"}
                onChange={(e) => set("chip_number", e.target.value)}
              />
            }
          />
          <IdRow
            active={form.idMethod === "tattoo"}
            disabled={disabled}
            onSelect={() => set("idMethod", "tattoo")}
            title="Tetování"
            sub="— vyplň kód"
            input={
              <input
                className="admin-input sm:w-44"
                placeholder="kód tetování"
                value={form.tattoo}
                disabled={disabled || form.idMethod !== "tattoo"}
                onChange={(e) => set("tattoo", e.target.value)}
              />
            }
          />
          <IdRow
            active={form.idMethod === "ear_tag"}
            disabled={disabled}
            onSelect={() => set("idMethod", "ear_tag")}
            title="Ušní známka"
            input={
              <input
                className="admin-input sm:w-44"
                placeholder="číslo známky"
                value={form.ear_tag}
                disabled={disabled || form.idMethod !== "ear_tag"}
                onChange={(e) => set("ear_tag", e.target.value)}
              />
            }
          />
          <IdRow
            active={form.idMethod === "none"}
            disabled={disabled}
            onSelect={() => set("idMethod", "none")}
            title="Bez identifikace"
            sub="— vědomě potvrzeno"
          />
        </div>
        <p className="mt-2 text-xs text-ink-500">
          Z vyplněného čipu se odvodí „označeno čipem". „Bez identifikace" je
          platná volba — splní tvrdý bod.
        </p>

        {/* Ověření čipu v registru */}
        <div className="mt-4 rounded-lg bg-cream-warm p-4">
          <p className="font-display text-sm font-bold text-ink-900">
            🔎 Ověření čipu v registru
          </p>
          <p className="mb-3 text-xs text-ink-500">
            Zákonná povinnost u nalezenců — pokus najít majitele.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Datum ověření</FieldLabel>
              <input
                type="date"
                className="admin-input"
                value={form.chip_checked_at}
                disabled={disabled}
                onChange={(e) => set("chip_checked_at", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Výsledek</FieldLabel>
              <select
                className="admin-input"
                value={form.chip_check_result ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  set(
                    "chip_check_result",
                    (e.target.value || null) as ChipCheckResult | null,
                  )
                }
              >
                <option value="">—</option>
                {(
                  ["not_checked", "owner_not_found", "owner_found"] as ChipCheckResult[]
                ).map((r) => (
                  <option key={r} value={r}>
                    {CHIP_CHECK_RESULT_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Právní stav */}
      <Card title="⚖️ Právní stav" sub="Komu zvíře patří — řídí, co je s ním povolené dělat">
        <div className="flex flex-wrap gap-2">
          {LEGAL_STATUSES.map((st) => {
            const on = legalStatus === st;
            const warn = st === "in_protection";
            return (
              <button
                key={st}
                type="button"
                disabled={readOnly || legalPending || on}
                onClick={() => changeLegal(st)}
                className={cn(
                  "rounded-pill border-[1.5px] px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-default",
                  on && warn
                    ? "border-sunshine-500 bg-sunshine-500 text-cream"
                    : on
                      ? "border-meadow-500 bg-meadow-500 text-cream"
                      : "border-ink-900/15 bg-cream text-ink-700 hover:border-meadow-500 disabled:opacity-50",
                )}
              >
                {ANIMAL_LEGAL_STATUS_LABEL[st]}
              </button>
            );
          })}
          {legalPending && (
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-500">
              <Loader2 className="size-4 animate-spin" /> Ukládám…
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Začátek lhůty (oznámeno)</FieldLabel>
            <input
              type="date"
              className="admin-input"
              value={form.announced_at}
              disabled={disabled}
              onChange={(e) => set("announced_at", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Délka lhůty (z nastavení útulku)</FieldLabel>
            <input
              className="admin-input opacity-60"
              value={`${protectionMonths} měsíce`}
              disabled
              readOnly
            />
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2.5 rounded-md bg-sunshine-200 p-3 text-sm text-ink-700 ring-1 ring-inset ring-sunshine-400/40">
          <span>⚠️</span>
          <span>
            Při volbě <b>„Přihlásil se majitel"</b> systém automaticky přepne
            zvíře na stav <b>Vráceno</b>, založí výstupní záznam a zapíše do
            historie. Po převodu na „Ve vlastnictví útulku" se vyčistí datum
            lhůty i příznak nalezence.
          </span>
        </div>
      </Card>

      {/* Nalezenec & vet péče */}
      <Card title="📢 Nalezenec & veterinární péče" sub="Co je povolené i během ochranné lhůty">
        <ToggleRow
          title="Zveřejnit v katalogu nalezenců"
          desc="Veřejná prezentace pro hledání majitele (povoleno i v lhůtě). Nejde o adopci."
          on={form.found_listing_published}
          disabled={disabled}
          onToggle={() => set("found_listing_published", !form.found_listing_published)}
        />
        <div className="mt-3">
          <FieldLabel>Potřeba veterinární péče</FieldLabel>
          <select
            className="admin-input"
            value={form.vet_care_need ?? ""}
            disabled={disabled}
            onChange={(e) =>
              set("vet_care_need", (e.target.value || null) as AnimalVetCareNeed | null)
            }
          >
            <option value="">—</option>
            {(
              ["none", "required", "scheduled", "deferred"] as AnimalVetCareNeed[]
            ).map((v) => (
              <option key={v} value={v}>
                {VET_CARE_NEED_LABEL[v]}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Doklad & KVS */}
      <Card title="📄 Doklad o příjmu & KVS" sub="Úřední evidence a hlášení Krajské veterinární správě">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`/api/animals/${animalId}/intake-doc`}
            download
            className="inline-flex items-center gap-2 rounded-pill border-[1.5px] border-meadow-500 px-4 py-2 text-sm font-semibold text-meadow-600 hover:bg-meadow-50"
          >
            <FileText className="size-4" /> Vygenerovat doklad o příjmu (PDF)
          </a>
          <span className="text-xs text-ink-500">
            NotoSans, česká diakritika · evid. č. {form.record_number || "—"}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink-900/5 pt-3">
          <div>
            <p className="text-sm font-bold text-ink-900">Nahlášeno na KVS</p>
            <p className="text-xs text-ink-500">
              Datum hlášení Krajské veterinární správě.
            </p>
          </div>
          <input
            type="date"
            className="admin-input w-44"
            value={form.kvs_reported_at}
            disabled={disabled}
            onChange={(e) => set("kvs_reported_at", e.target.value)}
          />
        </div>
      </Card>

      {error && <p className="text-sm font-semibold text-meadow-700">{error}</p>}

      {/* Save bar */}
      {!readOnly && dirty && (
        <div className="sticky bottom-4 z-30 flex items-center gap-3 rounded-pill border border-ink-900/10 bg-cream/90 px-5 py-3 shadow-lg backdrop-blur">
          <span className="flex-1 text-sm font-semibold text-ink-500">
            Máš neuložené změny příjmu.
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setForm(base)}
            className="rounded-pill border-[1.5px] border-ink-900/15 px-5 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm disabled:opacity-50"
          >
            Zahodit
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={save}
            className="inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-6 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Uložit příjem
          </button>
        </div>
      )}

      {/* Potvrzovací dialog — přihlásil se majitel */}
      {confirmClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-cream p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-ink-900">
              Přihlásil se původní majitel?
            </h3>
            <p className="mt-2 text-sm text-ink-700">
              Tato akce je <b>nevratná</b>: zvíře se přepne na stav{" "}
              <b>Vráceno</b>, založí se výstupní záznam a zapíše do historie.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClaim(false)}
                className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm"
              >
                Zrušit
              </button>
              <button
                type="button"
                disabled={legalPending}
                onClick={() => runLegal("owner_claimed")}
                className="inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-5 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
              >
                {legalPending && <Loader2 className="size-4 animate-spin" />}
                Potvrdit vrácení
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Podkomponenty ---------------------------------------------------------

function Card({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
      <h2 className="font-display text-lg font-bold text-ink-900">{title}</h2>
      <p className="mb-4 text-sm text-ink-500">{sub}</p>
      {children}
    </section>
  );
}

function FieldLabel({
  children,
  optional,
}: {
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-600">
      {children}
      {optional && (
        <span className="ml-1 font-semibold normal-case tracking-normal text-ink-400">
          (volitelné)
        </span>
      )}
    </span>
  );
}

function IdRow({
  active,
  disabled,
  onSelect,
  title,
  sub,
  input,
}: {
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
  title: string;
  sub?: string;
  input?: React.ReactNode;
}) {
  return (
    <div
      onClick={() => !disabled && onSelect()}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-md border-[1.5px] p-3",
        disabled ? "cursor-default" : "cursor-pointer",
        active ? "border-meadow-500 bg-meadow-50" : "border-ink-900/15 bg-cream",
      )}
    >
      <span
        className={cn(
          "size-5 shrink-0 rounded-full border-2",
          active ? "border-meadow-500 bg-meadow-500" : "border-ink-900/20",
        )}
      />
      <span className="flex-1 text-sm font-bold text-ink-900">
        {title}
        {sub && <span className="ml-1 font-semibold text-ink-400">{sub}</span>}
      </span>
      {active && input}
    </div>
  );
}

function ToggleRow({
  title,
  desc,
  on,
  disabled,
  onToggle,
}: {
  title: string;
  desc: string;
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <p className="text-sm font-bold text-ink-900">{title}</p>
        <p className="text-xs text-ink-500">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-pill transition-colors disabled:opacity-50",
          on ? "bg-fern-600" : "bg-ink-900/15",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full bg-cream shadow transition-all",
            on ? "left-6" : "left-1",
          )}
        />
      </button>
    </div>
  );
}

interface SourceForm {
  intake_type: AnimalIntakeType | null;
  handed_over_by: string;
  handed_over_phone: string;
  handed_over_email: string;
  original_owner: string;
  source_institution: string;
  confiscation_authority: string;
  confiscation_ref: string;
}

function SourceBlock<T extends SourceForm>({
  type,
  form,
  set,
  disabled,
}: {
  type: AnimalIntakeType | null;
  form: T;
  set: <K extends keyof T>(k: K, v: T[K]) => void;
  disabled: boolean;
}) {
  if (type !== "found" && type !== "surrender" && type !== "transfer" && type !== "confiscation") {
    return null;
  }
  const heading =
    type === "found"
      ? "🧍 Nálezce"
      : type === "surrender"
        ? "🤝 Původní majitel"
        : type === "transfer"
          ? "🚚 Zdrojová instituce"
          : "⚖️ Orgán / rozhodnutí";

  return (
    <div className="mt-4 rounded-lg bg-cream-warm p-4">
      <p className="mb-3 font-display text-sm font-bold text-ink-900">{heading}</p>
      {type === "found" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Jméno">
            <input
              className="admin-input"
              value={form.handed_over_by}
              disabled={disabled}
              onChange={(e) => set("handed_over_by", e.target.value as T["handed_over_by"])}
            />
          </Labeled>
          <Labeled label="Kontakt (telefon)">
            <input
              className="admin-input"
              value={form.handed_over_phone}
              disabled={disabled}
              onChange={(e) => set("handed_over_phone", e.target.value as T["handed_over_phone"])}
            />
          </Labeled>
        </div>
      )}
      {type === "surrender" && (
        <Labeled label="Jméno původního majitele">
          <input
            className="admin-input"
            value={form.original_owner}
            disabled={disabled}
            onChange={(e) => set("original_owner", e.target.value as T["original_owner"])}
          />
        </Labeled>
      )}
      {type === "transfer" && (
        <Labeled label="Název zdrojové instituce">
          <input
            className="admin-input"
            value={form.source_institution}
            disabled={disabled}
            onChange={(e) => set("source_institution", e.target.value as T["source_institution"])}
          />
        </Labeled>
      )}
      {type === "confiscation" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Orgán (KVS / policie / soud)">
            <input
              className="admin-input"
              value={form.confiscation_authority}
              disabled={disabled}
              onChange={(e) => set("confiscation_authority", e.target.value as T["confiscation_authority"])}
            />
          </Labeled>
          <Labeled label="Číslo rozhodnutí">
            <input
              className="admin-input"
              value={form.confiscation_ref}
              disabled={disabled}
              onChange={(e) => set("confiscation_ref", e.target.value as T["confiscation_ref"])}
            />
          </Labeled>
        </div>
      )}
    </div>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function czDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("cs-CZ");
}

/** Odečte počet měsíců od data (YYYY-MM-DD) → YYYY-MM-DD. */
function subtractMonths(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}
