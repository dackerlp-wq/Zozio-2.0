"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ANIMAL_COST_CATEGORIES,
  ANIMAL_COST_CATEGORY_LABEL,
  HEALTH_STATUS_LABEL,
} from "@/lib/format";
import type { DoseSlot, VaxStatus } from "@/lib/animal-health";
import type {
  AnimalCostCategory,
  HealthStatus,
  TreatmentType,
} from "@/types/database";

import {
  addCondition,
  addHealthCost,
  addTreatment,
  addVaccination,
  addVetRecord,
  addWeightLog,
  deleteCondition,
  deleteHealthEntry,
  recordDose,
  setHealthStatus,
} from "../health-actions";

// --- View modely (plní server) --------------------------------------------

export interface ActiveMed {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  endDate: string | null;
  daysLeft: number | null;
  permanent: boolean;
  slots: DoseSlot[];
  missedToday: number;
}

export interface UpcomingItem {
  icon: string;
  label: string;
  date: string;
  daysDiff: number;
  overdue: boolean;
}

export interface VaxItem {
  vaccine: string;
  validUntil: string | null;
  administeredAt: string;
  status: VaxStatus;
}

export interface CondItem {
  id: string;
  label: string;
  is_public: boolean;
}

export type RecKind =
  | "vaccination"
  | "treatment"
  | "deworming"
  | "antiparasitic"
  | "vet"
  | "weight";

export interface UnifiedRecord {
  id: string;
  table: "vaccinations" | "treatments" | "vet_records" | "weight_logs";
  kind: RecKind;
  title: string;
  date: string;
  meta: string;
  status: { label: string; tone: "valid" | "exp" | "expired" | "done" } | null;
  detail: { k: string; v: string }[];
  photos: string[];
  cost: { amount: number; category: string } | null;
  month: string;
}

export interface HealthVM {
  animalId: string;
  readOnly: boolean;
  storedStatus: HealthStatus;
  displayStatus: HealthStatus;
  statusDerived: boolean;
  isNeutered: boolean | null;
  weight: { last: number; deltaKg: number | null; points: number[] } | null;
  hasPermanentMed: boolean;
  activeMeds: ActiveMed[];
  upcoming: UpcomingItem[];
  vaccines: VaxItem[];
  conditions: CondItem[];
  records: UnifiedRecord[];
  counts: Record<string, number>;
}

const SLOT_TONE: Record<DoseSlot["status"], string> = {
  done: "bg-fern-50 text-fern-700",
  missed: "bg-meadow-50 text-meadow-700",
  now: "bg-sunshine-200 text-ink-800 ring-2 ring-sunshine-400",
  upcoming: "bg-cream-warm text-ink-500",
};

const REC_ICON: Record<RecKind, string> = {
  vaccination: "💉",
  treatment: "💊",
  deworming: "🪱",
  antiparasitic: "🛡️",
  vet: "🩺",
  weight: "⚖️",
};

const STATUS_TONE: Record<string, string> = {
  valid: "bg-fern-50 text-fern-700",
  exp: "bg-sunshine-200 text-ink-700",
  expired: "bg-meadow-50 text-meadow-700",
  done: "bg-cream-warm text-ink-600",
};

const FILTERS: { key: string; label: string; icon?: string }[] = [
  { key: "all", label: "Vše" },
  { key: "vaccination", label: "Očkování", icon: "💉" },
  { key: "treatment", label: "Léčby", icon: "💊" },
  { key: "deworming", label: "Odčervení", icon: "🪱" },
  { key: "vet", label: "Vet. záznamy", icon: "🩺" },
  { key: "weight", label: "Váha", icon: "⚖️" },
];

const PAGE = 8;

export function HealthView(vm: HealthVM) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // filtry / stránkování
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  // modaly
  const [addKind, setAddKind] = useState<RecKind | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [costFor, setCostFor] = useState<
    { table: "treatments" | "vet_records" | "vaccinations"; id: string } | null | "free"
  >(null);

  function run(fn: () => Promise<{ error: string } | { ok: true }>) {
    setErr(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) setErr(res.error);
      else router.refresh();
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vm.records.filter((r) => {
      if (filter !== "all") {
        if (filter === "treatment" && !(r.kind === "treatment" || r.kind === "antiparasitic"))
          return false;
        if (filter !== "treatment" && r.kind !== filter) return false;
      }
      if (q && !`${r.title} ${r.meta}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [vm.records, filter, query]);

  const shown = filtered.slice(0, limit);
  const grouped = useMemo(() => {
    const m = new Map<string, UnifiedRecord[]>();
    for (const r of shown) (m.get(r.month) ?? m.set(r.month, []).get(r.month)!).push(r);
    return [...m.entries()];
  }, [shown]);

  return (
    <div className="space-y-5">
      {err && <p className="text-sm font-semibold text-meadow-700">{err}</p>}

      {/* 1) Aktivní medikace */}
      {vm.activeMeds.length > 0 && (
        <section className="rounded-xl border-[1.5px] border-meadow-300/50 bg-meadow-50/40 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-ink-900">
              💊 Aktivní medikace
            </h2>
            {vm.activeMeds.some((m) => m.missedToday > 0) && (
              <span className="rounded-pill bg-meadow-50 px-3 py-1 text-xs font-bold text-meadow-700">
                ⚠️ {vm.activeMeds.reduce((n, m) => n + m.missedToday, 0)} vynechaná
                dávka dnes
              </span>
            )}
          </div>
          <div className="space-y-3">
            {vm.activeMeds.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-3 border-b border-ink-900/5 pb-3 last:border-none last:pb-0"
              >
                <div className="min-w-[180px] flex-1">
                  <p className="font-display font-bold text-ink-900">{m.name}</p>
                  <p className="text-sm text-ink-600">
                    {[m.dosage, m.frequency].filter(Boolean).join(" · ")}
                    {m.permanent ? (
                      <span className="ml-1 text-ink-400">· trvalá medikace</span>
                    ) : m.daysLeft != null ? (
                      <span
                        className={cn(
                          "ml-1 font-semibold",
                          m.daysLeft <= 1 ? "text-sunshine-600" : "text-ink-400",
                        )}
                      >
                        · {m.daysLeft <= 0 ? "končí dnes" : m.daysLeft === 1 ? "končí zítra" : `zbývá ${m.daysLeft} dní`}
                      </span>
                    ) : null}
                  </p>
                </div>
                {m.slots.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.slots.map((s) => (
                      <span
                        key={s.slot}
                        className={cn(
                          "rounded-pill px-2.5 py-1 text-xs font-bold",
                          SLOT_TONE[s.status],
                        )}
                      >
                        {s.slot}{" "}
                        {s.status === "done" ? "✓" : s.status === "missed" ? "⚠️" : "○"}
                      </span>
                    ))}
                  </div>
                )}
                {!vm.readOnly && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      const next = m.slots.find((s) => s.status === "now" || s.status === "missed");
                      run(() => recordDose(vm.animalId, m.id, next?.slot));
                    }}
                    className="rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
                  >
                    Podat teď
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-dashed border-ink-900/10 pt-3 text-xs text-ink-500">
            🔔 Každé podání se loguje (kdo + kdy). Výstrahy: vynechaná dávka,
            blížící se konec kúry, trvalá medikace bez termínu.
          </p>
        </section>
      )}

      {/* 2) Zdravotní souhrn */}
      <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink-900">
            🩺 Zdravotní souhrn
          </h2>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/animals/${vm.animalId}/health-doc?variant=owner`}
              download
              className="inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-meadow-500 px-3.5 py-1.5 text-sm font-semibold text-meadow-600 hover:bg-meadow-50"
            >
              <FileText className="size-4" /> Pro majitele
            </a>
            <a
              href={`/api/animals/${vm.animalId}/health-doc?variant=full`}
              download
              className="inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-ink-900/15 px-3.5 py-1.5 text-sm font-semibold text-ink-700 hover:bg-cream-warm"
            >
              <FileText className="size-4" /> Kompletní (kontrola)
            </a>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink-500">Zdravotní stav:</span>
              <span
                className={cn(
                  "rounded-pill px-3 py-1 text-sm font-bold",
                  vm.displayStatus === "treated"
                    ? "bg-sage-100 text-sage-700"
                    : vm.displayStatus === "special_needs"
                      ? "bg-sunshine-200 text-ink-700"
                      : vm.displayStatus === "healthy"
                        ? "bg-fern-50 text-fern-700"
                        : "bg-cream-warm text-ink-600",
                )}
              >
                {vm.displayStatus === "treated" ? "🏥 " : ""}
                {HEALTH_STATUS_LABEL[vm.displayStatus]}
              </span>
              {vm.statusDerived && (
                <span className="rounded-pill bg-sage-50 px-2 py-0.5 text-[10px] font-bold text-sage-700">
                  auto z medikace
                </span>
              )}
              {!vm.readOnly && (
                <HealthStatusMenu
                  current={vm.storedStatus}
                  disabled={isPending}
                  onPick={(s) => run(() => setHealthStatus(vm.animalId, s))}
                />
              )}
            </div>
            {vm.statusDerived && (
              <p className="-mt-1 text-xs text-ink-500">
                Odvozeno z aktivní medikace; po dokončení kúry se vrátí na uložený
                stav. V připravenosti přidává měkké varování „neukončená léčba".
              </p>
            )}
            <Fact k="Kastrace / sterilizace" v={vm.isNeutered == null ? "Neuvedeno" : vm.isNeutered ? "✓ Ano" : "Ne"} />
            <Fact
              k="Poslední váha"
              v={
                vm.weight ? (
                  <span className="inline-flex items-center gap-2">
                    {vm.weight.points.length > 1 && <Sparkline points={vm.weight.points} />}
                    {vm.weight.last} kg
                    {vm.weight.deltaKg != null && vm.weight.deltaKg !== 0 && (
                      <span
                        className={cn(
                          "font-bold",
                          vm.weight.deltaKg > 0 ? "text-fern-600" : "text-meadow-700",
                        )}
                      >
                        {vm.weight.deltaKg > 0 ? "▲ +" : "▼ "}
                        {vm.weight.deltaKg.toFixed(1)} kg
                      </span>
                    )}
                  </span>
                ) : (
                  "Neuvedeno"
                )
              }
            />
            <Fact k="Trvalá medikace" v={vm.hasPermanentMed ? "Ano" : "Ne"} />
          </div>

          <div className="rounded-lg bg-cream-warm p-4">
            <h4 className="mb-3 font-display text-sm font-bold text-ink-900">
              🔔 Nadcházející péče
            </h4>
            {vm.upcoming.length === 0 ? (
              <p className="text-sm text-ink-500">Nic naplánováno.</p>
            ) : (
              <div className="space-y-2.5">
                {vm.upcoming.map((u, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-md bg-cream text-sm ring-1 ring-ink-900/8">
                      {u.icon}
                    </span>
                    <span className="flex-1 text-sm font-semibold text-ink-900">
                      {u.label}
                      <span className="block text-xs font-medium text-ink-500">
                        plánováno {czDate(u.date)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "rounded-pill px-2.5 py-0.5 text-[11px] font-bold",
                        u.overdue
                          ? "bg-meadow-50 text-meadow-700"
                          : "bg-sunshine-200 text-ink-700",
                      )}
                    >
                      {u.overdue
                        ? `po termínu · ${Math.abs(u.daysDiff)} dní`
                        : `za ${u.daysDiff} dní`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3 + 4) Platnost očkování + Chronické stavy */}
      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
          <h2 className="mb-3 font-display text-base font-bold text-ink-900">
            💉 Platnost očkování
          </h2>
          {vm.vaccines.length === 0 ? (
            <p className="text-sm text-ink-500">Zatím žádné očkování.</p>
          ) : (
            <div className="space-y-0.5">
              {vm.vaccines.map((v, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-ink-900/5 py-2.5 last:border-none"
                >
                  <span className="flex-1 text-sm font-bold text-ink-900">
                    {v.vaccine}
                    <span className="block text-xs font-medium text-ink-500">
                      {v.validUntil ? `do ${czDate(v.validUntil)}` : `aplikováno ${czDate(v.administeredAt)}`}
                    </span>
                  </span>
                  <VaxBadge status={v.status} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
          <h2 className="mb-3 font-display text-base font-bold text-ink-900">
            🧬 Chronické stavy & speciální potřeby
          </h2>
          <ConditionList
            animalId={vm.animalId}
            conditions={vm.conditions}
            readOnly={vm.readOnly}
            pending={isPending}
            onAdd={(label, pub) => run(() => addCondition(vm.animalId, label, pub))}
            onDelete={(id) => run(() => deleteCondition(id, vm.animalId))}
          />
          <p className="mt-3 text-xs text-ink-500">
            Označené „na webu" se zobrazí na veřejném profilu jako speciální
            potřeby — pomáhá najít připravený domov.
          </p>
        </section>
      </div>

      {/* 5) Záznamy */}
      <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink-900">
            📋 Zdravotní záznamy
          </h2>
          {!vm.readOnly && (
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAddMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600"
                >
                  <Plus className="size-4" /> Přidat záznam <ChevronDown className="size-4" />
                </button>
                {addMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} />
                    <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg bg-cream p-1.5 shadow-lg ring-1 ring-ink-900/10">
                      {([
                        ["vaccination", "💉 Očkování"],
                        ["treatment", "💊 Léčba"],
                        ["deworming", "🪱 Odčervení"],
                        ["antiparasitic", "🛡️ Antiparazitika"],
                        ["vet", "🩺 Vet. záznam"],
                        ["weight", "⚖️ Váha"],
                      ] as [RecKind, string][]).map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            setAddKind(k);
                            setAddMenuOpen(false);
                          }}
                          className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-ink-700 hover:bg-cream-warm"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Hledat v záznamech (lék, vet, dávka…)"
            className="admin-input pl-9"
          />
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFilter(f.key);
                setLimit(PAGE);
              }}
              className={cn(
                "rounded-pill px-3 py-1.5 text-xs font-bold",
                filter === f.key
                  ? "bg-ink-900 text-cream"
                  : "bg-cream-warm text-ink-700 hover:bg-sand",
              )}
            >
              {f.icon ? `${f.icon} ` : ""}
              {f.label}{" "}
              <span className="opacity-60">{vm.counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>

        {grouped.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-500">
            Žádné záznamy neodpovídají filtru.
          </p>
        ) : (
          grouped.map(([month, recs]) => (
            <div key={month}>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                {month}
              </p>
              {recs.map((r) => (
                <RecordRow
                  key={r.table + r.id}
                  rec={r}
                  readOnly={vm.readOnly}
                  pending={isPending}
                  onAddCost={() => {
                    if (r.table !== "weight_logs") setCostFor({ table: r.table, id: r.id });
                  }}
                  onDelete={() => run(() => deleteHealthEntry(r.table, r.id, vm.animalId))}
                />
              ))}
            </div>
          ))
        )}

        {filtered.length > limit && (
          <div className="mt-4 flex items-center justify-center gap-3 text-sm font-semibold text-ink-500">
            <span>
              Zobrazeno {shown.length} z {filtered.length} záznamů
            </span>
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-1.5 text-ink-700 hover:bg-cream-warm"
            >
              Načíst další
            </button>
          </div>
        )}
      </section>

      {/* Modaly */}
      {addKind && (
        <AddRecordModal
          animalId={vm.animalId}
          kind={addKind}
          onClose={() => setAddKind(null)}
          onSaved={() => {
            setAddKind(null);
            router.refresh();
          }}
        />
      )}
      {costFor && (
        <CostModal
          animalId={vm.animalId}
          link={costFor === "free" ? undefined : costFor}
          onClose={() => setCostFor(null)}
          onSaved={() => {
            setCostFor(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// --- Drobné komponenty -----------------------------------------------------

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-900/5 pb-2.5 text-sm last:border-none">
      <span className="font-semibold text-ink-500">{k}</span>
      <span className="font-bold text-ink-900">{v}</span>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const w = 58;
  const h = 18;
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const path = points
    .map((p, i) => `${(i * step).toFixed(1)},${(h - ((p - min) / span) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={path}
        fill="none"
        stroke="var(--color-sage-500)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VaxBadge({ status }: { status: VaxStatus }) {
  const map: Record<VaxStatus, { label: string; cls: string }> = {
    valid: { label: "platné", cls: "bg-fern-50 text-fern-700" },
    expiring: { label: "expiruje brzy", cls: "bg-sunshine-200 text-ink-700" },
    expired: { label: "propadlé", cls: "bg-meadow-50 text-meadow-700" },
    unknown: { label: "bez data", cls: "bg-cream-warm text-ink-500" },
  };
  const s = map[status];
  return (
    <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-bold", s.cls)}>
      {s.label}
    </span>
  );
}

function HealthStatusMenu({
  current,
  disabled,
  onPick,
}: {
  current: HealthStatus;
  disabled: boolean;
  onPick: (s: HealthStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const opts: HealthStatus[] = ["healthy", "treated", "special_needs", "unknown"];
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-bold text-meadow-600 hover:text-meadow-700 disabled:opacity-50"
      >
        změnit ručně
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 w-48 rounded-lg bg-cream p-1.5 shadow-lg ring-1 ring-ink-900/10">
            {opts.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPick(s);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-cream-warm",
                  s === current ? "text-ink-900" : "text-ink-600",
                )}
              >
                {HEALTH_STATUS_LABEL[s]}
                {s === current && <Check className="size-4 text-meadow-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ConditionList({
  conditions,
  readOnly,
  pending,
  onAdd,
  onDelete,
}: {
  animalId: string;
  conditions: CondItem[];
  readOnly: boolean;
  pending: boolean;
  onAdd: (label: string, isPublic: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [pub, setPub] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      {conditions.map((c) => (
        <span
          key={c.id}
          className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-50 px-3 py-1.5 text-sm font-semibold text-meadow-700"
        >
          {c.label}
          {c.is_public && (
            <span className="rounded-pill bg-cream px-1.5 py-0.5 text-[10px] font-bold text-meadow-600">
              na webu
            </span>
          )}
          {!readOnly && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onDelete(c.id)}
              className="text-meadow-600 hover:text-meadow-700"
            >
              <X className="size-3.5" />
            </button>
          )}
        </span>
      ))}
      {!readOnly &&
        (adding ? (
          <div className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-cream-warm p-2">
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Stav / potřeba…"
              className="admin-input flex-1"
            />
            <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-600">
              <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} className="accent-meadow-500" />
              na webu
            </label>
            <button
              type="button"
              disabled={pending || !label.trim()}
              onClick={() => {
                onAdd(label, pub);
                setLabel("");
                setPub(false);
                setAdding(false);
              }}
              className="rounded-pill bg-meadow-500 px-3 py-1.5 text-sm font-semibold text-cream disabled:opacity-50"
            >
              Přidat
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-pill px-2 py-1.5 text-sm font-semibold text-ink-500"
            >
              Zrušit
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-pill border-[1.5px] border-dashed border-ink-900/20 px-3 py-1.5 text-sm font-semibold text-ink-500 hover:border-meadow-500 hover:text-meadow-600"
          >
            <Plus className="size-3.5" /> přidat
          </button>
        ))}
    </div>
  );
}

function RecordRow({
  rec,
  readOnly,
  pending,
  onAddCost,
  onDelete,
}: {
  rec: UnifiedRecord;
  readOnly: boolean;
  pending: boolean;
  onAddCost: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-ink-900/5 last:border-none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 py-3 text-left hover:bg-cream-warm/40"
      >
        <span className="flex size-9 items-center justify-center rounded-md bg-cream-warm text-base">
          {REC_ICON[rec.kind]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink-900">{rec.title}</span>
          <span className="block text-xs font-medium text-ink-500">
            {czDate(rec.date)} · {rec.meta}
          </span>
        </span>
        {rec.cost && (
          <span className="rounded-pill bg-sunshine-200 px-2 py-0.5 text-[11px] font-bold text-ink-700">
            💰 {rec.cost.amount.toLocaleString("cs-CZ")} Kč
          </span>
        )}
        {rec.status && (
          <span className={cn("rounded-pill px-2.5 py-0.5 text-[11px] font-bold", STATUS_TONE[rec.status.tone])}>
            {rec.status.label}
          </span>
        )}
        <ChevronDown className={cn("size-4 shrink-0 text-ink-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-1.5 rounded-lg bg-cream-warm px-4 pb-4 pl-16 pt-1 text-sm">
          {rec.detail.map((d, i) => (
            <div key={i} className="flex gap-2">
              <span className="min-w-28 font-bold text-ink-500">{d.k}</span>
              <span className="text-ink-800">{d.v}</span>
            </div>
          ))}
          {rec.photos.length > 0 && (
            <div className="flex gap-2 pt-1">
              {rec.photos.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={p} alt="" className="size-14 rounded-md object-cover ring-1 ring-ink-900/8" />
              ))}
            </div>
          )}
          {!readOnly && (
            <div className="flex flex-wrap gap-3 pt-2">
              {!rec.cost && rec.table !== "weight_logs" && (
                <button
                  type="button"
                  onClick={onAddCost}
                  className="inline-flex items-center gap-1 text-xs font-bold text-meadow-600 hover:text-meadow-700"
                >
                  <Plus className="size-3.5" /> Přidat náklad
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={onDelete}
                className="inline-flex items-center gap-1 text-xs font-bold text-meadow-700 hover:text-meadow-900 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" /> Smazat
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Modal: přidat záznam --------------------------------------------------

const KIND_TITLE: Record<RecKind, string> = {
  vaccination: "💉 Nové očkování",
  treatment: "💊 Nová léčba",
  deworming: "🪱 Odčervení",
  antiparasitic: "🛡️ Antiparazitika",
  vet: "🩺 Veterinární záznam",
  weight: "⚖️ Vážení",
};

function AddRecordModal({
  animalId,
  kind,
  onClose,
  onSaved,
}: {
  animalId: string;
  kind: RecKind;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  // sdílená pole
  const [f, setF] = useState<Record<string, string>>({
    date: today,
    name: "",
    dosage: "",
    frequency: "",
    end_date: "",
    valid_until: "",
    vet: "",
    notes: "",
    batch: "",
    weight: "",
    times: "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList) {
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok) urls.push(data.url);
      }
      setPhotos((p) => [...p, ...urls]);
    } finally {
      setUploading(false);
    }
  }

  function save() {
    setErr(null);
    startTransition(async () => {
      let res: { error: string } | { ok: true };
      if (kind === "weight") {
        res = await addWeightLog(animalId, {
          weight_kg: Number(f.weight),
          measured_at: f.date,
          note: f.notes,
        });
      } else if (kind === "vaccination") {
        res = await addVaccination(animalId, {
          vaccine: f.name,
          administered_at: f.date,
          valid_until: f.valid_until,
          vet_name: f.vet,
          notes: f.notes,
          batch: f.batch,
        });
      } else if (kind === "vet") {
        res = await addVetRecord(animalId, {
          recorded_at: f.date,
          category: "Obecné",
          title: f.name,
          vet_name: f.vet,
          notes: f.notes,
          photos,
        });
      } else {
        const type: TreatmentType =
          kind === "deworming"
            ? "deworming"
            : kind === "antiparasitic"
              ? "antiparasitic"
              : "medication";
        res = await addTreatment(animalId, {
          type,
          name: f.name,
          dosage: f.dosage,
          frequency: f.frequency,
          start_date: f.date,
          end_date: f.end_date,
          next_due: "",
          vet_name: f.vet,
          notes: f.notes,
          schedule_times: f.times
            ? f.times.split(",").map((x) => x.trim()).filter(Boolean)
            : undefined,
        });
      }
      if ("error" in res) setErr(res.error);
      else onSaved();
    });
  }

  const isTreatment = kind === "treatment" || kind === "deworming" || kind === "antiparasitic";

  return (
    <Modal title={KIND_TITLE[kind]} onClose={onClose}>
      <div className="space-y-3">
        {kind === "weight" ? (
          <L label="Váha (kg)">
            <input type="number" step="0.1" className="admin-input" value={f.weight} onChange={(e) => set("weight", e.target.value)} />
          </L>
        ) : (
          <L label={kind === "vet" ? "Název záznamu" : "Název"}>
            <input className="admin-input" value={f.name} onChange={(e) => set("name", e.target.value)} />
          </L>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <L label={isTreatment ? "Začátek" : "Datum"}>
            <input type="date" className="admin-input" value={f.date} onChange={(e) => set("date", e.target.value)} />
          </L>
          {kind === "vaccination" && (
            <L label="Platnost do">
              <input type="date" className="admin-input" value={f.valid_until} onChange={(e) => set("valid_until", e.target.value)} />
            </L>
          )}
          {isTreatment && (
            <L label="Konec kúry">
              <input type="date" className="admin-input" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} />
            </L>
          )}
        </div>
        {kind === "vaccination" && (
          <L label="Šarže">
            <input className="admin-input" value={f.batch} onChange={(e) => set("batch", e.target.value)} />
          </L>
        )}
        {isTreatment && (
          <div className="grid gap-3 sm:grid-cols-2">
            <L label="Dávka">
              <input className="admin-input" value={f.dosage} onChange={(e) => set("dosage", e.target.value)} />
            </L>
            <L label="Frekvence">
              <input className="admin-input" placeholder="3× denně" value={f.frequency} onChange={(e) => set("frequency", e.target.value)} />
            </L>
            <L label="Časy dávek (pro kontrolu)" full>
              <input className="admin-input" placeholder="08:00, 13:00, 20:00" value={f.times} onChange={(e) => set("times", e.target.value)} />
            </L>
          </div>
        )}
        {kind !== "weight" && (
          <L label="Veterinář">
            <input className="admin-input" value={f.vet} onChange={(e) => set("vet", e.target.value)} />
          </L>
        )}
        <L label="Poznámka">
          <textarea className="admin-input min-h-16 resize-y" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </L>
        {kind === "vet" && (
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-600">Fotodokumentace</p>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={p} alt="" className="size-14 rounded-md object-cover ring-1 ring-ink-900/8" />
              ))}
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex size-14 items-center justify-center rounded-md border-[1.5px] border-dashed border-ink-900/20 text-ink-400 hover:border-meadow-500">
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
              </button>
            </div>
          </div>
        )}
        {err && <p className="text-sm font-semibold text-meadow-700">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm">
            Zrušit
          </button>
          <button type="button" disabled={isPending} onClick={save} className="inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-5 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50">
            {isPending && <Loader2 className="size-4 animate-spin" />} Uložit
          </button>
        </div>
      </div>
    </Modal>
  );
}

// --- Modal: náklad ---------------------------------------------------------

function CostModal({
  animalId,
  link,
  onClose,
  onSaved,
}: {
  animalId: string;
  link?: { table: "treatments" | "vet_records" | "vaccinations"; id: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [category, setCategory] = useState<AnimalCostCategory>("vet");
  const [amount, setAmount] = useState("");
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");

  function save() {
    setErr(null);
    startTransition(async () => {
      const res = await addHealthCost(
        animalId,
        { category, amount: Number(amount), spent_on: spentOn, description },
        link,
      );
      if ("error" in res) setErr(res.error);
      else onSaved();
    });
  }

  return (
    <Modal title="💰 Přidat náklad" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <L label="Kategorie">
            <select className="admin-input" value={category} onChange={(e) => setCategory(e.target.value as AnimalCostCategory)}>
              {ANIMAL_COST_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {ANIMAL_COST_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </L>
          <L label="Částka (Kč)">
            <input type="number" min="0" className="admin-input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </L>
        </div>
        <L label="Datum">
          <input type="date" className="admin-input" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
        </L>
        <L label="Popis">
          <input className="admin-input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </L>
        {link && (
          <p className="text-xs text-ink-500">Náklad se napojí na tento zdravotní záznam.</p>
        )}
        {err && <p className="text-sm font-semibold text-meadow-700">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm">
            Zrušit
          </button>
          <button type="button" disabled={isPending} onClick={save} className="inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-5 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50">
            {isPending && <Loader2 className="size-4 animate-spin" />} Uložit náklad
          </button>
        </div>
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
      <div className="w-full max-w-lg rounded-xl bg-cream p-6 shadow-xl">
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

function L({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={cn("block", full && "sm:col-span-2")}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function czDate(iso: string): string {
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("cs-CZ");
}
