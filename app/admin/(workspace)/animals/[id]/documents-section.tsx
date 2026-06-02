"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Download, FileText, Loader2, Package, Plus, Trash2, Upload, X } from "lucide-react";

import {
  ANIMAL_DOCUMENT_CATEGORIES,
  ANIMAL_DOCUMENT_CATEGORY_ICON,
  ANIMAL_DOCUMENT_CATEGORY_LABEL,
  ANIMAL_DOCUMENT_CATEGORY_PILL,
} from "@/lib/format";
import type { RequiredDoc } from "@/lib/animal-documents";
import { cn } from "@/lib/utils";
import type { AnimalDocumentCategory, AnimalDocumentSource } from "@/types/database";

import { addDocument, deleteDocument, generateDocument } from "./document-actions";
import type { DocumentWithUrl } from "./document-data";

type ActionResult = { error: string } | { ok: true };

const inputCls =
  "w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300";

const today = () => new Date().toISOString().slice(0, 10);

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
  });
}
function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const SOURCE_CHIP: Record<AnimalDocumentSource, { label: string; tone: string }> = {
  generated: { label: "auto z modulu", tone: "bg-fern-50 text-fern-700" },
  upload: { label: "nahráno", tone: "bg-cream-warm text-ink-600" },
  scan: { label: "📷 sken", tone: "bg-sage-100 text-sage-700" },
};

const REQUIRED_TONE: Record<RequiredDoc["state"], string> = {
  ok: "bg-fern-50 text-fern-700",
  missing: "bg-sunshine-200 text-sunshine-600",
  later: "bg-cream-warm text-ink-500",
};
const REQUIRED_ICON: Record<RequiredDoc["state"], string> = { ok: "✓", missing: "⚠", later: "⏳" };

export function DocumentsSection({
  animalId,
  readOnly,
  recordNumber,
  required,
  hasAdoption,
  rows,
}: {
  animalId: string;
  readOnly: boolean;
  recordNumber: string | null;
  required: RequiredDoc[];
  hasAdoption: boolean;
  rows: DocumentWithUrl[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<AnimalDocumentCategory | "all">("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<DocumentWithUrl | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

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

  const counts = useMemo(() => {
    const m = new Map<AnimalDocumentCategory, number>();
    for (const r of rows) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return m;
  }, [rows]);

  const filtered = filter === "all" ? rows : rows.filter((r) => r.category === filter);
  const reqSummary = required.filter((r) => r.state !== "later");
  const reqDone = reqSummary.filter((r) => r.state === "ok").length;

  // Sken z fotoaparátu / nahrání → /api/upload → addDocument.
  async function uploadAndAdd(file: File, source: AnimalDocumentSource, category: AnimalDocumentCategory) {
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "document");
    startTransition(async () => {
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Nahrání selhalo.");
        const add = await addDocument(animalId, {
          category,
          title: "",
          file_path: data.path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          document_date: today(),
          notes: "",
          source,
        });
        if ("error" in add) {
          setErr(add.error);
          return;
        }
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Nahrání selhalo.");
      }
    });
  }

  return (
    <div className="space-y-5">
      {err && <p className="text-sm font-semibold text-meadow-700">{err}</p>}

      {/* Požadované dokumenty */}
      <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h2 className="mb-3 font-display text-lg font-bold text-ink-900">✅ Požadované dokumenty</h2>
        <div className="flex flex-wrap items-center gap-2">
          {required.map((r) => (
            <span
              key={r.category + r.label}
              className={cn("inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-bold", REQUIRED_TONE[r.state])}
            >
              {REQUIRED_ICON[r.state]} {r.label}
              {r.state === "later" && " — při adopci"}
            </span>
          ))}
          <span className="ml-auto text-xs font-bold text-ink-500">
            {reqDone} / {reqSummary.length} splněno
          </span>
        </div>
      </section>

      {/* Dokumenty */}
      <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">📁 Dokumenty</h2>
            <p className="text-sm text-ink-500">Centrální složka · auto-pojmenování · část se propisuje z jiných záložek</p>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => generateDocument(animalId, "intake"))}
                className="inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-ink-900/15 px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-cream-warm disabled:opacity-50"
              >
                <FileText className="size-4" /> Doklad o příjmu
              </button>
              {hasAdoption && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => generateDocument(animalId, "adoption"))}
                  className="inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-ink-900/15 px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-cream-warm disabled:opacity-50"
                >
                  <FileText className="size-4" /> Smlouva
                </button>
              )}
              <a
                href={`/api/animals/${animalId}/adoption-bundle`}
                download
                className="inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-ink-900/15 px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-cream-warm"
              >
                <Package className="size-4" /> Adopční složka
              </a>
              <button
                type="button"
                onClick={() => scanRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-sage-500 px-3 py-1.5 text-sm font-semibold text-sage-700 hover:bg-sage-50"
              >
                <Camera className="size-4" /> Vyfotit
              </button>
              <input
                ref={scanRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAndAdd(f, "scan", "other");
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => setUploadOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-3 py-1.5 text-sm font-semibold text-cream hover:bg-meadow-600"
              >
                <Upload className="size-4" /> Nahrát
              </button>
            </div>
          )}
        </div>

        {uploadOpen && !readOnly && (
          <div className="mt-3 rounded-lg bg-cream-warm/60 p-4 ring-1 ring-ink-900/8">
            <UploadForm animalId={animalId} onClose={() => setUploadOpen(false)} onError={setErr} />
          </div>
        )}

        {/* Filtr */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          <FilterChip on={filter === "all"} onClick={() => setFilter("all")} label={`Vše ${rows.length}`} />
          {ANIMAL_DOCUMENT_CATEGORIES.filter((c) => (counts.get(c) ?? 0) > 0).map((c) => (
            <FilterChip
              key={c}
              on={filter === c}
              onClick={() => setFilter(c)}
              label={`${ANIMAL_DOCUMENT_CATEGORY_ICON[c]} ${ANIMAL_DOCUMENT_CATEGORY_LABEL[c]} ${counts.get(c)}`}
            />
          ))}
        </div>

        <div className="mt-2">
          {filtered.length === 0 ? (
            <p className="py-3 text-sm text-ink-500">Žádné dokumenty.</p>
          ) : (
            filtered.map((d) => (
              <DocRow
                key={d.id}
                d={d}
                readOnly={readOnly}
                pending={pending}
                onPreview={() => setPreview(d)}
                onDelete={() => run(() => deleteDocument(d.id, animalId))}
              />
            ))
          )}
        </div>
      </section>

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function DocRow({
  d,
  readOnly,
  pending,
  onPreview,
  onDelete,
}: {
  d: DocumentWithUrl;
  readOnly: boolean;
  pending: boolean;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const src = SOURCE_CHIP[d.source];
  const isGenerated = d.source === "generated";
  const expiry = expiryMeta(d.expires_on);
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-ink-900/5 py-3 last:border-none">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-cream-warm text-lg">
        {ANIMAL_DOCUMENT_CATEGORY_ICON[d.category]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-ink-900">{d.title}</span>
          {d.version > 1 && (
            <span className="rounded-pill bg-cream-warm px-2 py-0.5 text-[10px] font-bold text-ink-500">
              v{d.version}
            </span>
          )}
        </div>
        {d.file_name && <p className="truncate font-mono text-[11px] text-ink-400">{d.file_name}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-500">
          <span className={cn("rounded-pill px-2 py-0.5 text-[10px] font-bold", ANIMAL_DOCUMENT_CATEGORY_PILL[d.category])}>
            {ANIMAL_DOCUMENT_CATEGORY_LABEL[d.category]}
          </span>
          <span className={cn("rounded-pill px-2 py-0.5 text-[10px] font-bold", src.tone)}>{src.label}</span>
          {d.related_table && (
            <Link href={`/admin/animals/${d.animal_id}/zdravi`} className="rounded-pill bg-meadow-50 px-2 py-0.5 text-[10px] font-bold text-meadow-700">
              🔗 Zdraví
            </Link>
          )}
          {expiry && (
            <span className={cn("rounded-pill px-2 py-0.5 text-[10px] font-bold", expiry.tone)}>{expiry.label}</span>
          )}
          <span className="text-[11px] text-ink-400">
            {fmtDate(d.document_date)}
            {d.file_size != null && ` · ${fmtSize(d.file_size)}`}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onPreview}
          disabled={!d.signed_url}
          className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-meadow-600 disabled:opacity-40"
          aria-label="Náhled"
          title="Náhled"
        >
          👁
        </button>
        {d.signed_url && (
          <a
            href={d.signed_url}
            download
            className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-ink-700"
            aria-label="Stáhnout"
            title="Stáhnout"
          >
            <Download className="size-4" />
          </a>
        )}
        {!readOnly && !isGenerated && (
          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-meadow-700"
            aria-label="Smazat"
            title="Smazat"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function expiryMeta(iso: string | null): { label: string; tone: string } | null {
  if (!iso) return null;
  const days = Math.round((new Date(iso + "T00:00:00").getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `⏳ propadlo (${fmtDate(iso)})`, tone: "bg-peach-200 text-terracotta-600" };
  if (days <= 30) return { label: `⏳ platnost do ${fmtDate(iso)}`, tone: "bg-sunshine-200 text-sunshine-600" };
  return { label: `platnost do ${fmtDate(iso)}`, tone: "bg-fern-50 text-fern-700" };
}

function UploadForm({
  animalId,
  onClose,
  onError,
}: {
  animalId: string;
  onClose: () => void;
  onError: (s: string | null) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<AnimalDocumentCategory>("medical");
  const [title, setTitle] = useState("");
  const [expires, setExpires] = useState("");
  const [file, setFile] = useState<File | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    if (!file) {
      onError("Vyber soubor k nahrání.");
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", "document");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Nahrání selhalo.");
        const add = await addDocument(animalId, {
          category,
          title,
          file_path: data.path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          document_date: today(),
          notes: "",
          source: "upload",
          expires_on: expires,
        });
        if ("error" in add) {
          onError(add.error);
          return;
        }
        onClose();
        router.refresh();
      } catch (e) {
        onError(e instanceof Error ? e.message : "Nahrání selhalo.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold uppercase text-ink-600">Typ</span>
        <select className={`${inputCls} w-44`} value={category} onChange={(e) => setCategory(e.target.value as AnimalDocumentCategory)}>
          {ANIMAL_DOCUMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{ANIMAL_DOCUMENT_CATEGORY_LABEL[c]}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold uppercase text-ink-600">Název</span>
        <input className={`${inputCls} min-w-[160px]`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="volitelné" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold uppercase text-ink-600">Platnost do</span>
        <input type="date" className={`${inputCls} w-40`} value={expires} onChange={(e) => setExpires(e.target.value)} />
      </label>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-sm font-semibold text-ink-700 ring-1 ring-ink-900/10 hover:bg-cream-warm"
      >
        <Upload className="size-4" /> {file ? file.name : "Soubor…"}
      </button>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
      >
        {pending && <Loader2 className="size-4 animate-spin" />} Uložit
      </button>
      <button type="button" onClick={onClose} className="rounded-pill px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-cream">
        Zrušit
      </button>
    </form>
  );
}

function PreviewModal({ doc, onClose }: { doc: DocumentWithUrl; onClose: () => void }) {
  const isImage = (doc.mime_type ?? "").startsWith("image/");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-cream p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink-900">{doc.title}</h3>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <X className="size-5" />
          </button>
        </div>
        {doc.signed_url ? (
          isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doc.signed_url} alt={doc.title} className="max-h-[75vh] w-full rounded-lg object-contain" />
          ) : (
            <iframe src={doc.signed_url} title={doc.title} className="h-[75vh] w-full rounded-lg ring-1 ring-ink-900/10" />
          )
        ) : (
          <p className="py-8 text-center text-sm text-ink-500">Soubor nedostupný.</p>
        )}
      </div>
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
