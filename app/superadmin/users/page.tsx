import { createServiceClient } from "@/lib/supabase/service";

import { RoleSelect } from "./role-select";

export const metadata = { title: "Uživatelé — Superadmin" };

export default async function SuperadminUsersPage() {
  const service = createServiceClient();

  const { data: usersData } = await service.auth.admin.listUsers({
    perPage: 200,
  });
  const users = usersData?.users ?? [];

  // Mapuj user_id → název útulku
  const { data: membersData } = await service
    .from("institution_members")
    .select("user_id, role, institution:institutions(name)");

  const members = (membersData ?? []) as unknown as {
    user_id: string;
    role: string;
    institution: { name: string } | null;
  }[];

  const membershipByUser = new Map<string, { institution: string }>();
  for (const m of members) {
    if (m.institution)
      membershipByUser.set(m.user_id, { institution: m.institution.name });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
          Uživatelé
        </h1>
        <p className="mt-1 text-ink-600">
          {users.length} registrovaných uživatelů. Role řídí přístup do
          administrace.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl bg-cream ring-1 ring-ink-900/8">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-900/8 text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-5 py-3 font-semibold">Útulek</th>
              <th className="px-5 py-3 font-semibold">Registrace</th>
              <th className="px-5 py-3 font-semibold">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const role = (u.user_metadata?.role as string) ?? "visitor";
              const membership = membershipByUser.get(u.id);
              return (
                <tr
                  key={u.id}
                  className="border-b border-ink-900/5 last:border-0 hover:bg-sand/40"
                >
                  <td className="px-5 py-3 font-medium text-ink-900">
                    {u.email ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-ink-600">
                    {membership?.institution ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-ink-600">
                    {new Date(u.created_at).toLocaleDateString("cs-CZ")}
                  </td>
                  <td className="px-5 py-3">
                    <RoleSelect userId={u.id} current={role} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
