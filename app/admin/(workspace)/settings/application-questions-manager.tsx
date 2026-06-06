"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { SPECIES_LABEL } from "@/lib/format";
import type { ApplicationQuestionRow, ApplicationQuestionType, Species } from "@/types/database";

import {
  addApplicationQuestion,
  deleteApplicationQuestion,
  toggleApplicationQuestion,
} from "./question-actions";

const TYPE_LABEL: Record<ApplicationQuestionType, string> = {
  text: "Krátká odpověď",
  textarea: "Delší text",
  select: "Výběr z možností",
  boolean: "Ano / Ne",
};

const SPECIES: Species[] = ["dog", "cat", "rabbit", "other"];

export function ApplicationQuestionsManager({
  questions,
}: {
  questions: ApplicationQuestionRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Nová otázka.
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ApplicationQuestionType>("text");
  const [options, setOptions] = useState("");
  const [required, setRequired] = useState(false);
  const [species, setSpecies] = useState<Species[]>([]);

  function run(fn: () => Promise<{ error: string } | { ok: true }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) setError(res.error);
      else {
        after?.();
        router.refresh();
      }
    });
  }

  function submit() {
    run(
      () =>
        addApplicationQuestion({
          label,
          field_type: type,
          options: type === "select" ? options.split(",").map((o) => o.trim()).filter(Boolean) : [],
          required,
          species,
        }),
      () => {
        setLabel("");
        setType("text");
        setOptions("");
        setRequired(false);
        setSpecies([]);
        setAdding(false);
      },
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-ink-900/10 bg-cream-warm/50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-sm font-bold text-ink-900">Vlastní otázky pro žadatele</div>
          <p className="text-xs text-ink-500">Objeví se ve formuláři zájmu o adopci na webu.</p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-pill border border-meadow-500 px-3 py-1.5 text-xs font-bold text-meadow-700 hover:bg-meadow-50"
          >
            <Plus className="size-3.5" /> Přidat otázku
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-xl bg-peach-100 px-3 py-2 text-xs font-semibold text-terracotta-600">
          {error}
        </div>
      )}

      {/* Seznam */}
      {questions.length > 0 && (
        <ul className="mt-3 space-y-2">
          {questions.map((q) => (
            <li
              key={q.id}
              className={cn(
                "flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 ring-1 ring-ink-900/8",
                !q.active && "opacity-50",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-900">{q.label}</div>
                <div className="text-xs text-ink-400">
                  {TYPE_LABEL[q.field_type]}
                  {q.required && " · povinné"}
                  {q.species.length > 0 &&
                    ` · jen ${q.species.map((s) => SPECIES_LABEL[s as Species] ?? s).join(", ")}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => run(() => toggleApplicationQuestion(q.id, !q.active))}
                disabled={pending}
                className="rounded-pill border border-sand2 px-2.5 py-1 text-xs font-bold text-ink-600 hover:bg-cream-warm"
              >
                {q.active ? "Skrýt" : "Zobrazit"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Smazat otázku „${q.label}"?`)) run(() => deleteApplicationQuestion(q.id));
                }}
                disabled={pending}
                className="rounded-pill border border-sand2 px-2 py-1 text-terracotta-600 hover:bg-peach-100"
                aria-label="Smazat"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Přidání */}
      {adding && (
        <div className="mt-3 space-y-3 rounded-xl bg-card p-3 ring-1 ring-ink-900/8">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Znění otázky (např. Jak dlouho bývá zvíře přes den samo?)"
            className="w-full rounded-lg border border-sand2 bg-warm px-3 py-2 text-sm focus:border-meadow-500 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TYPE_LABEL) as ApplicationQuestionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "rounded-pill border px-3 py-1.5 text-xs font-bold",
                  type === t ? "border-meadow-500 bg-meadow-50 text-meadow-700" : "border-sand2 text-ink-600",
                )}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          {type === "select" && (
            <input
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder="Možnosti oddělené čárkou (např. Vlastní bydlení, Nájem — souhlasí, Nájem — řeším)"
              className="w-full rounded-lg border border-sand2 bg-warm px-3 py-2 text-sm focus:border-meadow-500 focus:outline-none"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-400">Jen pro druh:</span>
            {SPECIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setSpecies((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
                }
                className={cn(
                  "rounded-pill border px-2.5 py-1 text-xs font-bold",
                  species.includes(s) ? "border-meadow-500 bg-meadow-50 text-meadow-700" : "border-sand2 text-ink-600",
                )}
              >
                {SPECIES_LABEL[s]}
              </button>
            ))}
            <span className="text-[11px] text-ink-400">(prázdné = všechny druhy)</span>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-700">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            Povinná otázka
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className="rounded-pill bg-meadow-500 px-4 py-2 text-sm font-bold text-cream hover:bg-meadow-600 disabled:opacity-50"
            >
              Přidat
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-pill border border-sand2 px-4 py-2 text-sm font-bold text-ink-600 hover:bg-cream-warm"
            >
              Zrušit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
