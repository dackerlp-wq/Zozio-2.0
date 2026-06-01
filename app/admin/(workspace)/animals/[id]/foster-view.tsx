"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Heart, Loader2, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { ANIMAL_COST_CATEGORIES, ANIMAL_COST_CATEGORY_LABEL } from "@/lib/format";
import { fosterTagLabel, fosterTagLabelPlain } from "@/lib/foster-tags";
import type { AnimalCostCategory } from "@/types/database";

import {
  addCheckin,
  addCommunication,
  endFosterPlacement,
  extendPlacement,
  reimburseCost,
  startFosterPlacement,
} from "./foster-actions";

// --- View modely -----------------------------------------------------------

export interface FosterVM {
  animalId: string;
  readOnly: boolean;
  feeEnabled: boolean;
  housingMode: "physical" | "foster_network" | "hybrid";
  active: {
    placementId: string;
    carer: {
      name: string;
      phone: string | null;
      city: string | null;
      capacity: number | null;
      activePlacements: number;
      tags: string[];
      approved: boolean;
    };
    careType: string | null;
    started: string;
    day: number;
    plannedUntil: string | null;
    daysLeft: number | null;
    fee: number | null;
    contractUrl: string | null;
    requirementsMet: string[];
    exclusions: string[];
    exclusionsRespected: string[];
  } | null;
  requirements: string[];
  exclusions: string[];
  matches: {
    id: string;
    name: string;
    city: string | null;
    tags: string[];
    capacity: number | null;
    activePlacements: number;
    full: boolean;
    blocked: boolean;
    score: number;
    tone: "high" | "mid" | "block" | "full";
    breakdown: { label: string; ok: boolean; severity: "block" | "important" | "nice" }[];
  }[];
  checkins: { id: string; date: string; method: "phone" | "visit" | "message" | null; note: string | null; photos: string[] }[];
  nextCheck: { date: string; daysLeft: number } | null;
  communications: { id: string; at: string; kind: "call" | "message" | "email" | null; note: string | null }[];
  history: { id: string; carerName: string; careType: string | null; range: string; endReason: string | null }[];
}

const CARE_TYPES = [
  "Rekonvalescence",
  "Krátkodobá výpomoc",
  "Dlouhodobá",
  "Paliativní",
  "Socializace",
  "Odchov mláďat",
];

const METHOD_LABEL: Record<string, string> = { phone: "📞 telefonicky", visit: "🏠 osobní návštěva", message: "💬 zpráva" };
const COMM_ICON: Record<string, string> = { call: "📞", message: "💬", email: "✉️" };

export function FosterView(vm: FosterVM) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [reimburseFor, setReimburseFor] = useState<AnimalCostCategory | null>(null);
  const [extendOpen, setExtendOpen] = useState(false);

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

      {/* Povoleno i v lhůtě */}
      <div className="flex items-center gap-3 rounded-xl bg-fern-50 p-4 ring-1 ring-inset ring-fern-100">
        <span className="text-lg">✓</span>
        <div>
          <p className="font-display font-bold text-fern-700">
            Pěstounská péče je povolená i během ochranné lhůty
          </p>
          <p className="text-sm text-fern-700/90">
            Nejde o adopci — zvíře zůstává v evidenci útulku, jen je dočasně u pěstouna.
          </p>
        </div>
      </div>

      {vm.active ? (
        <ActiveFoster
          vm={vm}
          pending={isPending}
          onEnd={() => setEndOpen(true)}
          onExtend={() => setExtendOpen(true)}
          onReimburse={(c) => setReimburseFor(c)}
        />
      ) : (
        !vm.readOnly && <FindFoster vm={vm} pending={isPending} onStart={run} />
      )}

      {/* Kontroly péče — jen u běžícího umístění */}
      {vm.active && (
        <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
          <h2 className="font-display text-lg font-bold text-ink-900">🔍 Kontroly péče</h2>
          <p className="mb-4 text-sm text-ink-500">Jak se zvířeti u pěstouna daří</p>
          {vm.nextCheck && (
            <div className="mb-4 flex items-center gap-3 rounded-md bg-sunshine-200 p-3 ring-1 ring-inset ring-sunshine-400/40">
              <span className="text-lg">⏰</span>
              <span className="flex-1 text-sm font-bold text-ink-800">
                {vm.nextCheck.daysLeft >= 0 ? `Naplánovaná kontrola za ${vm.nextCheck.daysLeft} dní` : `Kontrola po termínu (${Math.abs(vm.nextCheck.daysLeft)} dní)`}
                <span className="block text-xs font-medium text-ink-600">{vm.nextCheck.date} — měsíční kontrola</span>
              </span>
            </div>
          )}
          {!vm.readOnly && <CheckinForm animalId={vm.animalId} placementId={vm.active.placementId} pending={isPending} onAdd={run} />}
          <div className="mt-2">
            {vm.checkins.length === 0 ? (
              <p className="py-2 text-sm text-ink-500">Zatím žádné kontroly.</p>
            ) : (
              vm.checkins.map((c) => (
                <div key={c.id} className="flex gap-3 border-b border-ink-900/5 py-3 last:border-none">
                  <span className="w-16 shrink-0 text-xs font-bold text-ink-500">{c.date}</span>
                  <div className="min-w-0 flex-1">
                    {c.note && <p className="text-sm text-ink-800">{c.note}</p>}
                    <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold text-ink-500">
                      {c.method && <span>{METHOD_LABEL[c.method]}</span>}
                    </div>
                    {c.photos.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        {c.photos.map((p, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={p} alt="" className="size-12 rounded-md object-cover ring-1 ring-ink-900/8" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Komunikace */}
      {vm.active && (
        <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
          <h2 className="font-display text-lg font-bold text-ink-900">💬 Komunikace s pěstounem</h2>
          <p className="mb-4 text-sm text-ink-500">Hovory, zprávy, e-maily</p>
          {vm.communications.length === 0 ? (
            <p className="py-2 text-sm text-ink-500">Zatím žádná komunikace.</p>
          ) : (
            vm.communications.map((c) => (
              <div key={c.id} className="flex gap-3 border-b border-ink-900/5 py-3 last:border-none">
                <span className="w-6 shrink-0 text-center">{c.kind ? COMM_ICON[c.kind] : "•"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-800">{c.note}</p>
                  <p className="text-xs text-ink-500">{czDateTime(c.at)}</p>
                </div>
              </div>
            ))
          )}
          {!vm.readOnly && <CommForm animalId={vm.animalId} placementId={vm.active.placementId} pending={isPending} onAdd={run} />}
        </section>
      )}

      {/* Historie */}
      {vm.history.length > 0 && (
        <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
          <h2 className="font-display text-lg font-bold text-ink-900">📜 Historie pěstounské péče</h2>
          <p className="mb-4 text-sm text-ink-500">Předchozí umístění</p>
          {vm.history.map((h) => (
            <div key={h.id} className="flex items-center gap-3 border-b border-ink-900/5 py-3 last:border-none">
              <span className="flex size-9 items-center justify-center rounded-md bg-cream-warm">🏡</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink-900">
                  {h.carerName}
                  {h.careType ? ` — ${h.careType}` : ""}
                </p>
                <p className="text-xs text-ink-500">
                  {h.range}
                  {h.endReason ? ` · ${h.endReason}` : ""}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Modaly */}
      {endOpen && vm.active && (
        <EndModal
          inFosterNetwork={vm.housingMode === "foster_network"}
          pending={isPending}
          onClose={() => setEndOpen(false)}
          onEnd={(returnStatus, reason) =>
            run(
              () =>
                endFosterPlacement(vm.animalId, vm.active!.placementId, {
                  ended_on: "",
                  end_reason: reason,
                  return_status: returnStatus,
                  notes: "",
                }),
              () => setEndOpen(false),
            )
          }
        />
      )}
      {extendOpen && vm.active && (
        <ExtendModal
          pending={isPending}
          onClose={() => setExtendOpen(false)}
          onExtend={(date) =>
            run(() => extendPlacement(vm.animalId, vm.active!.placementId, date), () => setExtendOpen(false))
          }
        />
      )}
      {reimburseFor && vm.active && (
        <ReimburseModal
          category={reimburseFor}
          pending={isPending}
          onClose={() => setReimburseFor(null)}
          onSave={(amount, desc) =>
            run(
              () =>
                reimburseCost(vm.animalId, vm.active!.placementId, {
                  category: reimburseFor,
                  amount,
                  description: desc,
                }),
              () => setReimburseFor(null),
            )
          }
        />
      )}
    </div>
  );
}

// --- Aktivní pěstoun -------------------------------------------------------

function ActiveFoster({
  vm,
  pending,
  onEnd,
  onExtend,
  onReimburse,
}: {
  vm: FosterVM;
  pending: boolean;
  onEnd: () => void;
  onExtend: () => void;
  onReimburse: (c: AnimalCostCategory) => void;
}) {
  const f = vm.active!;
  return (
    <section className="rounded-xl bg-cream p-6 ring-1 ring-sage-300/50">
      <h2 className="mb-4 font-display text-lg font-bold text-ink-900">🏡 Aktuální pěstoun</h2>
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-sage-100 text-2xl">👤</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold text-ink-900">
            {f.carer.name}
            {f.carer.approved && (
              <span className="ml-2 rounded-pill bg-fern-50 px-2 py-0.5 text-[11px] font-bold text-fern-700">✓ schválená · z registru</span>
            )}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-ink-600">
            {f.carer.phone && <span>📞 {f.carer.phone}</span>}
            {f.carer.city && <span>📍 {f.carer.city}</span>}
            {f.carer.capacity != null && <span>🐾 kapacita {f.carer.activePlacements}/{f.carer.capacity}</span>}
          </p>
        </div>
        {f.careType && (
          <span className="rounded-pill bg-sage-100 px-3 py-1.5 text-xs font-bold text-sage-700">🩹 {f.careType}</span>
        )}
      </div>

      {f.carer.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {f.carer.tags.map((t) => (
            <span key={t} className="rounded-pill bg-cream-warm px-3 py-1 text-xs font-semibold text-ink-700">{fosterTagLabel(t)}</span>
          ))}
        </div>
      )}

      <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-ink-900/5 pt-4 text-sm sm:grid-cols-2">
        <Row k="Začátek" v={`${f.started} · ${f.day}. den`} />
        <Row
          k="Předpokl. návrat"
          v={
            f.plannedUntil ? (
              <>
                {f.plannedUntil}
                {f.daysLeft != null && (
                  <span className={cn("ml-1 font-semibold", f.daysLeft < 0 ? "text-meadow-700" : "text-sunshine-600")}>
                    · {f.daysLeft < 0 ? `po termínu ${Math.abs(f.daysLeft)} dní` : `za ${f.daysLeft} dní`}
                  </span>
                )}
              </>
            ) : "—"
          }
        />
        {vm.feeEnabled && <Row k="Příspěvek" v={f.fee != null ? `${f.fee.toLocaleString("cs-CZ")} Kč` : "—"} />}
        <Row
          k="Smlouva o péči"
          v={
            f.contractUrl ? (
              <a href={f.contractUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-meadow-600 hover:underline">
                <FileText className="size-3.5" /> smlouva
              </a>
            ) : "—"
          }
        />
        {(vm.requirements.length > 0 || f.exclusions.length > 0) && (
          <Row
            k="Splňuje požadavky"
            v={
              <span className="text-fern-700">
                {[
                  ...vm.requirements.map(
                    (r) => `${f.requirementsMet.includes(r) ? "✓" : "○"} ${fosterTagLabelPlain(r)}`,
                  ),
                  ...f.exclusions.map(
                    (x) => `${f.exclusionsRespected.includes(x) ? "✓" : "⚠"} bez „${fosterTagLabelPlain(x)}"`,
                  ),
                ].join(" · ")}
              </span>
            }
          />
        )}
      </dl>

      {!vm.readOnly && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-900/5 pt-4">
          <button type="button" disabled={pending} onClick={onEnd} className="rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50">
            ✓ Ukončit péči
          </button>
          <button type="button" onClick={onExtend} className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm">
            Prodloužit
          </button>
          {f.carer.phone && (
            <a href={`tel:${f.carer.phone}`} className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm">
              📞 Kontaktovat
            </a>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 rounded-md bg-cream-warm p-3 text-sm text-ink-600">
        <span>💡</span>
        <span>
          Po ukončení se zvíře vrátí na <b>K adopci</b> (nebo Příjem, je-li ještě v lhůtě). Volitelně lze ponechat stav.
        </span>
      </div>

      {/* Foster-to-adopt */}
      {!vm.readOnly && (
        <Link
          href={`/admin/animals/${vm.animalId}/adopce?from=foster`}
          className="mt-3 flex items-center gap-2 rounded-md bg-meadow-50 p-3 text-sm font-semibold text-meadow-700 ring-1 ring-inset ring-meadow-300/40 hover:bg-meadow-100"
        >
          <Heart className="size-4" /> Pěstoun má zájem o adopci?
          <span className="ml-auto text-meadow-600">→ Převést do adopce</span>
        </Link>
      )}

      {/* Proplacení */}
      {!vm.readOnly && (
        <div className="mt-4 border-t border-ink-900/5 pt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">💰 Proplatit pěstounovi náklad</p>
          <div className="flex flex-wrap gap-2">
            {ANIMAL_COST_CATEGORIES.filter((c) => c !== "castration" && c !== "vaccination").map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onReimburse(c)}
                className="rounded-pill border-[1.5px] border-ink-900/15 px-3 py-1.5 text-xs font-bold text-ink-700 hover:border-sunshine-400 hover:bg-sunshine-200/40"
              >
                {ANIMAL_COST_CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-500">Vytvoří náklad v modulu Náklady s vazbou na toto umístění.</p>
        </div>
      )}
    </section>
  );
}

// --- Najít pěstouna (empty state / párování) -------------------------------

function FindFoster({
  vm,
  pending,
  onStart,
}: {
  vm: FosterVM;
  pending: boolean;
  onStart: (fn: () => Promise<{ error: string } | { ok: true }>) => void;
}) {
  const [picking, setPicking] = useState<string | null>(null);

  return (
    <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
      <h2 className="font-display text-lg font-bold text-ink-900">🔎 Najít pěstouna</h2>
      <p className="mb-4 text-sm text-ink-500">Schválení pěstouni řazení podle vhodnosti</p>

      <Link href="/admin/foster" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-meadow-600 hover:text-meadow-700">
        📊 Přehled kapacity všech pěstounů →
      </Link>

      {(vm.requirements.length > 0 || vm.exclusions.length > 0) && (
        <div className="mb-4 space-y-1 rounded-md bg-meadow-50 p-3 text-sm font-semibold text-meadow-700">
          {vm.requirements.length > 0 && (
            <p>
              <b>Požadavky tohoto zvířete:</b> {vm.requirements.map(fosterTagLabelPlain).join(" · ")}
            </p>
          )}
          {vm.exclusions.length > 0 && (
            <p>
              <b>Pěstoun by neměl mít:</b> {vm.exclusions.map(fosterTagLabelPlain).join(" · ")}
            </p>
          )}
        </div>
      )}

      {vm.matches.length === 0 ? (
        <p className="py-2 text-sm text-ink-500">Žádní schválení pěstouni v registru.</p>
      ) : (
        vm.matches.map((m) => (
          <div key={m.id} className={cn("flex flex-wrap items-center gap-3 border-b border-ink-900/5 py-3 last:border-none", m.full && "opacity-55")}>
            <span className="flex size-10 items-center justify-center self-start rounded-full bg-sage-100 text-lg">👤</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink-900">{m.name}</p>
              <p className="text-xs font-semibold text-ink-500">
                {m.city ? `📍 ${m.city} · ` : ""}
                kapacita {m.activePlacements}/{m.capacity ?? "—"}
                {m.full ? " · plno" : " volné"}
              </p>
              {m.breakdown.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.breakdown.map((b, i) => (
                    <span
                      key={i}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-bold",
                        b.ok
                          ? "bg-fern-50 text-fern-700"
                          : b.severity === "block"
                            ? "bg-meadow-50 text-meadow-700 ring-1 ring-inset ring-meadow-300/50"
                            : b.severity === "important"
                              ? "bg-sunshine-200 text-ink-700"
                              : "bg-cream-warm text-ink-400",
                      )}
                    >
                      {b.ok ? "✓" : "✗"} {b.label}
                    </span>
                  ))}
                </div>
              )}
              {m.blocked && !m.full && (
                <p className="mt-1 text-[11px] font-bold text-meadow-700">⚠ Nesplňuje blokující podmínku — zvíře mu nelze nabídnout.</p>
              )}
            </div>
            <span
              className={cn(
                "self-start rounded-pill px-2.5 py-1 text-[11px] font-bold",
                m.full
                  ? "bg-cream-warm text-ink-500"
                  : m.blocked
                    ? "bg-meadow-50 text-meadow-700"
                    : m.tone === "high"
                      ? "bg-fern-50 text-fern-700"
                      : "bg-sunshine-200 text-ink-700",
              )}
            >
              {m.full ? "plno" : m.blocked ? "✗ Nevhodný" : `${m.score} % shoda`}
            </span>
            <button
              type="button"
              disabled={m.full || pending}
              onClick={() => setPicking(picking === m.id ? null : m.id)}
              className={cn(
                "self-start rounded-pill border-[1.5px] px-4 py-1.5 text-sm font-semibold disabled:opacity-40",
                m.blocked
                  ? "border-ink-900/15 text-ink-500 hover:bg-cream-warm"
                  : "border-meadow-500 text-meadow-600 hover:bg-meadow-50",
              )}
            >
              {m.blocked ? "Přesto vybrat" : "Vybrat"}
            </button>
            {picking === m.id && !m.full && (
              <StartForm animalId={vm.animalId} carerId={m.id} feeEnabled={vm.feeEnabled} pending={pending} onStart={onStart} />
            )}
          </div>
        ))
      )}

      <Link href="/admin/foster" className="mt-3 inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm">
        <Plus className="size-4" /> Přidat nového pěstouna do registru
      </Link>
    </section>
  );
}

function StartForm({
  animalId,
  carerId,
  feeEnabled,
  pending,
  onStart,
}: {
  animalId: string;
  carerId: string;
  feeEnabled: boolean;
  pending: boolean;
  onStart: (fn: () => Promise<{ error: string } | { ok: true }>) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [careType, setCareType] = useState(CARE_TYPES[0]);
  const [days, setDays] = useState(30);
  const [fee, setFee] = useState("");

  function go() {
    const planned = new Date();
    planned.setDate(planned.getDate() + days);
    onStart(() =>
      startFosterPlacement(animalId, {
        carer_id: carerId,
        started_on: today,
        planned_until: planned.toISOString().slice(0, 10),
        fee: feeEnabled && fee.trim() ? Number(fee) : null,
        contract_signed_at: "",
        contract_url: "",
        notes: "",
        care_type: careType,
      }),
    );
  }

  return (
    <div className="mt-2 flex w-full flex-wrap items-end gap-2 rounded-lg bg-cream-warm p-3">
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold uppercase text-ink-600">Typ péče</span>
        <select className="admin-input" value={careType} onChange={(e) => setCareType(e.target.value)}>
          {CARE_TYPES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold uppercase text-ink-600">Délka (dní)</span>
        <input type="number" min={1} className="admin-input w-28" value={days} onChange={(e) => setDays(Number(e.target.value))} />
      </label>
      {feeEnabled && (
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase text-ink-600">Příspěvek (Kč)</span>
          <input type="number" min={0} className="admin-input w-28" value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
      )}
      <button type="button" disabled={pending} onClick={go} className="rounded-pill bg-meadow-500 px-5 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50">
        Zahájit péči
      </button>
    </div>
  );
}

// --- Formuláře / modaly ----------------------------------------------------

function CheckinForm({
  placementId,
  pending,
  onAdd,
  animalId,
}: {
  animalId: string;
  placementId: string;
  pending: boolean;
  onAdd: (fn: () => Promise<{ error: string } | { ok: true }>, after?: () => void) => void;
}) {
  const [method, setMethod] = useState<"phone" | "visit" | "message">("phone");
  const [note, setNote] = useState("");
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <select className="admin-input w-40" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
        <option value="phone">📞 Telefonicky</option>
        <option value="visit">🏠 Osobní návštěva</option>
        <option value="message">💬 Zpráva</option>
      </select>
      <input className="admin-input flex-1" placeholder="Jak se daří? Zápis kontroly…" value={note} onChange={(e) => setNote(e.target.value)} />
      <button
        type="button"
        disabled={pending || !note.trim()}
        onClick={() =>
          onAdd(
            () => addCheckin(animalId, placementId, { checked_on: "", method, note, photos: [] }),
            () => setNote(""),
          )
        }
        className="rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
      >
        Zaznamenat
      </button>
    </div>
  );
}

function CommForm({
  animalId,
  placementId,
  pending,
  onAdd,
}: {
  animalId: string;
  placementId: string;
  pending: boolean;
  onAdd: (fn: () => Promise<{ error: string } | { ok: true }>, after?: () => void) => void;
}) {
  const [kind, setKind] = useState<"call" | "message" | "email">("call");
  const [note, setNote] = useState("");
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-900/5 pt-3">
      <select className="admin-input w-32" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
        <option value="call">📞 Hovor</option>
        <option value="message">💬 Zpráva</option>
        <option value="email">✉️ E-mail</option>
      </select>
      <input className="admin-input flex-1" placeholder="Text komunikace…" value={note} onChange={(e) => setNote(e.target.value)} />
      <button
        type="button"
        disabled={pending || !note.trim()}
        onClick={() => onAdd(() => addCommunication(animalId, placementId, kind, note), () => setNote(""))}
        className="rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
      >
        Přidat
      </button>
    </div>
  );
}

function EndModal({
  inFosterNetwork,
  pending,
  onClose,
  onEnd,
}: {
  inFosterNetwork: boolean;
  pending: boolean;
  onClose: () => void;
  onEnd: (returnStatus: "available" | "intake" | "keep", reason: string) => void;
}) {
  const [returnStatus, setReturnStatus] = useState<"available" | "intake" | "keep">("available");
  const [reason, setReason] = useState("");
  return (
    <Modal title="Ukončit pěstounskou péči" onClose={onClose}>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-600">Po ukončení</span>
        <select className="admin-input" value={returnStatus} onChange={(e) => setReturnStatus(e.target.value as typeof returnStatus)}>
          <option value="available">Vrátit na „K adopci"</option>
          <option value="intake">Vrátit na „Příjem" (ještě v lhůtě)</option>
          <option value="keep">Ponechat aktuální stav</option>
        </select>
        {inFosterNetwork && (
          <span className="mt-1 block text-xs text-ink-500">Síťový útulek nemá kotce — zvíře nejde „vrátit do kotce".</span>
        )}
      </label>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-600">Důvod ukončení</span>
        <input className="admin-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Konec rekonvalescence…" />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm">Zrušit</button>
        <button type="button" disabled={pending} onClick={() => onEnd(returnStatus, reason)} className="inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-5 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50">
          {pending && <Loader2 className="size-4 animate-spin" />} Ukončit péči
        </button>
      </div>
    </Modal>
  );
}

function ExtendModal({
  pending,
  onClose,
  onExtend,
}: {
  pending: boolean;
  onClose: () => void;
  onExtend: (date: string) => void;
}) {
  const [date, setDate] = useState("");
  return (
    <Modal title="Prodloužit péči" onClose={onClose}>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-600">Nový předpokládaný návrat</span>
        <input type="date" className="admin-input" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm">Zrušit</button>
        <button type="button" disabled={pending || !date} onClick={() => onExtend(date)} className="inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-5 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50">
          {pending && <Loader2 className="size-4 animate-spin" />} Prodloužit
        </button>
      </div>
    </Modal>
  );
}

function ReimburseModal({
  category,
  pending,
  onClose,
  onSave,
}: {
  category: AnimalCostCategory;
  pending: boolean;
  onClose: () => void;
  onSave: (amount: number, description: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <Modal title={`💰 Proplatit — ${ANIMAL_COST_CATEGORY_LABEL[category]}`} onClose={onClose}>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-600">Částka (Kč)</span>
        <input type="number" min={0} className="admin-input" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-600">Popis</span>
        <input className="admin-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Krmivo na měsíc…" />
      </label>
      <p className="mt-2 text-xs text-ink-500">Vytvoří náklad v modulu Náklady s vazbou na umístění.</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm">Zrušit</button>
        <button type="button" disabled={pending} onClick={() => onSave(Number(amount), desc)} className="inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-5 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50">
          {pending && <Loader2 className="size-4 animate-spin" />} Proplatit
        </button>
      </div>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-semibold text-ink-500">{k}</span>
      <span className="text-right font-bold text-ink-900">{v}</span>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-cream p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function czDateTime(iso: string): string {
  return new Date(iso).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
}
