import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireMembership } from "@/lib/auth";

import { AnimalForm } from "../animal-form";
import { createAnimal } from "../actions";

export const metadata = { title: "Nové zvíře — Zozio Admin" };

export default async function NewAnimalPage() {
  await requireMembership();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/animals"
          className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-sage-700"
        >
          <ChevronLeft className="size-4" /> Zpět na zvířata
        </Link>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-900">
          Nové zvíře
        </h2>
      </div>

      <AnimalForm onSubmit={createAnimal} submitLabel="Vytvořit zvíře" />
    </div>
  );
}
