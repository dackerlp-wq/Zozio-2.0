import { requireMembership } from "@/lib/auth";

import { ExportsPanel } from "./exports-panel";

export const metadata = { title: "Evidence & exporty — Zozio Admin" };

export default async function ExportsAdminPage() {
  await requireMembership();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
          Evidence & exporty
        </h2>
        <p className="mt-1 text-ink-600">
          Stáhni přehledy pro krajskou veterinární správu a vlastní evidenci.
          Soubory jsou ve formátu CSV (otevřeš v Excelu).
        </p>
      </div>

      <ExportsPanel />
    </div>
  );
}
