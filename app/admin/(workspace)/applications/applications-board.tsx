"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronRight, Loader2, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  APP_BUCKETS,
  APP_SEGMENTS,
  APP_SORTS,
  type AppBucket,
  type AppSegment,
  type AppSort,
} from "@/lib/application-list";
import type { AdoptionStatus } from "@/types/database";

import { saveInternalNotes } from "./actions";

export interface AppRowVM {
  id: string;
  applicantName: string;
  animalId: string | null;
  animalName: string | null;
  animalPhoto: string | null;
  animalStatus: AdoptionStatus | null;
  city: string | null;
  createdAt: string;
  statusLabel: string;
  statusTone: string;
  unread: boolean;
  waiting: number | null;
  score: number | null;
  note: string | null;
  context: string | null;
  message: string | null;
  phone: string | null;
  email: string | null;
}

interface Params {
  q: string;
  bucket: AppBucket | "all";
  segment: AppSegment;
  sort: AppSort;
  limit: number;
  group: boolean;
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
}

export function ApplicationsBoard({
  rows,
  total,
  shown,
  counts,
  params,
}: {
  rows: AppRowVM[];
  total: number;
  shown: number;
  counts: Record<string, number>;
  params: Params;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(params.q);
  const [openId, setOpenId] = useState<string | null>(null);

  function go(patch: Partial<Params>, resetLimit = true) {
    const next = { ...params, ...patch };
    const sp = new URLSearchParams();
    if (next.q) sp.set("q", next.q);
    if (next.bucket !== "all") sp.set("bucket", next.bucket);
    if (next.segment !== "active") sp.set("segment", next.segment);
    if (next.sort !== "newest") sp.set("sort", next.sort);
    if (next.group) sp.set("group", "1");
    const limit = resetLimit ? 20 : next.limit;
    if (limit !== 20) sp.set("limit", String(limit));
    router.push(`/admin/applications${sp.toString() ? `?${sp}` : ""}`);
  }

  // Seskupení podle zvířete (z načteného okna).
  const groups = params.group
    ? (() => {
        const m = new Map<string, AppRowVM[]>();
        for (const r of rows) {
          const key = r.animalName ?? "—";
          (m.get(key) ?? m.set(key, []).get(key)!).push(r);
        }
        return [...m.entries()];
      })()
    : null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">Žádosti o adopci</h1>
        <div className="inline-flex overflow-hidden rounded-pill ring-1 ring-ink-900/10">
          {APP_SEGMENTS.map((s) => (
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
      </div>
      <p className="mt-1 text-ink-600">Zájemci o tvá zvířata na jednom místě.</p>

      {/* Lepkavé ovládání */}
      <div className="sticky top-0 z-10 mt-3 space-y-2 bg-gradient-to-b from-cream via-cream to-transparent pb-2 pt-2">
        <form onSubmit={(e) => { e.preventDefault(); go({ q: search }); }}>
          <div className="flex items-center gap-2 rounded-pill bg-cream px-4 py-3 ring-1 ring-ink-900/10 focus-within:ring-2 focus-within:ring-meadow-300">
            <Search className="size-4 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat podle jména zájemce, zvířete nebo místa…"
              className="w-full bg-transparent text-sm font-semibold text-ink-900 placeholder:text-ink-400 focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => { setSearch(""); go({ q: "" }); }} className="text-xs font-bold text-ink-400 hover:text-ink-700">✕</button>
            )}
          </div>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {APP_BUCKETS.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => go({ bucket: b.key })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill border-[1.5px] px-3 py-1.5 text-xs font-bold transition-colors",
                params.bucket === b.key ? "border-ink-900 bg-ink-900 text-cream" : "border-ink-900/15 bg-cream text-ink-700 hover:border-ink-900/30",
              )}
            >
              {b.label}
              {(counts[b.key] ?? 0) > 0 && (
                <span className={cn("rounded-pill px-1.5 text-[11px]", params.bucket === b.key ? "bg-cream/25" : "bg-meadow-500 text-cream")}>
                  {counts[b.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-ink-500">Zobrazeno {shown} z {total}</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => go({ group: !params.group }, false)}
              className={cn(
                "rounded-pill border-[1.5px] px-3 py-1.5 text-xs font-bold",
                params.group ? "border-meadow-500 bg-meadow-50 text-meadow-700" : "border-ink-900/15 bg-cream text-ink-700 hover:bg-cream-warm",
              )}
            >
              ⊞ Seskupit podle zvířete
            </button>
            <select
              value={params.sort}
              onChange={(e) => go({ sort: e.target.value as AppSort }, false)}
              className="rounded-pill bg-cream px-3 py-1.5 text-xs font-bold text-ink-700 ring-1 ring-ink-900/10 focus:outline-none"
            >
              {APP_SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl bg-cream p-12 text-center ring-1 ring-ink-900/8">
          <div className="text-4xl">📨</div>
          <p className="mt-3 font-display text-lg font-bold text-ink-900">Žádné žádosti</p>
          <p className="mt-1 text-sm text-ink-500">Pro tento filtr tu nic není.</p>
        </div>
      ) : groups ? (
        <div className="space-y-3">
          {groups.map(([animal, items]) => (
            <div key={animal} className="overflow-hidden rounded-3xl bg-cream ring-1 ring-ink-900/8">
              <div className="flex items-center gap-2 border-b border-ink-900/8 bg-cream-warm/60 px-4 py-2.5">
                <span className="font-display font-bold text-ink-900">{animal}</span>
                <span className="text-xs font-bold text-ink-500">{items.length} žádost{items.length === 1 ? "" : items.length < 5 ? "i" : "í"}</span>
              </div>
              {items.map((r) => (
                <Row key={r.id} r={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} onSaved={() => router.refresh()} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-cream ring-1 ring-ink-900/8">
          {rows.map((r) => (
            <Row key={r.id} r={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} onSaved={() => router.refresh()} />
          ))}
        </div>
      )}

      {shown < total && !params.group && (
        <div className="py-5 text-center">
          <button
            type="button"
            onClick={() => go({ limit: params.limit + 20 }, false)}
            className="rounded-pill border-[1.5px] border-ink-900/15 bg-cream px-6 py-2.5 text-sm font-bold text-ink-700 hover:bg-cream-warm"
          >
            Načíst další
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ r, open, onToggle, onSaved }: { r: AppRowVM; open: boolean; onToggle: () => void; onSaved: () => void }) {
  return (
    <div className="border-b border-ink-900/5 last:border-none">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cream-warm/50">
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cream-warm text-lg">
          {r.animalPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.animalPhoto} alt="" className="size-full object-cover" />
          ) : (
            "🧑"
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            {r.unread && <span className="size-2 shrink-0 rounded-full bg-meadow-500" />}
            <span className="font-display font-bold text-ink-900">{r.applicantName}</span>
            <span className="rounded-pill bg-ink-900/8 px-1.5 py-0.5 text-[10px] font-bold text-ink-500">web</span>
            {r.waiting != null && r.waiting >= 2 && (
              <span className="rounded-pill bg-sunshine-200 px-1.5 py-0.5 text-[10px] font-bold text-sunshine-600">⏳ čeká {r.waiting} dní</span>
            )}
            {r.score != null && (
              <span className={cn("rounded-pill px-1.5 py-0.5 text-[10px] font-bold", r.score >= 70 ? "bg-fern-50 text-fern-700" : "bg-sunshine-200 text-sunshine-600")}>
                vhodnost {r.score} %
              </span>
            )}
            {r.note && <span className="truncate rounded-pill bg-cream-warm px-1.5 py-0.5 text-[10px] font-bold text-ink-600">📝 {r.note}</span>}
          </span>
          <span className="block truncate text-xs font-semibold text-ink-500">
            {r.animalName && <span className="text-meadow-700">o {r.animalName}</span>}
            {[r.city, dateLabel(r.createdAt)].filter(Boolean).map((x) => ` · ${x}`).join("")}
            {r.context && <span className="text-terracotta-600"> · {r.context}</span>}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={cn("rounded-pill px-2.5 py-1 text-[11px] font-bold", r.statusTone)}>{r.statusLabel}</span>
          <ChevronRight className={cn("size-4 text-ink-400 transition-transform", open && "rotate-90")} />
        </span>
      </button>

      {open && <Peek r={r} onSaved={onSaved} />}
    </div>
  );
}

function Peek({ r, onSaved }: { r: AppRowVM; onSaved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(r.note ?? "");
  const [err, setErr] = useState<string | null>(null);

  function saveNote() {
    setErr(null);
    startTransition(async () => {
      const res = await saveInternalNotes(r.id, note);
      if ("error" in res) setErr(res.error);
      else {
        setNoteOpen(false);
        onSaved();
      }
    });
  }

  return (
    <div className="border-t border-dashed border-ink-900/15 bg-cream-warm/40 px-4 py-3 pl-16">
      {r.message ? (
        <p className="rounded-lg bg-cream p-3 text-sm text-ink-700 ring-1 ring-ink-900/8">„{r.message}"</p>
      ) : (
        <p className="text-sm text-ink-400">Bez zprávy.</p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-ink-700">
        {r.phone && <a href={`tel:${r.phone}`} className="hover:text-meadow-700">📞 {r.phone}</a>}
        {r.email && <a href={`mailto:${r.email}`} className="hover:text-meadow-700">✉️ {r.email}</a>}
      </div>
      {err && <p className="mt-2 text-sm font-semibold text-meadow-700">{err}</p>}
      {noteOpen && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Interní poznámka…"
            className="min-w-[200px] flex-1 rounded-xl bg-cream px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300"
          />
          <button type="button" disabled={pending} onClick={saveNote} className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-4 py-2 text-sm font-bold text-cream hover:bg-meadow-600 disabled:opacity-50">
            {pending && <Loader2 className="size-4 animate-spin" />} Uložit
          </button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/admin/applications/${r.id}`} className="rounded-pill bg-meadow-500 px-4 py-2 text-sm font-bold text-cream hover:bg-meadow-600">
          Otevřít žádost
        </Link>
        {r.email && (
          <a href={`mailto:${r.email}`} className="rounded-pill border-[1.5px] border-ink-900/15 bg-cream px-4 py-2 text-sm font-bold text-ink-700 hover:bg-cream-warm">
            Odpovědět
          </a>
        )}
        <button type="button" onClick={() => setNoteOpen((v) => !v)} className="rounded-pill border-[1.5px] border-ink-900/15 bg-cream px-4 py-2 text-sm font-bold text-ink-700 hover:bg-cream-warm">
          ＋ Poznámka
        </button>
      </div>
    </div>
  );
}
