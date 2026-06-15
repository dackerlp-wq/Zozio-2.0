"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Rocket } from "lucide-react";

import { cn } from "@/lib/utils";
import { remainingSpots, type TestingMode } from "@/lib/plans";
import { updateShelterTestingMode } from "./platform-actions";

/** Editace banneru „testovací režim" na /pro-utulky. */
export function TestingModeCard({ initial }: { initial: TestingMode }) {
  const router = useRouter();
  const [form, setForm] = useState<TestingMode>(initial);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const remaining = remainingSpots(form);

  function save() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await updateShelterTestingMode(form);
      if ("error" in res) setErr(res.error);
      else {
        setMsg("Uloženo.");
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sunshine-200 text-sunshine-600">
          <Rocket className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-xl font-bold text-ink-900">
            Banner „testovací režim" (/pro-utulky)
          </h2>
          <p className="mt-0.5 text-sm text-ink-600">
            Nabídka „Komplet zdarma na rok" pro prvních N útulků. Po naplnění
            míst se na stránce skryje.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-cream-warm px-4 py-3 ring-1 ring-ink-900/8">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) =>
              setForm((f) => ({ ...f, enabled: e.target.checked }))
            }
            className="size-5 accent-meadow-500"
          />
          <span className="text-sm font-semibold text-ink-800">
            Banner je zapnutý
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-600">
              Celkem míst
            </span>
            <input
              type="number"
              min={0}
              max={999}
              value={form.total_spots}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  total_spots: Number(e.target.value) || 0,
                }))
              }
              className="admin-input"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-600">
              Už obsazeno
            </span>
            <input
              type="number"
              min={0}
              max={form.total_spots}
              value={form.used_spots}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  used_spots: Number(e.target.value) || 0,
                }))
              }
              className="admin-input"
            />
          </label>
        </div>

        <p className="text-sm font-semibold text-ink-600">
          Zbývá{" "}
          <strong className="text-meadow-700">{remaining}</strong> z{" "}
          {form.total_spots} míst.{" "}
          {form.enabled && remaining > 0 ? (
            <span className="text-fern-600">Banner se zobrazuje s nabídkou.</span>
          ) : (
            <span className="text-ink-500">
              Banner je skrytý (vypnuto nebo plno).
            </span>
          )}
        </p>

        {err && <p className="text-sm font-semibold text-terracotta-600">{err}</p>}
        {msg && <p className="text-sm font-semibold text-fern-600">{msg}</p>}

        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className={cn(
            "inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-6 py-2.5 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50",
          )}
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Uložit nastavení
        </button>
      </div>
    </section>
  );
}
