import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth";

export const metadata = { title: "Tým — Zozio Admin" };

export default async function TeamPage() {
  const { role } = await requireMembership();
  if (role === "staff") redirect("/admin/dashboard");
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
        Tým
      </h2>
      <p className="mt-1 text-ink-600">
        Uživatelé útulku, jejich role a pozvánky.
      </p>
      <div className="mt-6 rounded-3xl bg-cream p-10 text-center ring-1 ring-ink-900/8">
        <div className="text-4xl">👥</div>
        <p className="mt-3 font-display text-lg font-bold text-ink-900">Připravujeme</p>
        <p className="mt-1 text-sm text-ink-500">
          Správa členů týmu (vlastník / správce / zaměstnanec) a pozvánky e-mailem.
        </p>
      </div>
    </div>
  );
}
