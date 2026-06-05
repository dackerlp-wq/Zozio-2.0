"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Lock,
  Settings2,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  REPORT_DEFS,
  REPORT_HEADERS,
  type ReportKey,
} from "@/lib/exports/report-defs";
import type { ExportColumnTemplateRow, ExportLogRow } from "@/types/database";

import {
  deleteColumnTemplate,
  markSubmitted,
  saveColumnTemplate,
  toggleScheduledExport,
} from "./actions";

export interface PersonOption {
  kind: "foster" | "applicant";
  id: string;
  label: string;
}

type Format = "csv" | "xlsx";

const inputCls =
  "rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

export function ExportsPanel({
  plan,
  canManage,
  kvsMonthly,
  accountingMonthly,
  log,
  templates,
  animals,
  persons,
}: {
  plan: string;
  canManage: boolean;
  kvsMonthly: boolean;
  accountingMonthly: boolean;
  log: ExportLogRow[];
  templates: ExportColumnTemplateRow[];
  animals: { id: string; name: string; record_number: string | null }[];
  persons: PersonOption[];
}) {
  const isPaid = plan === "standard" || plan === "pro";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [format, setFormat] = useState<Format>("csv");
  const [tplOpen, setTplOpen] = useState(false);
  const [selectedTpl, setSelectedTpl] = useState<Record<string, string>>({});

  const rangeParams = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p;
  }, [from, to]);

  function reportHref(key: ReportKey): string {
    const p = new URLSearchParams(rangeParams);
    p.set("type", key);
    p.set("format", format);
    const tpl = selectedTpl[key];
    if (tpl) p.set("template", tpl);
    return `/api/admin/exports?${p.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
          Evidence & exporty
        </h2>
        <p className="mt-1 text-ink-600">
          Přehledy pro krajskou veterinární správu, vlastní evidenci,
          účetnictví a granty.
        </p>
      </div>

      {/* Oficiální dokumenty */}
      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href={`/api/admin/exports/kvs?${rangeParams.toString()}`}
          className="flex items-start gap-4 rounded-3xl bg-meadow-50 p-5 ring-1 ring-meadow-500/40 transition hover:-translate-y-0.5 hover:shadow-soft-md"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-meadow-500 text-cream">
            <FileText className="size-5" />
          </span>
          <div>
            <div className="font-display text-base font-bold text-meadow-700">
              Evidence pro KVS (PDF)
            </div>
            <p className="mt-1 text-sm text-ink-600">
              Evidenční kniha dle §25 zák. 246/1992 Sb. — k odevzdání KVS. České
              znaky, razítko.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-4 py-1.5 text-sm font-semibold text-cream">
              <Download className="size-4" /> Stáhnout PDF
            </span>
          </div>
        </a>
        <a
          href={`/api/admin/exports/annual?${rangeParams.toString()}`}
          className="flex items-start gap-4 rounded-3xl bg-fern-50 p-5 ring-1 ring-fern-600/30 transition hover:-translate-y-0.5 hover:shadow-soft-md"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-fern-600 text-cream">
            <FileText className="size-5" />
          </span>
          <div>
            <div className="font-display text-base font-bold text-fern-700">
              Výroční zpráva (PDF)
            </div>
            <p className="mt-1 text-sm text-ink-600">
              Příjmy, adopce, délka pobytu, náklady, dary, úspěšnost — pro granty
              a transparentnost.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-fern-600 px-4 py-1.5 text-sm font-semibold text-cream">
              <FileText className="size-4" /> Vytvořit zprávu
            </span>
          </div>
        </a>
      </div>

      {/* Období + formát + balíček */}
      <div className="flex flex-wrap items-end gap-4 rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
            Od
          </span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
            Do
          </span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </label>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
            Formát
          </span>
          <div className="inline-flex overflow-hidden rounded-pill ring-1 ring-ink-900/15">
            {(["csv", "xlsx"] as Format[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={cn(
                  "px-4 py-2 text-xs font-bold",
                  format === f ? "bg-ink-900 text-cream" : "bg-cream text-ink-600",
                )}
              >
                {f === "csv" ? "CSV" : "Excel"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
            Sloupce
          </span>
          <button
            type="button"
            onClick={() => setTplOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-ink-900/15 bg-cream px-4 py-2 text-xs font-bold text-ink-700 hover:border-ink-900/30"
          >
            <Settings2 className="size-3.5" /> Šablona sloupců
          </button>
        </div>
        <div className="ml-auto">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
            &nbsp;
          </span>
          {isPaid ? (
            <a
              href={`/api/admin/exports/zip?format=${format}&${rangeParams.toString()}`}
              className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600"
            >
              <Download className="size-4" /> Stáhnout vše (ZIP)
            </a>
          ) : (
            <span
              title="Dostupné v placených tarifech"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-pill bg-cream-warm px-4 py-2 text-sm font-semibold text-ink-400 ring-1 ring-ink-900/10"
            >
              <Lock className="size-4" /> Stáhnout vše (ZIP)
            </span>
          )}
        </div>
      </div>
      <p className="-mt-3 text-xs text-ink-500">
        Volitelně omez exporty na rozsah dat. „Stáhnout vše" zabalí všechny
        přehledy za období (placené).
      </p>

      {tplOpen && (
        <TemplateManager templates={templates} onClose={() => setTplOpen(false)} />
      )}

      {/* Datové přehledy */}
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
          Datové přehledy
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {REPORT_DEFS.map((d) => {
            const reportTpls = templates.filter((t) => t.report_key === d.key);
            return (
              <div
                key={d.key}
                className="flex items-start gap-3 rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base font-bold text-ink-900">
                    {d.label}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-500">{d.desc}</p>
                  <p className="mt-1.5 text-[11px] font-semibold text-ink-400">
                    {d.columns}
                  </p>
                  {reportTpls.length > 0 && (
                    <select
                      value={selectedTpl[d.key] ?? ""}
                      onChange={(e) =>
                        setSelectedTpl((s) => ({ ...s, [d.key]: e.target.value }))
                      }
                      className="mt-2 rounded-lg bg-cream-warm px-2 py-1 text-xs font-semibold text-ink-700 ring-1 ring-ink-900/10"
                    >
                      <option value="">Všechny sloupce</option>
                      {reportTpls.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <PreviewButton reportKey={d.key} params={rangeParams} template={selectedTpl[d.key]} label={d.label} />
                  <a
                    href={reportHref(d.key)}
                    aria-label={`Stáhnout ${d.label}`}
                    className="grid size-9 place-items-center rounded-full bg-meadow-500 text-cream hover:bg-meadow-600"
                  >
                    <Download className="size-4" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dossier zvířete */}
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
          Složka jednoho zvířete
        </h3>
        <DossierCard animals={animals} />
      </div>

      {/* GDPR */}
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
          Osobní údaje (GDPR)
        </h3>
        <GdprCard persons={persons} />
      </div>

      {/* Naplánované exporty */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-400">
          Naplánované exporty
          <span className="rounded-pill bg-sunshine-200 px-2 py-0.5 text-[10px] font-bold text-sunshine-600">
            placené
          </span>
        </h3>
        <div className="space-y-2 rounded-3xl border border-dashed border-ink-900/15 bg-cream-warm/40 p-4">
          <ScheduleRow
            kind="kvs"
            label="KVS evidence (PDF) — automaticky 1× měsíčně na e-mail."
            enabled={kvsMonthly}
            disabled={!canManage || !isPaid}
          />
          <ScheduleRow
            kind="accounting"
            label="Účetní export — měsíčně účetní."
            enabled={accountingMonthly}
            disabled={!canManage || !isPaid}
          />
          {!isPaid && (
            <p className="text-xs font-semibold text-ink-400">
              Naplánované exporty jsou dostupné v placených tarifech.
            </p>
          )}
        </div>
      </div>

      {/* Historie odevzdání */}
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
          Historie odevzdání
        </h3>
        {log.length === 0 ? (
          <p className="rounded-3xl bg-cream p-6 text-center text-sm text-ink-500 ring-1 ring-ink-900/8">
            Zatím žádné exporty.
          </p>
        ) : (
          <div className="overflow-hidden rounded-3xl ring-1 ring-ink-900/8">
            {log.map((l) => (
              <LogRow key={l.id} log={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewButton({
  reportKey,
  params,
  template,
  label,
}: {
  reportKey: ReportKey;
  params: URLSearchParams;
  template?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ headers: string[]; rows: (string | number | null)[][]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setOpen(true);
    setLoading(true);
    const p = new URLSearchParams(params);
    p.set("type", reportKey);
    p.set("preview", "1");
    if (template) p.set("template", template);
    const res = await fetch(`/api/admin/exports?${p.toString()}`);
    setData(res.ok ? await res.json() : null);
    setLoading(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={load}
        aria-label={`Náhled ${label}`}
        className="grid size-9 place-items-center rounded-full bg-cream ring-1 ring-ink-900/10 hover:bg-cream-warm"
      >
        <Eye className="size-4 text-ink-500" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-3xl bg-cream p-5 ring-1 ring-ink-900/10" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-display text-lg font-bold text-ink-900">Náhled — {label}</h4>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm">
                <X className="size-5" />
              </button>
            </div>
            {loading ? (
              <p className="text-sm text-ink-500">Načítám…</p>
            ) : !data ? (
              <p className="text-sm text-berry">Náhled se nepodařilo načíst.</p>
            ) : (
              <>
                <div className="overflow-auto rounded-xl ring-1 ring-ink-900/8">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-cream-warm">
                      <tr>
                        {data.headers.map((h, i) => (
                          <th key={i} className="px-2 py-1.5 font-bold text-ink-700">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r, ri) => (
                        <tr key={ri} className="border-t border-ink-900/8">
                          {r.map((c, ci) => (
                            <td key={ci} className="px-2 py-1.5 text-ink-600">{c ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-ink-400">
                  Náhled prvních {data.rows.length} z {data.total} řádků.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DossierCard({
  animals,
}: {
  animals: { id: string; name: string; record_number: string | null }[];
}) {
  const [id, setId] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8">
      <span className="text-2xl">🐾</span>
      <div className="min-w-48 flex-1">
        <div className="font-display text-base font-bold text-ink-900">
          Dossier zvířete (PDF)
        </div>
        <p className="text-sm text-ink-500">
          Kompletní složka — příjem, zdraví, karanténa, dokumenty, historie. Pro
          transfer nebo nového majitele.
        </p>
      </div>
      <select value={id} onChange={(e) => setId(e.target.value)} className={inputCls}>
        <option value="">Vyber zvíře…</option>
        {animals.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.record_number ? ` · ${a.record_number}` : ""}
          </option>
        ))}
      </select>
      {id ? (
        <a
          href={`/api/admin/exports/dossier?id=${id}`}
          className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600"
        >
          <FileText className="size-4" /> Vytvořit dossier
        </a>
      ) : (
        <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-pill bg-cream-warm px-4 py-2 text-sm font-semibold text-ink-400">
          <FileText className="size-4" /> Vytvořit dossier
        </span>
      )}
    </div>
  );
}

function GdprCard({ persons }: { persons: PersonOption[] }) {
  const [val, setVal] = useState("");
  const sel = persons.find((p) => `${p.kind}:${p.id}` === val);
  const href = sel
    ? sel.kind === "foster"
      ? `/api/admin/exports/gdpr?kind=foster&id=${sel.id}`
      : `/api/admin/exports/gdpr?kind=applicant&email=${encodeURIComponent(sel.id)}`
    : null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-dashed border-ink-900/15 bg-cream p-5">
      <div className="min-w-48 flex-1">
        <div className="font-display text-base font-bold text-ink-900">
          Export osobních údajů (GDPR)
        </div>
        <p className="text-sm text-ink-500">
          Na žádost subjektu (žadatel / pěstoun) — vše, co o něm evidujeme.
        </p>
      </div>
      <select value={val} onChange={(e) => setVal(e.target.value)} className={inputCls}>
        <option value="">Vyber osobu…</option>
        {persons.map((p) => (
          <option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>
            {p.label}
          </option>
        ))}
      </select>
      {href ? (
        <a
          href={href}
          className="grid size-9 place-items-center rounded-full bg-meadow-500 text-cream hover:bg-meadow-600"
          aria-label="Stáhnout GDPR export"
        >
          <Download className="size-4" />
        </a>
      ) : (
        <span className="grid size-9 cursor-not-allowed place-items-center rounded-full bg-cream-warm text-ink-400">
          <Download className="size-4" />
        </span>
      )}
    </div>
  );
}

function ScheduleRow({
  kind,
  label,
  enabled,
  disabled,
}: {
  kind: "kvs" | "accounting";
  label: string;
  enabled: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3 border-b border-ink-900/8 py-2 last:border-b-0">
      <span className="text-base">🔁</span>
      <span className="flex-1 text-sm font-medium text-ink-700">{label}</span>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() =>
          startTransition(async () => {
            const next = !on;
            setOn(next);
            const res = await toggleScheduledExport(kind, next);
            if ("error" in res) {
              setOn(!next);
            } else {
              router.refresh();
            }
          })
        }
        aria-pressed={on}
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-pill transition-colors disabled:opacity-40",
          on ? "bg-meadow-500" : "bg-ink-900/20",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-cream transition-all",
            on ? "right-0.5" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

function LogRow({ log }: { log: ExportLogRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-ink-900/8 bg-cream px-4 py-3 last:border-b-0">
      <span className="flex-1 text-sm font-semibold text-ink-900">
        {log.label}{" "}
        <span className="text-xs font-medium uppercase text-ink-400">
          {log.format}
        </span>
      </span>
      <span className="text-xs text-ink-500">{formatDate(log.created_at)}</span>
      {log.submitted_to_kvs ? (
        <span className="inline-flex items-center gap-1 rounded-pill bg-fern-50 px-2 py-0.5 text-xs font-semibold text-fern-700">
          <CheckCircle2 className="size-3.5" /> odevzdáno KVS
        </span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await markSubmitted(log.id);
              router.refresh();
            })
          }
          className="rounded-pill border-[1.5px] border-ink-900/15 px-3 py-1 text-xs font-bold text-ink-700 hover:border-ink-900/30 disabled:opacity-50"
        >
          Označit odevzdáno
        </button>
      )}
    </div>
  );
}

function TemplateManager({
  templates,
  onClose,
}: {
  templates: ExportColumnTemplateRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reportKey, setReportKey] = useState<ReportKey>("intake");
  const [name, setName] = useState("");
  const [cols, setCols] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const headers = REPORT_HEADERS[reportKey];

  function toggleCol(c: string) {
    setCols((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  }

  return (
    <div className="rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-display text-lg font-bold text-ink-900">
          Šablony sloupců
        </h4>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm">
          <X className="size-5" />
        </button>
      </div>

      {templates.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-xl bg-cream-warm px-3 py-2 text-sm">
              <span className="flex-1 font-semibold text-ink-800">
                {t.name}{" "}
                <span className="text-xs font-medium text-ink-400">
                  ({REPORT_DEFS.find((d) => d.key === t.report_key)?.label ?? t.report_key} · {t.columns.length} sl.)
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteColumnTemplate(t.id);
                    router.refresh();
                  })
                }
                className="rounded-full p-1.5 text-ink-400 hover:bg-cream hover:text-berry"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">Přehled</span>
          <select
            value={reportKey}
            onChange={(e) => {
              setReportKey(e.target.value as ReportKey);
              setCols([]);
            }}
            className={cn(inputCls, "w-full")}
          >
            {REPORT_DEFS.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">Název šablony</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="např. Pro KVS" className={cn(inputCls, "w-full")} />
        </label>
      </div>

      <div className="mt-3">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">Sloupce</span>
        <div className="flex flex-wrap gap-1.5">
          {headers.map((h) => {
            const on = cols.includes(h);
            return (
              <button
                key={h}
                type="button"
                onClick={() => toggleCol(h)}
                className={cn(
                  "rounded-pill border-[1.5px] px-3 py-1 text-xs font-semibold transition-colors",
                  on
                    ? "border-meadow-500 bg-meadow-50 text-meadow-700"
                    : "border-ink-900/15 bg-cream text-ink-700 hover:border-meadow-500",
                )}
              >
                {h}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        {error && <span className="mr-auto text-xs text-berry">{error}</span>}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await saveColumnTemplate({ reportKey, name, columns: cols });
              if ("error" in res) {
                setError(res.error);
                return;
              }
              setName("");
              setCols([]);
              router.refresh();
            })
          }
          className="rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
        >
          Uložit šablonu
        </button>
      </div>
    </div>
  );
}
