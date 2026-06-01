"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, Loader2, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { SUPERVISION_STATUS_LABEL } from "@/lib/format";
import { OBSERVATION_TAGS, tagLabel, type TempTrend } from "@/lib/animal-quarantine";
import type { AnimalSupervisionStatus } from "@/types/database";

import {
  addContact,
  addObservation,
  changeSupervisionType,
  deleteContact,
  endSupervision,
  startSupervision,
} from "./quarantine-actions";

// --- View modely -----------------------------------------------------------

export interface QuarantineVM {
  animalId: string;
  readOnly: boolean;
  current: AnimalSupervisionStatus;
  active: {
    id: string;
    kind: AnimalSupervisionStatus;
    reason: string | null;
    started: string;
    plannedUntil: string | null;
    day: number;
    daysLeft: number | null;
    recommendedDays: number | null;
    protocol: { label: string; state: "ok" | "warn" | "todo" }[];
    canEnd: boolean;
    endBlockReason: string | null;
    kennelName: string | null;
  } | null;
  observations: {
    id: string;
    at: string;
    temperature: number | null;
    tags: string[];
    note: string | null;
    flag: "ok" | "watch";
  }[];
  tempTrend: TempTrend | null;
  contacts: { id: string; name: string; record: string | null; species: string | null; reason: string | null }[];
  history: { id: string; kindLabel: string; kind: AnimalSupervisionStatus; reason: string | null; range: string; obsCount: number }[];
  others: { id: string; name: string; record: string | null }[];
}

const KIND_BADGE: Record<AnimalSupervisionStatus, string> = {
  released: "bg-cream-warm text-ink-600",
  quarantine: "bg-sunshine-200 text-ink-800",
  isolation: "bg-meadow-50 text-meadow-700",
  monitored: "bg-sage-100 text-sage-700",
};

const KIND_DOT: Record<AnimalSupervisionStatus, string> = {
  released: "⚪",
  quarantine: "🟠",
  isolation: "🔴",
  monitored: "🟢",
};

const KINDS: AnimalSupervisionStatus[] = ["quarantine", "isolation", "monitored"];

const DEFAULT_DAYS: Record<AnimalSupervisionStatus, number> = {
  released: 0,
  quarantine: 14,
  isolation: 14,
  monitored: 7,
};

export function QuarantineView(vm: QuarantineVM) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [typeMenu, setTypeMenu] = useState(false);

  const blocks = vm.current === "quarantine" || vm.current === "isolation";

  function run(fn: () => Promise<{ error: string } | { ok: true }>, after?: () => void) {
    setErr(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) setErr(res.error);
      else {
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      {err && <p className="text-sm font-semibold text-meadow-700">{err}</p>}

      {/* 1) Blokace banner */}
      {blocks && (
        <div className="flex items-center gap-3 rounded-xl bg-sunshine-200 p-4 ring-1 ring-inset ring-sunshine-400/40">
          <span className="text-xl">🚧</span>
          <div>
            <p className="font-display font-bold text-ink-900">
              {vm.current === "isolation" ? "Izolace" : "Karanténa"} blokuje zveřejnění
            </p>
            <p className="text-sm text-ink-700">
              Dokud běží dohled, zvíře se nezveřejní k adopci. Ukončením epizody se
              spustí auto-publish (pokud nebrání jiný bod).
            </p>
          </div>
        </div>
      )}

      {/* 2) Aktivní epizoda / spuštění */}
      {vm.active ? (
        <section
          className={cn(
            "rounded-xl bg-cream p-6 ring-1",
            vm.active.kind === "isolation"
              ? "ring-meadow-300/50"
              : vm.active.kind === "monitored"
                ? "ring-sage-300/50"
                : "ring-sunshine-400/40",
          )}
        >
          <h2 className="mb-4 font-display text-lg font-bold text-ink-900">🛡️ Aktivní dohled</h2>
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <span className={cn("rounded-pill px-3.5 py-1.5 text-sm font-bold", KIND_BADGE[vm.active.kind])}>
                {KIND_DOT[vm.active.kind]} {SUPERVISION_STATUS_LABEL[vm.active.kind]}
              </span>
              <div className="mt-3">
                <span className="font-display text-3xl font-extrabold text-ink-900">{vm.active.day}.</span>
                <span className="ml-1 text-sm font-semibold text-ink-500">den dohledu</span>
              </div>
            </div>
            <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-sm">
              <dt className="font-semibold text-ink-500">Důvod</dt>
              <dd className="font-bold text-ink-900">{vm.active.reason || "—"}</dd>
              <dt className="font-semibold text-ink-500">Začátek</dt>
              <dd className="font-bold text-ink-900">{vm.active.started}</dd>
              {vm.active.plannedUntil && (
                <>
                  <dt className="font-semibold text-ink-500">Doporučeno do</dt>
                  <dd className="font-bold text-ink-900">
                    {vm.active.plannedUntil}
                    {vm.active.daysLeft != null && (
                      <span className={cn("ml-1 font-semibold", vm.active.daysLeft < 0 ? "text-meadow-700" : "text-sunshine-600")}>
                        · {vm.active.daysLeft < 0 ? `po termínu ${Math.abs(vm.active.daysLeft)} dní` : `zbývá ${vm.active.daysLeft} dní`}
                      </span>
                    )}
                  </dd>
                </>
              )}
              <dt className="font-semibold text-ink-500">Umístění</dt>
              <dd className="font-bold text-ink-900">{vm.active.kennelName ?? "—"}</dd>
            </dl>
          </div>

          {!vm.readOnly && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-900/5 pt-4">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setEndOpen(true)}
                className="rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
              >
                ✓ Ukončit dohled
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTypeMenu((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm"
                >
                  Změnit typ <ChevronDown className="size-4" />
                </button>
                {typeMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setTypeMenu(false)} />
                    <div className="absolute left-0 z-20 mt-2 w-52 rounded-lg bg-cream p-1.5 shadow-lg ring-1 ring-ink-900/10">
                      {KINDS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          disabled={k === vm.active!.kind}
                          onClick={() => {
                            setTypeMenu(false);
                            run(() => changeSupervisionType(vm.animalId, vm.active!.id, k));
                          }}
                          className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-ink-700 hover:bg-cream-warm disabled:opacity-40"
                        >
                          {KIND_DOT[k]} {SUPERVISION_STATUS_LABEL[k]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <a
                href={`/api/animals/${vm.animalId}/quarantine-doc`}
                download
                className="inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm"
              >
                <FileText className="size-4" /> Export PDF
              </a>
            </div>
          )}

          {/* Protokol ukončení */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="w-full text-[11px] font-bold uppercase tracking-wide text-ink-400">
              Protokol ukončení
            </span>
            {vm.active.protocol.map((p, i) => (
              <span
                key={i}
                className={cn(
                  "rounded-pill px-3 py-1 text-xs font-bold",
                  p.state === "ok"
                    ? "bg-fern-50 text-fern-700"
                    : p.state === "warn"
                      ? "bg-sunshine-200 text-ink-700"
                      : "bg-cream-warm text-ink-600",
                )}
              >
                {p.state === "ok" ? "✓ " : p.state === "warn" ? "⚠ " : "○ "}
                {p.label}
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-md bg-fern-50 p-3 text-sm text-fern-700">
            <span>💡</span>
            <span>
              Po ukončení se zvíře vrátí do běžné části a <b>spustí se automatické
              zveřejnění</b> — pokud nebrání ochranná lhůta nebo nevyplněný příjem.
            </span>
          </div>
        </section>
      ) : (
        !vm.readOnly && <StartPanel animalId={vm.animalId} pending={isPending} onStart={run} />
      )}

      {/* 3) Typy dohledu */}
      <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h2 className="font-display text-lg font-bold text-ink-900">🧭 Typy dohledu</h2>
        <p className="mb-4 text-sm text-ink-500">
          Liší se ustájením i tím, zda blokují web
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <TypeCard
            tone="quarantine"
            title="🟠 Karanténa"
            desc="Nově přijatí nebo podezření na nákazu."
            rules={[["no", "Odděleně od ostatních"], ["no", "Blokuje zveřejnění"]]}
          />
          <TypeCard
            tone="isolation"
            title="🔴 Izolace"
            desc="Potvrzená nákaza nebo agresivita."
            rules={[["no", "Striktně odděleně"], ["no", "Blokuje zveřejnění"]]}
          />
          <TypeCard
            tone="monitored"
            title="🟢 Zdravotní dohled"
            desc="Pooperační, sledování stavu, rekonvalescence."
            rules={[["yes", "Může být s ostatními"], ["yes", "Neblokuje zveřejnění"]]}
          />
        </div>
      </section>

      {/* 4) Denní pozorování — jen u běžící epizody */}
      {vm.active && (
        <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
          <h2 className="font-display text-lg font-bold text-ink-900">📝 Denní pozorování</h2>
          <p className="mb-4 text-sm text-ink-500">Chuť, teplota, chování, příznaky</p>

          {vm.tempTrend && (
            <div className="mb-4 flex items-center gap-3 rounded-md bg-cream-warm px-4 py-2.5">
              <span className="text-sm font-bold text-ink-600">🌡️ Trend teploty</span>
              <TempSparkline trend={vm.tempTrend} />
              <span className="ml-auto font-display font-bold text-ink-900">
                {vm.tempTrend.last.toFixed(1)} °C{" "}
                <span className={cn("text-xs font-semibold", vm.tempTrend.elevated ? "text-meadow-700" : "text-fern-600")}>
                  {vm.tempTrend.elevated ? "zvýšená" : "v normě"}
                </span>
              </span>
            </div>
          )}

          {!vm.readOnly && <ObservationForm animalId={vm.animalId} pending={isPending} onAdd={run} />}

          <div className="mt-2">
            {vm.observations.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-500">Zatím žádná pozorování.</p>
            ) : (
              vm.observations.map((o) => (
                <div key={o.id} className="flex gap-3 border-b border-ink-900/5 py-3 last:border-none">
                  <span className="w-20 shrink-0 text-xs font-bold text-ink-500">{czDateTime(o.at)}</span>
                  <div className="min-w-0 flex-1">
                    {o.tags.length > 0 && (
                      <div className="mb-1 flex flex-wrap gap-1.5">
                        {o.tags.map((t) => (
                          <span key={t} className="rounded-pill bg-cream-warm px-2 py-0.5 text-[11px] font-semibold text-ink-700">
                            {tagLabel(t)}
                          </span>
                        ))}
                      </div>
                    )}
                    {o.note && <p className="text-sm text-ink-800">{o.note}</p>}
                    <div className="mt-0.5 flex flex-wrap gap-3 text-xs font-semibold text-ink-500">
                      {o.temperature != null && <span>🌡️ {o.temperature} °C</span>}
                      <span
                        className={cn(
                          "rounded-pill px-2 py-0.5",
                          o.flag === "watch" ? "bg-sunshine-200 text-ink-700" : "bg-fern-50 text-fern-700",
                        )}
                      >
                        {o.flag === "watch" ? "sledovat" : "v pořádku"}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* 5) Sledování expozice */}
      <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h2 className="font-display text-lg font-bold text-ink-900">🦠 Sledování expozice</h2>
        <p className="mb-4 text-sm text-ink-500">
          Zvířata v kontaktu — při ohnisku nákazy víš, koho prověřit
        </p>
        {vm.contacts.length === 0 ? (
          <p className="py-2 text-sm text-ink-500">Žádné evidované kontakty.</p>
        ) : (
          vm.contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 border-b border-ink-900/5 py-3 last:border-none">
              <span className="flex size-9 items-center justify-center rounded-md bg-cream-warm">🐾</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink-900">
                  {c.name}
                  {c.record && <span className="font-semibold text-ink-400"> · {c.record}</span>}
                </p>
                {c.reason && <p className="text-xs text-ink-500">{c.reason}</p>}
              </div>
              {!vm.readOnly && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => deleteContact(vm.animalId, c.id))}
                  className="text-ink-400 hover:text-meadow-700"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))
        )}
        {!vm.readOnly && (
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm"
          >
            <Plus className="size-4" /> Označit kontakt
          </button>
        )}
      </section>

      {/* 6) Historie dohledu */}
      <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h2 className="font-display text-lg font-bold text-ink-900">📜 Historie dohledu</h2>
        <p className="mb-4 text-sm text-ink-500">Uzavřené epizody</p>
        {vm.history.length === 0 ? (
          <p className="py-2 text-sm text-ink-500">Zatím žádné uzavřené epizody.</p>
        ) : (
          vm.history.map((h) => (
            <div key={h.id} className="flex items-center gap-3 border-b border-ink-900/5 py-3 last:border-none">
              <span className="flex size-9 items-center justify-center rounded-md bg-cream-warm">{KIND_DOT[h.kind]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink-900">
                  {h.kindLabel}
                  {h.reason ? ` — ${h.reason}` : ""}
                </p>
                <p className="text-xs text-ink-500">
                  {h.range} · {h.obsCount} pozorování
                </p>
              </div>
              <span className="rounded-pill bg-fern-50 px-2.5 py-0.5 text-[11px] font-bold text-fern-700">
                ukončeno
              </span>
            </div>
          ))
        )}
      </section>

      {/* Modaly */}
      {endOpen && vm.active && (
        <EndModal
          animalId={vm.animalId}
          ep={vm.active}
          pending={isPending}
          onClose={() => setEndOpen(false)}
          onEnd={(vetConsent, notes) =>
            run(
              () =>
                endSupervision(vm.animalId, vm.active!.id, {
                  ended_on: "",
                  exam_results: "",
                  vet_decision: "",
                  notes,
                  vet_consent: vetConsent,
                }),
              () => setEndOpen(false),
            )
          }
        />
      )}
      {contactOpen && (
        <ContactModal
          others={vm.others}
          pending={isPending}
          onClose={() => setContactOpen(false)}
          onAdd={(cid, reason) =>
            run(() => addContact(vm.animalId, cid, reason), () => setContactOpen(false))
          }
        />
      )}
    </div>
  );
}

// --- Podkomponenty ---------------------------------------------------------

function TypeCard({
  tone,
  title,
  desc,
  rules,
}: {
  tone: AnimalSupervisionStatus;
  title: string;
  desc: string;
  rules: ["yes" | "no", string][];
}) {
  return (
    <div className={cn("rounded-lg border-[1.5px] p-4", {
      quarantine: "border-sunshine-400/50 bg-sunshine-200/20",
      isolation: "border-meadow-300/50 bg-meadow-50/40",
      monitored: "border-sage-300/50 bg-sage-50",
      released: "border-ink-900/10",
    }[tone])}>
      <p className="font-display text-sm font-bold text-ink-900">{title}</p>
      <p className="mt-1 text-xs font-medium text-ink-600">{desc}</p>
      <div className="mt-2 space-y-1">
        {rules.map(([yn, label], i) => (
          <p key={i} className={cn("text-[11px] font-bold", yn === "yes" ? "text-fern-700" : "text-meadow-700")}>
            {yn === "yes" ? "✓" : "⛔"} {label}
          </p>
        ))}
      </div>
    </div>
  );
}

function StartPanel({
  animalId,
  pending,
  onStart,
}: {
  animalId: string;
  pending: boolean;
  onStart: (fn: () => Promise<{ error: string } | { ok: true }>) => void;
}) {
  const [kind, setKind] = useState<AnimalSupervisionStatus>("quarantine");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(DEFAULT_DAYS.quarantine);

  function start() {
    const today = new Date().toISOString().slice(0, 10);
    const planned = new Date();
    planned.setDate(planned.getDate() + days);
    onStart(() =>
      startSupervision(animalId, {
        kind,
        started_on: today,
        planned_until: planned.toISOString().slice(0, 10),
        reason,
      }),
    );
  }

  return (
    <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
      <h2 className="font-display text-lg font-bold text-ink-900">🛡️ Spustit dohled</h2>
      <p className="mb-4 text-sm text-ink-500">Zvíře je v běžné části — vyber typ dohledu</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setDays(DEFAULT_DAYS[k]);
            }}
            className={cn(
              "rounded-pill border-[1.5px] px-4 py-2 text-sm font-semibold",
              kind === k ? "border-meadow-500 bg-meadow-50 text-meadow-700" : "border-ink-900/15 bg-cream text-ink-700 hover:border-meadow-500",
            )}
          >
            {KIND_DOT[k]} {SUPERVISION_STATUS_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-600">Důvod</span>
          <input className="admin-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nově přijatá (nález)…" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-600">Doporučená délka (dní)</span>
          <input type="number" min={1} className="admin-input sm:w-40" value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </label>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={start}
        className="mt-4 inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-5 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
      >
        {pending && <Loader2 className="size-4 animate-spin" />} Spustit dohled
      </button>
    </section>
  );
}

function ObservationForm({
  animalId,
  pending,
  onAdd,
}: {
  animalId: string;
  pending: boolean;
  onAdd: (fn: () => Promise<{ error: string } | { ok: true }>, after?: () => void) => void;
}) {
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [temp, setTemp] = useState("");

  const toggle = (k: string) => setTags((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]));

  function submit() {
    onAdd(
      () =>
        addObservation(animalId, {
          note,
          temperature: temp.trim() ? Number(temp.replace(",", ".")) : null,
          tags,
        }),
      () => {
        setTags([]);
        setNote("");
        setTemp("");
      },
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {OBSERVATION_TAGS.map((t) => {
          const on = tags.includes(t.key);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => toggle(t.key)}
              className={cn(
                "rounded-pill border-[1.5px] px-3 py-1.5 text-xs font-bold",
                !on
                  ? "border-ink-900/15 bg-cream text-ink-700"
                  : t.good
                    ? "border-fern-600 bg-fern-50 text-fern-700"
                    : "border-meadow-500 bg-meadow-50 text-meadow-700",
              )}
            >
              {t.label} {on ? (t.good ? "✓" : "⚠") : ""}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="admin-input flex-1" placeholder="Doplňující poznámka (volitelné)…" value={note} onChange={(e) => setNote(e.target.value)} />
        <input className="admin-input w-28" placeholder="°C" value={temp} onChange={(e) => setTemp(e.target.value)} />
        <button
          type="button"
          disabled={pending || (tags.length === 0 && !note.trim() && !temp.trim())}
          onClick={submit}
          className="rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
        >
          Přidat
        </button>
      </div>
    </div>
  );
}

function TempSparkline({ trend }: { trend: TempTrend }) {
  const pts = trend.points;
  if (pts.length < 2) return <span className="text-sm font-bold text-ink-900">{trend.last.toFixed(1)} °C</span>;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const w = 110;
  const h = 22;
  const step = w / (pts.length - 1);
  const path = pts.map((p, i) => `${(i * step).toFixed(1)},${(h - ((p - min) / span) * h).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={path} fill="none" stroke="var(--color-sage-500)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EndModal({
  ep,
  pending,
  onClose,
  onEnd,
}: {
  animalId: string;
  ep: NonNullable<QuarantineVM["active"]>;
  pending: boolean;
  onClose: () => void;
  onEnd: (vetConsent: boolean, notes: string) => void;
}) {
  const [vetConsent, setVetConsent] = useState(ep.kind === "isolation" ? false : false);
  const [notes, setNotes] = useState("");
  const requireConsent = ep.kind === "isolation";
  const blocked = requireConsent && !vetConsent;

  return (
    <Modal title="Ukončit dohled" onClose={onClose}>
      <p className="text-sm text-ink-700">
        Zvíře se vrátí do běžné části a <b>spustí se automatické zveřejnění</b>
        {" "}(pokud nebrání ochranná lhůta / příjem). Akce je spouštěč zveřejnění.
      </p>
      <div className="mt-3 space-y-1.5">
        {ep.protocol.map((p, i) => (
          <p key={i} className="text-sm">
            <span className={cn("font-bold", p.state === "ok" ? "text-fern-700" : p.state === "warn" ? "text-sunshine-600" : "text-ink-500")}>
              {p.state === "ok" ? "✓ " : p.state === "warn" ? "⚠ " : "○ "}
            </span>
            {p.label}
          </p>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink-800">
        <input type="checkbox" checked={vetConsent} onChange={(e) => setVetConsent(e.target.checked)} className="accent-meadow-500" />
        Veterinární souhlas s ukončením{requireConsent && <span className="text-meadow-700"> (povinný)</span>}
      </label>
      <textarea
        className="admin-input mt-3 min-h-16 resize-y"
        placeholder="Poznámka k ukončení (volitelné)…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {blocked && <p className="mt-2 text-xs font-semibold text-meadow-700">U izolace je k ukončení nutný veterinární souhlas.</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm">
          Zrušit
        </button>
        <button
          type="button"
          disabled={pending || blocked}
          onClick={() => onEnd(vetConsent, notes)}
          className="inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-5 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" />} Ukončit a uvolnit
        </button>
      </div>
    </Modal>
  );
}

function ContactModal({
  others,
  pending,
  onClose,
  onAdd,
}: {
  others: { id: string; name: string; record: string | null }[];
  pending: boolean;
  onClose: () => void;
  onAdd: (contactId: string, reason: string) => void;
}) {
  const [cid, setCid] = useState("");
  const [reason, setReason] = useState("");
  return (
    <Modal title="Označit kontakt" onClose={onClose}>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-600">Zvíře v kontaktu</span>
        <select className="admin-input" value={cid} onChange={(e) => setCid(e.target.value)}>
          <option value="">— vyber zvíře —</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.record ? ` · ${o.record}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-600">Důvod kontaktu</span>
        <input className="admin-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Společný příjem · sousední kotec…" />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm">
          Zrušit
        </button>
        <button
          type="button"
          disabled={pending || !cid}
          onClick={() => onAdd(cid, reason)}
          className="inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-5 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" />} Přidat
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-cream p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function czDateTime(iso: string): string {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
