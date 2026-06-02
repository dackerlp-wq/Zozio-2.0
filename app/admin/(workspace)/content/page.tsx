import { requireMembership } from "@/lib/auth";

export const metadata = { title: "Web & obsah — Zozio Admin" };

export default async function ContentPage() {
  await requireMembership();
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
        Web &amp; obsah
      </h2>
      <p className="mt-1 text-ink-600">
        Veřejný katalog, články, newsletter a embedovatelný widget.
      </p>
      <div className="mt-6 rounded-3xl bg-cream p-10 text-center ring-1 ring-ink-900/8">
        <div className="text-4xl">🌐</div>
        <p className="mt-3 font-display text-lg font-bold text-ink-900">Připravujeme</p>
        <p className="mt-1 text-sm text-ink-500">
          Správa veřejné prezentace útulku na jednom místě.
        </p>
      </div>
    </div>
  );
}
