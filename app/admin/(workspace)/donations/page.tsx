import { requireMembership } from "@/lib/auth";

export const metadata = { title: "Sbírky & dárci — Zozio Admin" };

export default async function DonationsPage() {
  await requireMembership();
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
        Sbírky &amp; dárci
      </h2>
      <p className="mt-1 text-ink-600">
        Dary z Darujme.cz, sponzoring, adopční poplatky a evidence dárců.
      </p>
      <div className="mt-6 rounded-3xl bg-cream p-10 text-center ring-1 ring-ink-900/8">
        <div className="text-4xl">💝</div>
        <p className="mt-3 font-display text-lg font-bold text-ink-900">Připravujeme</p>
        <p className="mt-1 text-sm text-ink-500">
          Tento modul propojí finance ze záložky Náklady do souhrnného pohledu za celý útulek.
        </p>
      </div>
    </div>
  );
}
