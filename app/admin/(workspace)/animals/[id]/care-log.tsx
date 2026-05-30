"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, ImagePlus, Loader2 } from "lucide-react";

import { CARE_LOG_TYPE_ICON, CARE_LOG_TYPE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CareLogEntryRow, CareLogType } from "@/types/database";

import { addCareLog, deleteCareLog } from "../care-actions";

const TYPES: CareLogType[] = [
  "feeding",
  "walk",
  "play",
  "grooming",
  "behavior",
  "training",
  "cleaning",
  "medical",
  "note",
];

export interface CareLogItem extends CareLogEntryRow {
  author: string | null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CareLog({
  animalId,
  items,
}: {
  animalId: string;
  items: CareLogItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CareLogType>("note");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleFiles(files: FileList) {
    setUploading(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload selhal");
        urls.push(data.url);
      }
      setPhotos((p) => [...p, ...urls]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload selhal");
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setOpen(false);
    setType("note");
    setNote("");
    setPhotos([]);
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addCareLog(animalId, { type, note, photo_urls: photos });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      reset();
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => (open ? reset() : setOpen(true))}
          className="inline-flex items-center gap-1.5 rounded-pill bg-ink-900 px-4 py-2 text-sm font-semibold text-cream hover:bg-ink-800"
        >
          {open ? <X className="size-4" /> : <Plus className="size-4" />}
          {open ? "Zavřít" : "Nový záznam"}
        </button>
      </div>

      {open && (
        <div className="rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8">
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "rounded-pill px-3 py-1.5 text-sm font-semibold transition-colors",
                  type === t
                    ? "bg-meadow-500 text-cream"
                    : "bg-cream-warm text-ink-600 hover:bg-sage-100",
                )}
              >
                <span className="mr-1">{CARE_LOG_TYPE_ICON[t]}</span>
                {CARE_LOG_TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          <textarea
            autoFocus
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Co se dělo…"
            className="mt-4 w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300"
          />

          {photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {photos.map((url) => (
                <div key={url} className="relative size-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="size-full rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-ink-900 p-1 text-cream"
                    aria-label="Odebrat fotku"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-pill bg-cream-warm px-3 py-1.5 text-sm font-semibold text-ink-600 hover:bg-sage-100">
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              Fotka
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  if (e.target.files?.length) handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>

            <div className="flex items-center gap-2">
              {error && <span className="text-xs text-berry">{error}</span>}
              <button
                type="button"
                disabled={pending || uploading}
                onClick={submit}
                className="rounded-pill bg-meadow-500 px-4 py-1.5 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
              >
                {pending ? "Ukládám…" : "Uložit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-3xl bg-cream p-12 text-center ring-1 ring-ink-900/8">
          <div className="text-4xl">📝</div>
          <h3 className="mt-4 font-display text-xl font-semibold text-ink-900">
            Zatím žádné záznamy
          </h3>
          <p className="mt-2 text-ink-600">
            Zapisuj si krmení, venčení, hru, chování a další péči.
          </p>
        </div>
      ) : (
        <ol className="relative space-y-4 border-l border-ink-900/10 pl-6">
          {items.map((item) => (
            <CareLogRow key={item.id} item={item} animalId={animalId} />
          ))}
        </ol>
      )}
    </div>
  );
}

function CareLogRow({
  item,
  animalId,
}: {
  item: CareLogItem;
  animalId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <li className="relative">
      <span className="absolute -left-[31px] top-1 grid size-6 place-items-center rounded-full bg-cream text-xs ring-4 ring-sage-50">
        {CARE_LOG_TYPE_ICON[item.type]}
      </span>
      <div className="rounded-2xl bg-cream p-4 ring-1 ring-ink-900/8">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-900">
            {CARE_LOG_TYPE_LABEL[item.type]}
          </span>
          <span className="text-xs text-ink-500">
            {formatDateTime(item.logged_at)}
            {item.author && <> · {item.author}</>}
          </span>
          <span className="ml-auto">
            {confirming ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteCareLog(item.id, animalId);
                      router.refresh();
                    })
                  }
                  className="rounded-full bg-berry px-2.5 py-1 text-xs font-semibold text-cream disabled:opacity-50"
                >
                  {pending ? "Mažu…" : "Smazat"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-full bg-cream-warm px-2.5 py-1 text-xs font-semibold text-ink-600"
                >
                  Zpět
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                aria-label="Smazat záznam"
                className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-berry"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </span>
        </div>
        {item.note && (
          <p className="mt-1 whitespace-pre-line text-sm text-ink-700">
            {item.note}
          </p>
        )}
        {item.photo_urls.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {item.photo_urls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={url} href={url} target="_blank" rel="noreferrer">
                <img
                  src={url}
                  alt=""
                  className="size-24 rounded-xl object-cover ring-1 ring-ink-900/8"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
