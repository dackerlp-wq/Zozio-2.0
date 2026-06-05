"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Plus, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  FOSTER_TAG_CATEGORIES,
  FOSTER_TAGS,
  fosterTagLabel,
  fosterTagLabelPlain,
  oppositeTag,
} from "@/lib/foster-tags";

import {
  createFosterCarer,
  updateFosterCarer,
  type FosterCarerValues,
} from "./actions";

const inputCls =
  "w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300";

export interface CarerListItem {
  id: string;
  name: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  capacity: number | null;
  is_active: boolean;
  activeCount: number;
  activeAnimals: string[];
  tags: string[];
  species_note: string | null;
  unavailable_until: string | null;
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

const EMPTY: FosterCarerValues = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  region: "",
  capacity: null,
  species_note: "",
  notes: "",
  is_active: true,
  tags: [],
  unavailable_until: "",
};

type AvailFilter = "all" | "free" | "full" | "unavailable";

const AVAIL_LABEL: Record<AvailFilter, string> = {
  all: "Vše",
  free: "Volní",
  full: "Plní",
  unavailable: "Nedostupní",
};

/** Stav dostupnosti pěstouna — barevně dle kapacity a dostupnosti. */
function carerAvailability(c: CarerListItem, today: string) {
  const unavailable = !!c.unavailable_until && c.unavailable_until >= today;
  const full = c.capacity != null && c.activeCount >= c.capacity;
  if (unavailable)
    return { kind: "unavailable" as const, label: "Nedostupný", cls: "bg-ink-900/8 text-ink-500" };
  if (full)
    return { kind: "full" as const, label: "Plná kapacita", cls: "bg-sunshine-200 text-sunshine-600" };
  return { kind: "free" as const, label: "Volno", cls: "bg-sage-100 text-sage-700" };
}

export function FosterList({ carers }: { carers: CarerListItem[] }) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [avail, setAvail] = useState<AvailFilter>("all");
  const [view, setView] = useState<"cards" | "list">("cards");

  // Zapamatuj poslední volbu zobrazení.
  useEffect(() => {
    const saved = localStorage.getItem("foster-view");
    if (saved === "cards" || saved === "list") setView(saved);
  }, []);
  function pickView(v: "cards" | "list") {
    setView(v);
    localStorage.setItem("foster-view", v);
  }

  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    let freeSpots = 0;
    let inCare = 0;
    for (const c of carers) {
      inCare += c.activeCount;
      const a = carerAvailability(c, today);
      if (a.kind === "free" && c.capacity != null)
        freeSpots += Math.max(0, c.capacity - c.activeCount);
    }
    return { carers: carers.length, freeSpots, inCare };
  }, [carers, today]);

  const counts = useMemo(() => {
    const m: Record<AvailFilter, number> = { all: carers.length, free: 0, full: 0, unavailable: 0 };
    for (const c of carers) m[carerAvailability(c, today).kind] += 1;
    return m;
  }, [carers, today]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return carers.filter((c) => {
      if (avail !== "all" && carerAvailability(c, today).kind !== avail) return false;
      if (!q) return true;
      const hay = [
        c.name,
        c.city,
        c.species_note,
        ...c.tags.map(fosterTagLabelPlain),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [carers, query, avail, today]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            Pěstouni
          </h2>
          <p className="mt-1 text-ink-600">
            Dočasná péče o zvířata mimo útulek.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600"
        >
          {adding ? <X className="size-4" /> : <Plus className="size-4" />}
          {adding ? "Zavřít" : "Přidat pěstouna"}
        </button>
      </div>

      {/* Statistiky */}
      <div className="grid grid-cols-3 gap-3">
        <Stat value={stats.carers} label="Pěstounů" />
        <Stat value={stats.freeSpots} label="Volných míst" tone="sage" />
        <Stat value={stats.inCare} label="Zvířat v péči" tone="coral" />
      </div>

      {adding && (
        <div className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
          <CarerForm onDone={() => setAdding(false)} />
        </div>
      )}

      {/* Lepkavé hledání + filtry + přepínač zobrazení */}
      <div className="sticky top-2 z-10 space-y-3 rounded-3xl bg-cream/95 p-3 ring-1 ring-ink-900/8 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-52 flex-1 items-center gap-2 rounded-pill bg-cream-warm px-3 py-2 ring-1 ring-ink-900/10">
            <Search className="size-4 shrink-0 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hledat jméno, město, specializaci…"
              className="w-full bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
            />
          </div>
          <div className="inline-flex overflow-hidden rounded-pill ring-1 ring-ink-900/15">
            <button
              type="button"
              onClick={() => pickView("cards")}
              aria-label="Karty"
              className={cn(
                "inline-flex items-center gap-1 px-3 py-2 text-xs font-bold",
                view === "cards" ? "bg-ink-900 text-cream" : "bg-cream text-ink-600",
              )}
            >
              <LayoutGrid className="size-3.5" /> Karty
            </button>
            <button
              type="button"
              onClick={() => pickView("list")}
              aria-label="Seznam"
              className={cn(
                "inline-flex items-center gap-1 px-3 py-2 text-xs font-bold",
                view === "list" ? "bg-ink-900 text-cream" : "bg-cream text-ink-600",
              )}
            >
              <List className="size-3.5" /> Seznam
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "free", "full", "unavailable"] as AvailFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setAvail(f)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill border-[1.5px] px-3 py-1.5 text-xs font-bold transition-colors",
                avail === f
                  ? "border-ink-900 bg-ink-900 text-cream"
                  : "border-ink-900/15 bg-cream text-ink-700 hover:border-ink-900/30",
              )}
            >
              {AVAIL_LABEL[f]}
              <span className={cn("text-[11px]", avail === f ? "text-cream/70" : "text-ink-400")}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {carers.length === 0 ? (
        <div className="rounded-3xl bg-cream p-10 text-center ring-1 ring-ink-900/8">
          <p className="text-ink-600">
            Zatím nemáš žádné pěstouny. Přidej prvního a můžeš mu předat zvíře do
            dočasné péče.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl bg-cream p-6 text-center text-sm text-ink-500 ring-1 ring-ink-900/8">
          Žádný pěstoun neodpovídá filtru.
        </p>
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((c) => (
            <CarerCard key={c.id} c={c} today={today} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl ring-1 ring-ink-900/8">
          {filtered.map((c) => (
            <CarerRow key={c.id} c={c} today={today} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "sage" | "coral";
}) {
  return (
    <div className="rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink-900/8">
      <div
        className={cn(
          "font-display text-2xl font-bold",
          tone === "sage"
            ? "text-sage-700"
            : tone === "coral"
              ? "text-meadow-600"
              : "text-ink-900",
        )}
      >
        {value}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
        {label}
      </div>
    </div>
  );
}

function CapacityPill({ c, today }: { c: CarerListItem; today: string }) {
  const a = carerAvailability(c, today);
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", a.cls)}>
      {c.activeCount}
      {c.capacity != null && `/${c.capacity}`} · {a.label}
    </span>
  );
}

function CarerCard({ c, today }: { c: CarerListItem; today: string }) {
  return (
    <Link
      href={`/admin/foster/${c.id}`}
      className="group rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8 transition hover:-translate-y-0.5 hover:shadow-soft-md"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-lg font-bold text-ink-900">
          {c.name}
        </span>
        {!c.is_active && (
          <span className="rounded-full bg-ink-900/8 px-2 py-0.5 text-xs font-semibold text-ink-500">
            Neaktivní
          </span>
        )}
      </div>
      <div className="mt-1 text-sm text-ink-500">
        {[c.city, c.phone].filter(Boolean).join(" · ") || "—"}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <CapacityPill c={c} today={today} />
        {c.activeAnimals.slice(0, 3).map((name) => (
          <span
            key={name}
            className="rounded-full bg-cream-warm px-2 py-0.5 text-ink-600"
          >
            {name}
          </span>
        ))}
      </div>
      {c.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.tags.slice(0, 5).map((t) => (
            <span
              key={t}
              className="rounded-pill bg-sage-50 px-2 py-0.5 text-[11px] font-semibold text-sage-700"
            >
              {fosterTagLabel(t)}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function CarerRow({ c, today }: { c: CarerListItem; today: string }) {
  return (
    <Link
      href={`/admin/foster/${c.id}`}
      className="flex items-center gap-3 border-b border-ink-900/8 bg-cream px-4 py-3 last:border-b-0 hover:bg-cream-warm"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-ink-900">{c.name}</span>
          {!c.is_active && (
            <span className="rounded-full bg-ink-900/8 px-1.5 py-0.5 text-[10px] font-semibold text-ink-500">
              Neaktivní
            </span>
          )}
        </div>
        <div className="truncate text-xs text-ink-500">
          {[c.city, c.phone, c.species_note].filter(Boolean).join(" · ") || "—"}
        </div>
      </div>
      <div className="hidden shrink-0 sm:block">
        <CapacityPill c={c} today={today} />
      </div>
    </Link>
  );
}

export function CarerForm({
  initial = EMPTY,
  carerId,
  onDone,
  submitLabel = "Přidat pěstouna",
}: {
  initial?: FosterCarerValues;
  carerId?: string;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<FosterCarerValues>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FosterCarerValues>(
    k: K,
    val: FosterCarerValues[K],
  ) {
    setV((s) => ({ ...s, [k]: val }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (carerId) {
        const res = await updateFosterCarer(carerId, v);
        if ("error" in res) {
          setError(res.error);
          return;
        }
        onDone?.();
        router.refresh();
        return;
      }
      const res = await createFosterCarer(v);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setV(EMPTY);
      onDone?.();
      router.refresh();
      if ("id" in res) router.push(`/admin/foster/${res.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Jméno *">
          <input
            required
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Kapacita (počet zvířat)">
          <input
            type="number"
            min={0}
            value={v.capacity ?? ""}
            onChange={(e) =>
              set("capacity", e.target.value ? Number(e.target.value) : null)
            }
            className={inputCls}
          />
        </Field>
        <Field label="Telefon">
          <input
            value={v.phone}
            onChange={(e) => set("phone", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            value={v.email}
            onChange={(e) => set("email", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Město">
          <input
            value={v.city}
            onChange={(e) => set("city", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Kraj">
          <input
            value={v.region}
            onChange={(e) => set("region", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Adresa">
        <input
          value={v.address}
          onChange={(e) => set("address", e.target.value)}
          className={inputCls}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Jaké druhy / velikosti zvládne">
          <input
            value={v.species_note}
            onChange={(e) => set("species_note", e.target.value)}
            placeholder="např. malí psi, koťata"
            className={inputCls}
          />
        </Field>
        <Field label="Nedostupný do (prázdné = k dispozici)">
          <input
            type="date"
            value={v.unavailable_until}
            onChange={(e) => set("unavailable_until", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <div>
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
          Dovednosti / štítky
        </span>
        <div className="space-y-3">
          {FOSTER_TAG_CATEGORIES.map((cat) => (
            <div key={cat.key}>
              <p className="mb-1.5 text-[11px] font-bold text-ink-500">{cat.label}</p>
              <div className="flex flex-wrap gap-2">
                {FOSTER_TAGS.filter((t) => t.category === cat.key).map((t) => {
                  const on = v.tags.includes(t.key);
                  const opposite = oppositeTag(t.key);
                  const blocked = !on && !!opposite && v.tags.includes(opposite);
                  return (
                    <button
                      key={t.key}
                      type="button"
                      disabled={blocked}
                      title={
                        blocked
                          ? `Nelze vybrat zároveň s „${fosterTagLabelPlain(opposite!)}"`
                          : t.matchable
                            ? "Ovlivňuje párovací shodu"
                            : "Doplňkový štítek"
                      }
                      onClick={() =>
                        set(
                          "tags",
                          on ? v.tags.filter((x) => x !== t.key) : [...v.tags, t.key],
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1 rounded-pill border-[1.5px] px-3 py-1.5 text-xs font-bold transition-colors",
                        on
                          ? "border-sage-500 bg-sage-50 text-sage-700"
                          : blocked
                            ? "cursor-not-allowed border-ink-900/10 bg-cream text-ink-400/60 line-through"
                            : "border-ink-900/15 bg-cream text-ink-700 hover:border-sage-500",
                      )}
                    >
                      {t.matchable && (
                        <span
                          className={cn("size-1.5 rounded-full", blocked ? "bg-ink-400/50" : "bg-sage-500")}
                          aria-hidden
                        />
                      )}
                      {t.icon} {t.label}
                      {on ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
          <span className="size-1.5 rounded-full bg-sage-500" aria-hidden />
          Štítky s tečkou ovlivňují párovací % — systém je umí automaticky
          ověřit z údajů zvířete (druh, léčba, zahrada, snášenlivost s dětmi a
          zvířaty). Ostatní jsou doplňkové.
        </p>
      </div>
      <Field label="Poznámka">
        <textarea
          rows={2}
          value={v.notes}
          onChange={(e) => set("notes", e.target.value)}
          className={inputCls}
        />
      </Field>
      {carerId && (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={v.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
            className="size-5 rounded accent-meadow-500"
          />
          <span className="text-sm font-semibold text-ink-900">Aktivní</span>
        </label>
      )}

      <div className="flex items-center justify-end gap-2">
        {error && <span className="mr-auto text-sm text-berry">{error}</span>}
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-pill px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-cream-warm"
          >
            Zrušit
          </button>
        )}
        <button
          type="submit"
          disabled={pending || !v.name.trim()}
          className="rounded-pill bg-meadow-500 px-5 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
        >
          {pending ? "Ukládám…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
