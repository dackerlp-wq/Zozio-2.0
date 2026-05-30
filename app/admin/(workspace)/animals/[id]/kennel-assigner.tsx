"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

import { moveAnimalToKennel } from "../kennel-actions";

export interface KennelOption {
  id: string;
  name: string;
  capacity: number;
  is_quarantine: boolean;
  occupied: number;
}

export function KennelAssigner({
  animalId,
  currentKennelId,
  kennels,
}: {
  animalId: string;
  currentKennelId: string | null;
  kennels: KennelOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(currentKennelId);
  const [note, setNote] = useState("");

  const changed = selected !== currentKennelId;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await moveAnimalToKennel(animalId, selected, note);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setNote("");
      router.refresh();
    });
  }

  return (
    <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
      <h2 className="mb-4 font-display text-xl font-bold text-ink-900">
        Umístění
      </h2>

      {kennels.length === 0 ? (
        <p className="text-sm text-ink-500">
          Zatím nemáš žádné kotce. Vytvoř je v sekci{" "}
          <span className="font-semibold">Kotce</span>.
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className={cn(
                "rounded-2xl border-2 px-4 py-3 text-left transition-colors",
                selected === null
                  ? "border-meadow-500 bg-meadow-50"
                  : "border-ink-900/10 hover:border-ink-900/20",
              )}
            >
              <span className="font-semibold text-ink-900">Bez kotce</span>
            </button>
            {kennels.map((k) => {
              const isCurrent = k.id === currentKennelId;
              const full = k.occupied >= k.capacity && !isCurrent;
              return (
                <button
                  key={k.id}
                  type="button"
                  disabled={full}
                  onClick={() => setSelected(k.id)}
                  className={cn(
                    "rounded-2xl border-2 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    selected === k.id
                      ? "border-meadow-500 bg-meadow-50"
                      : "border-ink-900/10 hover:border-ink-900/20",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink-900">{k.name}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        full
                          ? "bg-peach-200 text-terracotta-600"
                          : "bg-sage-100 text-sage-700",
                      )}
                    >
                      {k.occupied}/{k.capacity}
                    </span>
                  </div>
                  {k.is_quarantine && (
                    <span className="mt-1 inline-block text-xs font-semibold text-terracotta-600">
                      Karanténa
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {changed && (
            <div className="mt-4 space-y-3">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Poznámka k přesunu (volitelné)…"
                className="w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300"
              />
              <div className="flex items-center justify-end gap-2">
                {error && (
                  <span className="mr-auto text-xs text-berry">{error}</span>
                )}
                <button
                  type="button"
                  onClick={() => setSelected(currentKennelId)}
                  className="rounded-pill px-3 py-1.5 text-sm font-semibold text-ink-600 hover:bg-cream-warm"
                >
                  Zrušit
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={submit}
                  className="rounded-pill bg-meadow-500 px-4 py-1.5 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
                >
                  {pending ? "Přesouvám…" : "Přesunout"}
                </button>
              </div>
            </div>
          )}
          {error && !changed && (
            <p className="mt-3 text-xs text-berry">{error}</p>
          )}
        </>
      )}
    </section>
  );
}
