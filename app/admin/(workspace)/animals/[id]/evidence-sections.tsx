"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";

import {
  ANIMAL_COST_CATEGORIES,
  ANIMAL_COST_CATEGORY_LABEL,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  AnimalCostCategory,
  AnimalCostRow,
  AnimalCostSource,
  AnimalDonationRow,
  AnimalDonationSource,
} from "@/types/database";

import {
  addCost,
  addDonation,
  deleteCost,
  deleteDonation,
} from "./evidence-actions";

type ActionResult = { error: string } | { ok: true };

const inputCls =
  "w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300";

const today = () => new Date().toISOString().slice(0, 10);

function czDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}
function kc(n: number): string {
  return `${Math.round(n).toLocaleString("cs-CZ")} Kč`;
}

const CAT_ICON: Record<AnimalCostCategory, string> = {
  vet: "🩺",
  food: "🍖",
  medication: "💊",
  castration: "✂️",
  vaccination: "💉",
  transport: "🚗",
  other: "📦",
};

const COST_SOURCE: Record<AnimalCostSource, { label: string; tone: string } | null> = {
  manual: { label: "ruční", tone: "bg-cream-warm text-ink-600" },
  health: { label: "auto ze Zdraví", tone: "bg-fern-50 text-fern-700" },
  foster: { label: "pěstoun", tone: "bg-sage-100 text-sage-700" },
  darujme: { label: "Darujme.cz", tone: "bg-meadow-50 text-meadow-700" },
  adoption: { label: "adopce", tone: "bg-meadow-50 text-meadow-700" },
  intake: { label: "příjem", tone: "bg-cream-warm text-ink-600" },
};

const DONATION_SOURCE: Record<AnimalDonationSource, { label: string; tone: string }> = {
  manual: { label: "ruční", tone: "bg-cream-warm text-ink-600" },
  darujme: { label: "Darujme.cz", tone: "bg-meadow-50 text-meadow-700" },
  sponsoring: { label: "sponzoring", tone: "bg-sage-100 text-sage-700" },
};

export interface AdoptionFeeVM {
  amount: number;
  paid: boolean;
  paidAt: string | null;
}

export function EvidenceSection({
  animalId,
  readOnly,
  costs,
  donations,
  adoptionFee,
}: {
  animalId: string;
  readOnly: boolean;
  costs: AnimalCostRow[];
  donations: AnimalDonationRow[];
  adoptionFee: AdoptionFeeVM | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<ActionResult>, after?: () => void) {
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

  // --- Ekonomika ---
  const expenseTotal = costs.reduce((s, c) => s + c.amount, 0);
  const moneyDonations = donations.filter((d) => d.kind === "money");
  const inKindDonations = donations.filter((d) => d.kind === "in_kind");
  const moneyIncome =
    moneyDonations.reduce((s, d) => s + (d.amount ?? 0), 0) +
    (adoptionFee?.paid ? adoptionFee.amount : 0);
  const inKindTotal = inKindDonations.reduce((s, d) => s + (d.amount ?? 0), 0);
  const balance = moneyIncome - expenseTotal;

  const byCategory = useMemo(() => {
    const m = new Map<AnimalCostCategory, number>();
    for (const c of costs) m.set(c.category, (m.get(c.category) ?? 0) + c.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [costs]);
  const maxCat = byCategory[0]?.[1] ?? 0;

  return (
    <div className="space-y-5">
      {err && <p className="text-sm font-semibold text-meadow-700">{err}</p>}

      {/* Ekonomika */}
      <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h2 className="font-display text-lg font-bold text-ink-900">📊 Ekonomika zvířete</h2>
        <p className="mb-4 text-sm text-ink-500">
          Celý obraz — výdaje, příjmy i věcné dary. Část se propisuje ze Zdraví a Pěstouna.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile n={kc(expenseTotal)} label="Výdaje" tone="bg-meadow-50 text-meadow-700 ring-meadow-300/40" />
          <Tile n={kc(moneyIncome)} label="Peněžní příjmy" tone="bg-fern-50 text-fern-700 ring-fern-100" />
          <Tile
            n={`${balance < 0 ? "−" : ""}${kc(Math.abs(balance))}`}
            label="Bilance (cash)"
            tone="bg-cream text-ink-800 ring-ink-900/10"
          />
          <Tile n={`~${kc(inKindTotal)}`} label="Věcné dary" tone="bg-sage-100 text-sage-700 ring-sage-300/40" />
        </div>

        {byCategory.length > 0 && (
          <div className="mt-4 space-y-2">
            {byCategory.map(([cat, val]) => (
              <div key={cat} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 font-semibold text-ink-700">
                  {CAT_ICON[cat]} {ANIMAL_COST_CATEGORY_LABEL[cat]}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-pill bg-ink-900/8">
                  <span
                    className="block h-full rounded-pill bg-meadow-500"
                    style={{ width: `${maxCat > 0 ? Math.round((val / maxCat) * 100) : 0}%` }}
                  />
                </span>
                <span className="min-w-[70px] text-right font-bold text-ink-900">{kc(val)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Výdaje */}
      <Expenses animalId={animalId} readOnly={readOnly} costs={costs} pending={pending} run={run} />

      {/* Příjmy & dary */}
      <Income
        animalId={animalId}
        readOnly={readOnly}
        money={moneyDonations}
        inKind={inKindDonations}
        adoptionFee={adoptionFee}
        pending={pending}
        run={run}
      />
    </div>
  );
}

function Tile({ n, label, tone }: { n: string; label: string; tone: string }) {
  return (
    <div className={cn("rounded-lg p-4 ring-1 ring-inset", tone)}>
      <div className="font-display text-xl font-bold leading-none">{n}</div>
      <div className="mt-1 text-xs font-bold text-ink-500">{label}</div>
    </div>
  );
}

// --- Výdaje ----------------------------------------------------------------

function Expenses({
  animalId,
  readOnly,
  costs,
  pending,
  run,
}: {
  animalId: string;
  readOnly: boolean;
  costs: AnimalCostRow[];
  pending: boolean;
  run: (fn: () => Promise<ActionResult>, after?: () => void) => void;
}) {
  const [filter, setFilter] = useState<AnimalCostCategory | "all">("all");
  const [adding, setAdding] = useState(false);
  const [cat, setCat] = useState<AnimalCostCategory>("vet");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [desc, setDesc] = useState("");

  const filtered = filter === "all" ? costs : costs.filter((c) => c.category === filter);

  return (
    <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-ink-900">💸 Výdaje</h2>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600"
          >
            {adding ? <X className="size-4" /> : <Plus className="size-4" />}
            {adding ? "Zavřít" : "Přidat výdaj"}
          </button>
        )}
      </div>

      {adding && !readOnly && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-cream-warm p-4">
          <Field label="Kategorie">
            <select className={`${inputCls} w-40`} value={cat} onChange={(e) => setCat(e.target.value as AnimalCostCategory)}>
              {ANIMAL_COST_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CAT_ICON[c]} {ANIMAL_COST_CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </Field>
          <Field label="Částka (Kč)">
            <input type="number" min={0} className={`${inputCls} w-28`} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Datum">
            <input type="date" className={`${inputCls} w-40`} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Popis">
            <input className={`${inputCls} min-w-[160px]`} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <button
            type="button"
            disabled={pending || !amount}
            onClick={() =>
              run(
                () => addCost(animalId, { category: cat, amount: Number(amount), spent_on: date, description: desc, invoice_url: "" }),
                () => {
                  setAmount("");
                  setDesc("");
                  setAdding(false);
                },
              )
            }
            className="rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
          >
            Přidat
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <FilterChip on={filter === "all"} onClick={() => setFilter("all")} label="Vše" />
        {ANIMAL_COST_CATEGORIES.map((c) => (
          <FilterChip key={c} on={filter === c} onClick={() => setFilter(c)} label={`${CAT_ICON[c]} ${ANIMAL_COST_CATEGORY_LABEL[c]}`} />
        ))}
      </div>

      <div className="mt-2">
        {filtered.length === 0 ? (
          <p className="py-3 text-sm text-ink-500">Žádné výdaje.</p>
        ) : (
          filtered.map((c) => {
            const src = COST_SOURCE[c.source];
            const isManual = c.source === "manual";
            return (
              <div key={c.id} className="flex items-center gap-3 border-b border-ink-900/5 py-3 last:border-none">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-cream-warm">{CAT_ICON[c.category]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink-900">{c.description || ANIMAL_COST_CATEGORY_LABEL[c.category]}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-500">
                    <span>{czDate(c.spent_on)}</span>
                    {src && <span className={cn("rounded-pill px-2 py-0.5 text-[11px] font-bold", src.tone)}>{src.label}</span>}
                  </div>
                </div>
                <span className="font-display text-base font-bold text-ink-900">{kc(c.amount)}</span>
                {!readOnly && isManual && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deleteCost(animalId, c.id))}
                    aria-label="Smazat výdaj"
                    className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-meadow-700"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

// --- Příjmy & dary ---------------------------------------------------------

function Income({
  animalId,
  readOnly,
  money,
  inKind,
  adoptionFee,
  pending,
  run,
}: {
  animalId: string;
  readOnly: boolean;
  money: AnimalDonationRow[];
  inKind: AnimalDonationRow[];
  adoptionFee: AdoptionFeeVM | null;
  pending: boolean;
  run: (fn: () => Promise<ActionResult>, after?: () => void) => void;
}) {
  const [adding, setAdding] = useState<"money" | "in_kind" | null>(null);
  const [amount, setAmount] = useState("");
  const [item, setItem] = useState("");
  const [donor, setDonor] = useState("");
  const [src, setSrc] = useState<AnimalDonationSource>("manual");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");

  function reset() {
    setAmount("");
    setItem("");
    setDonor("");
    setSrc("manual");
    setNote("");
    setAdding(null);
  }

  return (
    <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-ink-900">💚 Příjmy &amp; dary</h2>
        {!readOnly && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAdding(adding === "money" ? null : "money")}
              className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-3 py-1.5 text-sm font-semibold text-cream hover:bg-meadow-600"
            >
              <Plus className="size-4" /> Peněžní
            </button>
            <button
              type="button"
              onClick={() => setAdding(adding === "in_kind" ? null : "in_kind")}
              className="inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-sage-500 px-3 py-1.5 text-sm font-semibold text-sage-700 hover:bg-sage-50"
            >
              <Plus className="size-4" /> Věcný dar
            </button>
          </div>
        )}
      </div>

      {adding && !readOnly && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-cream-warm p-4">
          {adding === "in_kind" ? (
            <Field label="Co bylo darováno">
              <input className={`${inputCls} min-w-[160px]`} value={item} onChange={(e) => setItem(e.target.value)} placeholder="Pelíšek, granule…" />
            </Field>
          ) : (
            <Field label="Zdroj">
              <select className={`${inputCls} w-36`} value={src} onChange={(e) => setSrc(e.target.value as AnimalDonationSource)}>
                <option value="manual">Ruční</option>
                <option value="darujme">Darujme.cz</option>
                <option value="sponsoring">Sponzoring</option>
              </select>
            </Field>
          )}
          <Field label={adding === "in_kind" ? "Odhadní hodnota (Kč)" : "Částka (Kč)"}>
            <input type="number" min={0} className={`${inputCls} w-32`} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Dárce">
            <input className={`${inputCls} w-40`} value={donor} onChange={(e) => setDonor(e.target.value)} />
          </Field>
          <Field label="Datum">
            <input type="date" className={`${inputCls} w-40`} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <button
            type="button"
            disabled={pending || (adding === "money" ? !amount : !item.trim())}
            onClick={() =>
              run(
                () =>
                  addDonation(animalId, {
                    kind: adding,
                    amount: amount ? Number(amount) : null,
                    item,
                    donor,
                    source: adding === "in_kind" ? "manual" : src,
                    occurred_on: date,
                    note,
                  }),
                reset,
              )
            }
            className="rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
          >
            Přidat
          </button>
        </div>
      )}

      {/* Peněžní */}
      <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-ink-400">Peněžní</p>
      {money.length === 0 && !adoptionFee ? (
        <p className="py-2 text-sm text-ink-500">Žádné peněžní příjmy.</p>
      ) : (
        <>
          {money.map((d) => (
            <DonationRow
              key={d.id}
              icon="💝"
              title={d.note || "Peněžní dar"}
              date={czDate(d.occurred_on)}
              srcLabel={DONATION_SOURCE[d.source].label}
              srcTone={DONATION_SOURCE[d.source].tone}
              donor={d.donor}
              amount={`+${kc(d.amount ?? 0)}`}
              amountTone="text-fern-700"
              onDelete={!readOnly ? () => run(() => deleteDonation(animalId, d.id)) : undefined}
              pending={pending}
            />
          ))}
          {adoptionFee && (
            <DonationRow
              icon="🤝"
              title="Adopční poplatek"
              date={adoptionFee.paid ? `zaplaceno ${czDate(adoptionFee.paidAt)}` : "očekáván po uzavření adopce"}
              srcLabel={adoptionFee.paid ? "adopce" : "plánováno"}
              srcTone={adoptionFee.paid ? "bg-fern-50 text-fern-700" : "bg-cream-warm text-ink-600"}
              donor={null}
              amount={`${adoptionFee.paid ? "+" : ""}${kc(adoptionFee.amount)}`}
              amountTone={adoptionFee.paid ? "text-fern-700" : "text-ink-400"}
              pending={pending}
            />
          )}
        </>
      )}

      {/* Věcné */}
      <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-ink-400">Věcné (nefinanční) dary</p>
      {inKind.length === 0 ? (
        <p className="py-2 text-sm text-ink-500">Žádné věcné dary.</p>
      ) : (
        inKind.map((d) => (
          <DonationRow
            key={d.id}
            icon="🎁"
            title={d.item || "Věcný dar"}
            date={czDate(d.occurred_on)}
            srcLabel={d.donor ? `dárce: ${d.donor}` : "dárce neuveden"}
            srcTone="bg-cream-warm text-ink-600"
            donor={null}
            amount={d.amount ? `~${kc(d.amount)}` : "—"}
            amountTone="text-sage-700"
            onDelete={!readOnly ? () => run(() => deleteDonation(animalId, d.id)) : undefined}
            pending={pending}
          />
        ))
      )}
      <p className="mt-3 text-xs text-ink-400">
        Věcné dary se počítají zvlášť (nejsou cash), ale dokládají reálnou hodnotu péče — užitečné pro granty a transparentnost.
      </p>
    </section>
  );
}

function DonationRow({
  icon,
  title,
  date,
  srcLabel,
  srcTone,
  donor,
  amount,
  amountTone,
  onDelete,
  pending,
}: {
  icon: string;
  title: string;
  date: string;
  srcLabel: string;
  srcTone: string;
  donor: string | null;
  amount: string;
  amountTone: string;
  onDelete?: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-ink-900/5 py-3 last:border-none">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-cream-warm">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink-900">{title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-500">
          <span>{date}</span>
          <span className={cn("rounded-pill px-2 py-0.5 text-[11px] font-bold", srcTone)}>{srcLabel}</span>
          {donor && <span>· {donor}</span>}
        </div>
      </div>
      <span className={cn("font-display text-base font-bold", amountTone)}>{amount}</span>
      {onDelete && (
        <button
          type="button"
          disabled={pending}
          onClick={onDelete}
          aria-label="Smazat"
          className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-meadow-700"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}

function FilterChip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-pill border-[1.5px] px-3 py-1.5 text-xs font-bold transition-colors",
        on ? "border-ink-900 bg-ink-900 text-cream" : "border-ink-900/15 bg-cream text-ink-700 hover:border-ink-900/30",
      )}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase text-ink-600">{label}</span>
      {children}
    </label>
  );
}
