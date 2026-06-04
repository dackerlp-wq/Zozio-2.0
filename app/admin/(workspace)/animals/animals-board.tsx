"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckSquare, LayoutGrid, List, Loader2, Pencil, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  LIST_PRESETS,
  LIST_SEGMENTS,
  LIST_SORTS,
  type ListPreset,
  type ListSegment,
  type ListSort,
  type RowBadge,
  type RowMicroAction,
} from "@/lib/animal-list";

import { bulkPublishAnimals, changeAnimalStatus } from "./actions";
import { setLegalStatus } from "./[id]/intake-actions";

export interface AnimalRowVM {
  id: string;
  name: string;
  photo: string | null;
  meta: string;
  statusLabel: string;
  statusPill: string;
  badges: RowBadge[];
  attention: boolean;
  micro: { action: RowMicroAction; label: string } | null;
}

interface Params {
  q: string;
  preset: ListPreset;
  segment: ListSegment;
  sort: ListSort;
  limit: number;
}

export function AnimalsBoard({
  rows,
  total,
  shown,
  counts,
  params,
}: {
  rows: AnimalRowVM[];
  total: number;
  shown: number;
  counts: Record<string, number>;
  params: Params;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<"list" | "grid">("list");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState(params.q);
  const [err, setErr] = useState<string | null>(null);

  // Sestaví URL se zachováním ostatních parametrů (limit se při změně filtru resetuje).
  function go(patch: Partial<Params>, resetLimit = true) {
    const next = { ...params, ...patch };
    const sp = new URLSearchParams();
    if (next.q) sp.set("q", next.q);
    if (next.preset !== "all") sp.set("preset", next.preset);
    if (next.segment !== "active") sp.set("segment", next.segment);
    if (next.sort !== "intake_desc") sp.set("sort", next.sort);
    const limit = resetLimit ? 20 : next.limit;
    if (limit !== 20) sp.set("limit", String(limit));
    router.push(`/admin/animals${sp.toString() ? `?${sp}` : ""}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    go({ q: search });
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function runMicro(id: string, action: RowMicroAction) {
    setErr(null);
    startTransition(async () => {
      const res =
        action === "publish"
          ? await changeAnimalStatus(id, "available")
          : await setLegalStatus(id, "shelter_owned");
      if ("error" in res) setErr(res.error);
      else router.refresh();
    });
  }

  function bulkPublish() {
    setErr(null);
    startTransition(async () => {
      const res = await bulkPublishAnimals([...selected]);
      setSelected(new Set());
      setSelecting(false);
      router.refresh();
      if (res.skipped > 0) {
        setErr(`Zveřejněno ${res.published}, přeskočeno ${res.skipped} (v lhůtě / nepřipravená).`);
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Hlavička */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">Zvířata</h1>
        <div className="inline-flex overflow-hidden rounded-pill ring-1 ring-ink-900/10">
          {LIST_SEGMENTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go({ segment: s.key })}
              className={cn(
                "px-4 py-1.5 text-sm font-bold",
                params.segment === s.key ? "bg-ink-900 text-cream" : "bg-cream text-ink-600 hover:bg-cream-warm",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Link
          href="/admin/animals/new"
          className="ml-auto inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-4 py-2 text-sm font-bold text-cream shadow-soft-md hover:bg-meadow-600"
        >
          <Plus className="size-4" /> Přidat zvíře
        </Link>
      </div>

      {/* Lepkavé ovládání */}
      <div className="sticky top-0 z-10 mt-3 space-y-2 bg-gradient-to-b from-cream via-cream to-transparent pb-2 pt-2">
        <form onSubmit={submitSearch}>
          <div className="flex items-center gap-2 rounded-pill bg-cream px-4 py-3 ring-1 ring-ink-900/10 focus-within:ring-2 focus-within:ring-meadow-300">
            <Search className="size-4 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat podle jména, čísla čipu, tetování, evidenčního čísla…"
              className="w-full bg-transparent text-sm font-semibold text-ink-900 placeholder:text-ink-400 focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => { setSearch(""); go({ q: "" }); }} className="text-xs font-bold text-ink-400 hover:text-ink-700">
                ✕
              </button>
            )}
          </div>
        </form>

        {/* Presety */}
        <div className="flex flex-wrap gap-1.5">
          {LIST_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => go({ preset: p.key })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill border-[1.5px] px-3 py-1.5 text-xs font-bold transition-colors",
                params.preset === p.key
                  ? "border-ink-900 bg-ink-900 text-cream"
                  : "border-ink-900/15 bg-cream text-ink-700 hover:border-ink-900/30",
              )}
            >
              {p.label}
              <span className={cn("text-[11px]", params.preset === p.key ? "text-cream/70" : "text-ink-400")}>
                {counts[p.key] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Nástroje */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => { setSelecting((v) => !v); setSelected(new Set()); }}
            className={cn("inline-flex items-center gap-1.5 text-sm font-bold", selecting ? "text-meadow-700" : "text-ink-600 hover:text-ink-900")}
          >
            <CheckSquare className="size-4" /> {selecting ? "Zrušit výběr" : "Vybrat více"}
          </button>
          <span className="text-sm font-bold text-ink-500">Zobrazeno {shown} z {total}</span>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={params.sort}
              onChange={(e) => go({ sort: e.target.value as ListSort }, false)}
              className="rounded-pill bg-cream px-3 py-1.5 text-xs font-bold text-ink-700 ring-1 ring-ink-900/10 focus:outline-none"
            >
              {LIST_SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <div className="inline-flex overflow-hidden rounded-pill ring-1 ring-ink-900/10">
              <button type="button" onClick={() => setView("list")} className={cn("p-2", view === "list" ? "bg-ink-900 text-cream" : "bg-cream text-ink-500")} aria-label="Seznam">
                <List className="size-4" />
              </button>
              <button type="button" onClick={() => setView("grid")} className={cn("p-2", view === "grid" ? "bg-ink-900 text-cream" : "bg-cream text-ink-500")} aria-label="Mřížka">
                <LayoutGrid className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {err && <p className="mb-2 text-sm font-semibold text-meadow-700">{err}</p>}

      {/* Hromadná lišta */}
      {selecting && selected.size > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-3 rounded-xl bg-meadow-50 p-3 ring-1 ring-inset ring-meadow-300/40">
          <span className="text-sm font-bold text-meadow-700">Vybráno {selected.size}</span>
          <button
            type="button"
            disabled={pending}
            onClick={bulkPublish}
            className="inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-4 py-1.5 text-sm font-bold text-cream hover:bg-meadow-600 disabled:opacity-50"
          >
            {pending && <Loader2 className="size-4 animate-spin" />} Zveřejnit k adopci
          </button>
          <span className="text-xs text-ink-500">Nezpůsobilá (v lhůtě / nepřipravená) se přeskočí.</span>
        </div>
      )}

      {/* Seznam / mřížka */}
      {rows.length === 0 ? (
        <div className="rounded-3xl bg-cream p-12 text-center ring-1 ring-ink-900/8">
          <div className="text-4xl">🐾</div>
          <p className="mt-3 font-display text-lg font-bold text-ink-900">Nic neodpovídá</p>
          <p className="mt-1 text-sm text-ink-500">Zkus jiný filtr nebo hledání.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((a) => (
            <Link key={a.id} href={`/admin/animals/${a.id}`} className="overflow-hidden rounded-2xl bg-cream ring-1 ring-ink-900/8 transition hover:-translate-y-0.5 hover:shadow-soft-md">
              <div className="aspect-square bg-cream-warm">
                {a.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.photo} alt={a.name} className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-3xl">🐾</div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center gap-1.5">
                  {a.attention && <span className="size-2 rounded-full bg-terracotta-500" />}
                  <span className="truncate font-display font-bold text-ink-900">{a.name}</span>
                </div>
                <span className={cn("mt-1 inline-block rounded-pill px-2 py-0.5 text-[11px] font-bold", a.statusPill)}>
                  {a.statusLabel}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-cream ring-1 ring-ink-900/8">
          {rows.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-ink-900/5 px-4 py-2.5 last:border-none hover:bg-cream-warm/50">
              {selecting && (
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  onChange={() => toggle(a.id)}
                  className="size-4 shrink-0 accent-meadow-500"
                />
              )}
              <Link href={`/admin/animals/${a.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cream-warm text-base">
                  {a.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.photo} alt="" className="size-full object-cover" />
                  ) : (
                    "🐾"
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    {a.attention && <span className="size-2 shrink-0 rounded-full bg-terracotta-500" />}
                    <span className="font-display font-bold text-ink-900">{a.name}</span>
                    {a.badges.map((b, i) => (
                      <span key={i} className={cn("rounded-pill px-1.5 py-0.5 text-[10px] font-bold", b.tone)}>
                        {b.label}
                      </span>
                    ))}
                  </span>
                  <span className="block truncate text-xs font-semibold text-ink-500">{a.meta}</span>
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                {a.micro &&
                  (a.micro.action === "found_listing" || a.micro.action === "end_supervision" || a.micro.action === "finalize" ? (
                    <Link
                      href={`/admin/animals/${a.id}/${a.micro.action === "found_listing" ? "prijem" : a.micro.action === "end_supervision" ? "karantena" : "adopce"}`}
                      className="rounded-pill border-[1.5px] border-meadow-500 px-2.5 py-1 text-[11px] font-bold text-meadow-600 hover:bg-meadow-50"
                    >
                      {a.micro.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => runMicro(a.id, a.micro!.action)}
                      className="rounded-pill bg-fern-600 px-2.5 py-1 text-[11px] font-bold text-cream hover:bg-fern-700 disabled:opacity-50"
                    >
                      {a.micro.label}
                    </button>
                  ))}
                <span className={cn("hidden rounded-pill px-2.5 py-1 text-[11px] font-bold sm:inline", a.statusPill)}>
                  {a.statusLabel}
                </span>
                <Link href={`/admin/animals/${a.id}/profil`} className="rounded-lg p-1.5 text-ink-400 hover:bg-cream hover:text-meadow-600" aria-label="Upravit">
                  <Pencil className="size-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stránkování */}
      {shown < total && (
        <div className="py-5 text-center">
          <button
            type="button"
            onClick={() => go({ limit: params.limit + 20 }, false)}
            className="rounded-pill border-[1.5px] border-ink-900/15 bg-cream px-6 py-2.5 text-sm font-bold text-ink-700 hover:bg-cream-warm"
          >
            Načíst dalších 20
          </button>
        </div>
      )}
    </div>
  );
}
