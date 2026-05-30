"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, Plus, Trash2, X } from "lucide-react";

import {
  ANIMAL_DOCUMENT_CATEGORIES,
  ANIMAL_DOCUMENT_CATEGORY_ICON,
  ANIMAL_DOCUMENT_CATEGORY_LABEL,
  ANIMAL_DOCUMENT_CATEGORY_PILL,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AnimalDocumentCategory } from "@/types/database";

import { addDocument, deleteDocument } from "./document-actions";
import type { DocumentWithUrl } from "./document-data";

const inputCls =
  "w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300";

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface UploadResult {
  path: string;
}

export function DocumentsSection({
  animalId,
  rows,
}: {
  animalId: string;
  rows: DocumentWithUrl[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink-900">
            <span className="mr-2">📂</span>
            Dokumenty
            {rows.length > 0 && (
              <span className="ml-2 text-sm font-semibold text-ink-400">
                {rows.length}
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Lékařské zprávy, smlouvy, příjmové doklady, očkovací průkazy…
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-ink-900 px-3 py-1.5 text-sm font-semibold text-cream hover:bg-ink-800"
        >
          {open ? <X className="size-4" /> : <Plus className="size-4" />}
          {open ? "Zavřít" : "Nahrát"}
        </button>
      </div>

      {open && (
        <div className="mb-5 rounded-2xl bg-cream-warm/60 p-4 ring-1 ring-ink-900/8">
          <DocumentForm animalId={animalId} close={() => setOpen(false)} />
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-ink-500">Zatím žádné dokumenty.</p>
      ) : (
        <ul className="divide-y divide-ink-900/8">
          {rows.map((d) => (
            <DocumentRow key={d.id} doc={d} animalId={animalId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DocumentRow({
  doc,
  animalId,
}: {
  doc: DocumentWithUrl;
  animalId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="text-2xl" aria-hidden>
        {ANIMAL_DOCUMENT_CATEGORY_ICON[doc.category]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold text-ink-900">
            {doc.title}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
              ANIMAL_DOCUMENT_CATEGORY_PILL[doc.category],
            )}
          >
            {ANIMAL_DOCUMENT_CATEGORY_LABEL[doc.category]}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
          {doc.document_date && <span>{formatDate(doc.document_date)}</span>}
          {doc.file_name && (
            <span className="truncate">· {doc.file_name}</span>
          )}
          {doc.file_size != null && <span>· {formatSize(doc.file_size)}</span>}
        </div>
        {doc.notes && (
          <p className="mt-1 whitespace-pre-line text-sm text-ink-600">
            {doc.notes}
          </p>
        )}
      </div>

      {doc.signed_url ? (
        <a
          href={doc.signed_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-pill bg-cream-warm px-3 py-1.5 text-sm font-semibold text-ink-700 ring-1 ring-ink-900/10 hover:bg-cream"
        >
          <Download className="size-4" />
          Otevřít
        </a>
      ) : (
        <span className="text-xs text-ink-400">Soubor nedostupný</span>
      )}

      {confirming ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteDocument(doc.id, animalId);
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
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="Smazat dokument"
          className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-berry"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </li>
  );
}

function DocumentForm({
  animalId,
  close,
}: {
  animalId: string;
  close: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [category, setCategory] = useState<AnimalDocumentCategory>("medical");
  const [title, setTitle] = useState("");
  const [docDate, setDocDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function uploadFile(f: File): Promise<UploadResult> {
    const fd = new FormData();
    fd.append("file", f);
    fd.append("kind", "document");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Nahrání selhalo.");
    return data as UploadResult;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Vyber soubor k nahrání.");
      return;
    }
    startTransition(async () => {
      try {
        setUploading(true);
        const up = await uploadFile(file);
        setUploading(false);
        const res = await addDocument(animalId, {
          category,
          title,
          file_path: up.path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          document_date: docDate,
          notes,
        });
        if ("error" in res) {
          setError(res.error);
          return;
        }
        close();
        router.refresh();
      } catch (err) {
        setUploading(false);
        setError(err instanceof Error ? err.message : "Nahrání selhalo.");
      }
    });
  }

  const busy = pending || uploading;

  return (
    <form onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
            Typ dokumentu
          </span>
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as AnimalDocumentCategory)
            }
            className={inputCls}
          >
            {ANIMAL_DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {ANIMAL_DOCUMENT_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
            Datum dokladu
          </span>
          <input
            type="date"
            value={docDate}
            onChange={(e) => setDocDate(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      <div className="mt-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
            Název (volitelné)
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="např. Výsledek krevního testu"
            className={inputCls}
          />
        </label>
      </div>

      <div className="mt-3">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
          Soubor
        </span>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-sm font-semibold text-ink-700 ring-1 ring-ink-900/10 hover:bg-cream-warm"
        >
          <FileUp className="size-4" />
          {file ? file.name : "Vybrat soubor…"}
        </button>
        <p className="mt-1 text-[11px] text-ink-400">
          PDF, Word, Excel, obrázky nebo text. Max 20 MB.
        </p>
      </div>

      <div className="mt-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
            Poznámka
          </span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        {error && <span className="mr-auto text-xs text-berry">{error}</span>}
        <button
          type="button"
          onClick={close}
          className="rounded-pill px-3 py-1.5 text-sm font-semibold text-ink-600 hover:bg-cream"
        >
          Zrušit
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-pill bg-meadow-500 px-4 py-1.5 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
        >
          {uploading ? "Nahrávám…" : pending ? "Ukládám…" : "Uložit"}
        </button>
      </div>
    </form>
  );
}
