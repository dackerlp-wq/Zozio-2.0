"use client";

import { useState, useTransition } from "react";

import { ZozioButton } from "@/components/zozio/button";

import { saveInternalNotes } from "../actions";

export function NotesForm({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== initial;

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveInternalNotes(id, value);
      if ("error" in res) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="mt-4 space-y-3">
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        rows={4}
        placeholder="Např. domluveno na telefonu, schůzka v sobotu…"
        className="w-full rounded-xl border border-ink-900/15 bg-cream-warm px-3 py-2.5 text-sm outline-none focus-visible:border-meadow-500 focus-visible:ring-3 focus-visible:ring-meadow-300/40"
      />
      <div className="flex items-center gap-3">
        <ZozioButton
          variant="meadow"
          size="sm"
          onClick={save}
          disabled={isPending || !dirty}
        >
          {isPending ? "Ukládám…" : "Uložit poznámky"}
        </ZozioButton>
        {saved && !dirty && (
          <span className="text-sm font-medium text-meadow-700">Uloženo ✓</span>
        )}
        {error && (
          <span className="text-sm font-medium text-terracotta-600">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
