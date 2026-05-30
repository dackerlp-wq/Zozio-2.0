"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import { deleteAnimal } from "./actions";

export function AnimalRowActions({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await deleteAnimal(id);
      setConfirming(false);
    });
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <ZozioButton asChild variant="ghost" size="icon" aria-label={`Otevřít ${name}`}>
        <Link href={`/admin/animals/${id}`}>
          <Pencil />
        </Link>
      </ZozioButton>

      {confirming ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-full bg-berry px-3 py-1.5 text-xs font-semibold text-cream disabled:opacity-50"
          >
            {isPending ? "Mažu…" : "Smazat"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-full bg-cream-warm px-3 py-1.5 text-xs font-semibold text-ink-600"
          >
            Zrušit
          </button>
        </div>
      ) : (
        <ZozioButton
          variant="ghost"
          size="icon"
          aria-label={`Smazat ${name}`}
          onClick={() => setConfirming(true)}
        >
          <Trash2 />
        </ZozioButton>
      )}
    </div>
  );
}
