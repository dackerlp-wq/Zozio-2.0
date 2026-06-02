"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

import { KENNEL_KIND_LABEL, KENNEL_STATUS_LABEL } from "@/lib/format";
import type { KennelFitLevel } from "@/lib/kennel-fit";
import { cn } from "@/lib/utils";
import type { KennelKind, KennelStatus, Species } from "@/types/database";

import { moveAnimalToKennel, moveWholeKennel } from "../kennel-actions";

const SPECIES_EMOJI: Record<Species, string> = { dog: "🐕", cat: "🐈", rabbit: "🐰", other: "🐾" };

export interface KennelVM {
  id: string;
  name: string;
  zone: string | null;
  kind: KennelKind;
  status: KennelStatus;
  capacity: number;
  occupied: number;
  isQuarantine: boolean;
  outOfService: boolean;
  isCurrent: boolean;
  fitLevel: KennelFitLevel;
  fitReasons: string[];
  quarantineBlocked: boolean;
  occupants: { id: string; name: string; species: Species }[];
  heated: boolean;
  accessible: boolean;
  maternity: boolean;
}

export interface PlacementVM {
  kennel: KennelVM;
  since: string | null;
  coOccupants: { id: string; name: string; species: Species }[];
}

export interface HistoryVM {
  id: string;
  kind: "kennel" | "foster";
  title: string;
  isQuarantine: boolean;
  from: string;
  to: string | null;
  note: string | null;
}

function czDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000) + 1);
}

function isSelectable(k: KennelVM): boolean {
  return !k.isCurrent && !k.outOfService && k.occupied < k.capacity && !k.quarantineBlocked;
}

export function UstajeniView({
  animalId,
  readOnly,
  inQuarantine,
  placement,
  totalStayDays,
  kennels,
  history,
}: {
  animalId: string;
  readOnly: boolean;
  inQuarantine: boolean;
  placement: PlacementVM | null;
  totalStayDays: number | null;
  kennels: KennelVM[];
  history: HistoryVM[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [bulkTarget, setBulkTarget] = useState("");

  // Sekce pro plánek.
  const zones = useMemo(() => {
    const m = new Map<string, KennelVM[]>();
    for (const k of kennels) {
      const z = k.zone || "Bez sekce";
      (m.get(z) ?? m.set(z, []).get(z)!).push(k);
    }
    return [...m.entries()];
  }, [kennels]);

  function doMove(kennelId: string) {
    setErr(null);
    startTransition(async () => {
      const res = await moveAnimalToKennel(animalId, kennelId, note);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setPicked(null);
      setNote("");
      setMoveOpen(false);
      router.refresh();
    });
  }

  function doBulk() {
    if (!placement || !bulkTarget) return;
    setErr(null);
    startTransition(async () => {
      const res = await moveWholeKennel(placement.kennel.id, bulkTarget, note);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setBulkTarget("");
      setNote("");
      setBulkOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {err && <p className="text-sm font-semibold text-meadow-700">{err}</p>}

      {/* Aktuální umístění */}
      <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h2 className="font-display text-lg font-bold text-ink-900">📍 Aktuální umístění</h2>
        <p className="mb-4 text-sm text-ink-500">Kde je zvíře právě teď</p>

        {placement ? (
          <>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex size-24 shrink-0 flex-col items-center justify-center rounded-lg bg-cream-warm ring-1 ring-ink-900/10">
                <span className="font-display text-3xl font-bold text-ink-700">{placement.kennel.name}</span>
                <span className="text-[11px] font-bold text-ink-400">kotec</span>
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className={cn(
                    "inline-block rounded-pill px-3 py-1 text-xs font-bold",
                    placement.kennel.isQuarantine
                      ? "bg-sunshine-200 text-sunshine-600"
                      : "bg-fern-50 text-fern-700",
                  )}
                >
                  {placement.kennel.isQuarantine ? "🟠 " : "🟢 "}
                  {KENNEL_KIND_LABEL[placement.kennel.kind]}
                </span>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  <Meta k="Sekce" v={placement.kennel.zone || "—"} />
                  <Meta
                    k="Od"
                    v={
                      placement.since
                        ? `${czDate(placement.since)} · ${daysSince(placement.since)}. den`
                        : "—"
                    }
                  />
                  <Meta
                    k="Celkový pobyt"
                    v={
                      <>
                        {totalStayDays != null ? `${totalStayDays} dní` : "—"}
                        {totalStayDays != null && totalStayDays >= 90 && (
                          <span className="ml-1 rounded-pill bg-peach-100 px-1.5 text-[11px] font-bold text-terracotta-600">
                            dlouhý pobyt
                          </span>
                        )}
                      </>
                    }
                  />
                  <Meta
                    k="Kapacita"
                    v={`${placement.kennel.occupied + 1} / ${placement.kennel.capacity} obsazeno`}
                  />
                </dl>
              </div>
            </div>

            {/* Spolubydlící */}
            <div className="mt-4 border-t border-ink-900/8 pt-4">
              <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-ink-400">
                <span>Spolubydlící v {placement.kennel.name}</span>
                <span>
                  {Math.max(0, placement.kennel.capacity - placement.kennel.occupied - 1)} volné místo
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {placement.coOccupants.map((o) => (
                  <span
                    key={o.id}
                    className="inline-flex items-center gap-1.5 rounded-pill bg-cream-warm py-1 pl-2 pr-3 text-sm font-semibold text-ink-700 ring-1 ring-ink-900/8"
                  >
                    <span>{SPECIES_EMOJI[o.species]}</span> {o.name}
                  </span>
                ))}
                {placement.kennel.occupied + 1 < placement.kennel.capacity && (
                  <span className="inline-flex items-center rounded-pill border border-dashed border-ink-900/20 px-3 py-1.5 text-sm font-semibold text-ink-400">
                    ＋ volné místo
                  </span>
                )}
              </div>
            </div>

            {placement.kennel.isQuarantine && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-sunshine-200/50 p-3 text-xs font-semibold text-ink-700 ring-1 ring-inset ring-sunshine-400/40">
                <span>🛡️</span>
                <span>
                  Umístění v karanténním kotci řídí <b>záložka Karanténa</b>. Po ukončení dohledu se
                  zvíře přesune do běžné části.
                </span>
              </div>
            )}

            {!readOnly && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-900/8 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setMoveOpen((v) => !v);
                    setBulkOpen(false);
                  }}
                  className="rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600"
                >
                  ↔ Přesunout do jiného kotce
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBulkOpen((v) => !v);
                    setMoveOpen(false);
                  }}
                  className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm"
                >
                  👥 Přesunout celý kotec
                </button>
                <Link
                  href="/admin/kennels"
                  className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-warm"
                >
                  🏠 Správa kotců →
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">Zvíře zatím nemá přiřazený kotec.</p>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setMoveOpen((v) => !v)}
                className="rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600"
              >
                ↔ Přiřadit kotec
              </button>
            )}
          </div>
        )}

        {/* Hromadný přesun */}
        {bulkOpen && placement && !readOnly && (
          <div className="mt-4 rounded-lg bg-cream-warm p-4 ring-1 ring-ink-900/8">
            <p className="mb-2 text-sm font-semibold text-ink-800">
              Přesunout všechna zvířata z {placement.kennel.name} do:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkTarget}
                onChange={(e) => setBulkTarget(e.target.value)}
                className="rounded-xl bg-cream px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300"
              >
                <option value="">— vyber cílový kotec —</option>
                {kennels
                  .filter((k) => k.id !== placement.kennel.id && !k.outOfService)
                  .map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.occupied}/{k.capacity})
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={pending || !bulkTarget}
                onClick={doBulk}
                className="inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
              >
                {pending && <Loader2 className="size-4 animate-spin" />} Přesunout
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Přesun — plánek + doporučení */}
      {moveOpen && !readOnly && (
        <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
          <h2 className="font-display text-lg font-bold text-ink-900">↔ Přesunout</h2>
          <p className="mb-4 text-sm text-ink-500">
            Nabízíme <b>všechny volné kotce</b> — vhodnost jen doporučujeme, rozhodnutí je na tobě.
          </p>

          {inQuarantine && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-sunshine-200/50 p-3 text-xs font-semibold text-ink-700 ring-1 ring-inset ring-sunshine-400/40">
              <span>🛡️</span>
              <span>Probíhá karanténa/izolace — přesun je možný jen do karanténních kotců.</span>
            </div>
          )}

          {/* Plánek po sekcích */}
          {zones.map(([zone, list]) => (
            <div key={zone} className="mb-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">{zone}</p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
                {list.map((k) => (
                  <Tile key={k.id} k={k} picked={picked === k.id} onPick={() => isSelectable(k) && setPicked(k.id)} />
                ))}
              </div>
            </div>
          ))}

          <Legend />

          {/* Detailní doporučení (řazeno: doporučené nahoře) */}
          <div className="mt-5 border-t border-ink-900/8 pt-4">
            {[...kennels]
              .filter((k) => !k.isCurrent)
              .sort((a, b) => rankFit(a) - rankFit(b))
              .map((k) => {
                const selectable = isSelectable(k);
                return (
                  <div
                    key={k.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 border-b border-ink-900/5 py-3 last:border-none",
                      !selectable && "opacity-55",
                    )}
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-cream-warm font-display text-base font-bold text-ink-700">
                      {k.name}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink-900">
                        Kotec {k.name}
                        {k.outOfService ? (
                          <span className="rounded-pill bg-cream-warm px-2 py-0.5 text-[11px] font-bold text-ink-500">
                            {KENNEL_STATUS_LABEL[k.status]}
                          </span>
                        ) : k.fitLevel === "recommended" ? (
                          <span className="rounded-pill bg-fern-50 px-2 py-0.5 text-[11px] font-bold text-fern-700">
                            👍 doporučeno
                          </span>
                        ) : k.fitLevel === "less_suitable" ? (
                          <span className="rounded-pill bg-sunshine-200 px-2 py-0.5 text-[11px] font-bold text-sunshine-600">
                            ⚠ méně vhodné
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs font-semibold text-ink-500">
                        {[k.zone, ...k.fitReasons].filter(Boolean).join(" · ")}
                        {k.quarantineBlocked && " · jen během karantény nelze"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-pill px-2 py-0.5 text-[11px] font-bold",
                        k.occupied >= k.capacity ? "bg-peach-200 text-terracotta-600" : "bg-fern-50 text-fern-700",
                      )}
                    >
                      {k.occupied}/{k.capacity}
                    </span>
                    <button
                      type="button"
                      disabled={!selectable || pending}
                      onClick={() => setPicked(k.id)}
                      className="rounded-pill border-[1.5px] border-meadow-500 px-4 py-1.5 text-sm font-semibold text-meadow-600 hover:bg-meadow-50 disabled:opacity-40"
                    >
                      Vybrat
                    </button>
                  </div>
                );
              })}
          </div>

          {/* Potvrzení výběru */}
          {picked && (
            <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg bg-cream-warm p-4">
              <label className="block flex-1">
                <span className="mb-1 block text-[11px] font-bold uppercase text-ink-600">
                  Přesunout do {kennels.find((k) => k.id === picked)?.name} — poznámka (volitelně)
                </span>
                <input
                  className="w-full rounded-xl bg-cream px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Důvod přesunu…"
                />
              </label>
              <button
                type="button"
                disabled={pending}
                onClick={() => doMove(picked)}
                className="inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-5 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
              >
                {pending && <Loader2 className="size-4 animate-spin" />} Přesunout sem
              </button>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="rounded-pill px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-cream"
              >
                Zrušit
              </button>
            </div>
          )}

          <div className="mt-4">
            <Link href="/admin/kennels" className="text-sm font-bold text-meadow-600 hover:text-meadow-700">
              🏠 Spravovat kotce, kapacity a vlastnosti →
            </Link>
          </div>
        </section>
      )}

      {/* Historie */}
      <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h2 className="font-display text-lg font-bold text-ink-900">📜 Historie umístění</h2>
        <p className="mb-4 text-sm text-ink-500">Pohyb zvířete mezi kotci</p>
        {history.length === 0 ? (
          <p className="text-sm text-ink-500">Zatím žádné přesuny.</p>
        ) : (
          history.map((h) => (
            <div key={h.id} className="flex items-start gap-3 border-b border-ink-900/5 py-3 last:border-none">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-cream-warm">
                {h.kind === "foster" ? "🏡" : h.isQuarantine ? "🟠" : "🟢"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink-900">{h.title}</p>
                <p className="text-xs text-ink-500">
                  {czDate(h.from)} <ArrowRight className="inline size-3" /> {h.to ? czDate(h.to) : "nyní"}
                  {h.note ? ` · ${h.note}` : ""}
                </p>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function rankFit(k: KennelVM): number {
  if (k.isCurrent || k.outOfService || k.occupied >= k.capacity || k.quarantineBlocked) return 3;
  if (k.fitLevel === "recommended") return 0;
  if (k.fitLevel === "neutral") return 1;
  return 2; // less_suitable
}

function Tile({ k, picked, onPick }: { k: KennelVM; picked: boolean; onPick: () => void }) {
  const full = k.occupied >= k.capacity;
  const selectable = isSelectable(k);
  const tone = k.outOfService
    ? "bg-cream-warm border-ink-900/10 opacity-55 cursor-not-allowed"
    : k.isQuarantine
      ? "bg-sunshine-200/60 border-sunshine-400/50"
      : full
        ? "bg-cream-warm border-ink-900/10 opacity-55 cursor-not-allowed"
        : k.fitLevel === "recommended"
          ? "bg-fern-50 border-fern-100"
          : k.fitLevel === "less_suitable"
            ? "bg-peach-100 border-peach-300"
            : "bg-cream border-ink-900/10";
  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={onPick}
      className={cn(
        "relative flex aspect-square flex-col items-center justify-center rounded-md border-[1.5px] transition",
        tone,
        selectable && "hover:border-meadow-500",
        k.isCurrent && "outline outline-2 outline-meadow-500",
        picked && "ring-2 ring-meadow-500",
      )}
    >
      <span className="font-display text-base font-bold text-ink-700">{k.name}</span>
      <span className="text-[10px] font-bold text-ink-500">
        {k.isCurrent ? "teď zde" : full ? `${k.occupied}/${k.capacity} plno` : `${k.occupied}/${k.capacity} volno`}
      </span>
      {!k.outOfService && !full && !k.isCurrent && k.fitLevel === "recommended" && (
        <span className="absolute right-1 top-1 text-[10px]">👍</span>
      )}
      {!k.outOfService && !full && k.fitLevel === "less_suitable" && (
        <span className="absolute right-1 top-1 text-[10px]">⚠</span>
      )}
    </button>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["bg-fern-50 ring-fern-100", "doporučeno"],
    ["bg-peach-100 ring-peach-300", "méně vhodné"],
    ["bg-cream ring-ink-900/15", "volné"],
    ["bg-cream-warm ring-ink-900/10", "plno / mimo provoz"],
    ["bg-sunshine-200/60 ring-sunshine-400/50", "karanténní"],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold text-ink-500">
      {items.map(([cls, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <i className={cn("inline-block size-3 rounded ring-1 ring-inset", cls)} /> {label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block size-3 rounded bg-cream outline outline-2 outline-meadow-500" /> aktuální
      </span>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold text-ink-400">{k}</span>
      <span className="font-bold text-ink-900">{v}</span>
    </div>
  );
}
