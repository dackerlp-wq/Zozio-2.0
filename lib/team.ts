/**
 * Načtení členů týmu útulku pro přiřazování (assignee) — úkoly, check-iny.
 * Server-only (resolvuje e-maily přes service admin).
 */
import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { MemberRole } from "@/types/database";

export interface TeamMemberOption {
  userId: string;
  label: string;
  role: MemberRole;
}

export async function getTeamMembers(
  institutionId: string,
): Promise<TeamMemberOption[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("institution_members")
    .select("user_id, role")
    .eq("institution_id", institutionId);

  const rows = (data ?? []) as { user_id: string; role: MemberRole }[];
  const out = await Promise.all(
    rows.map(async (m) => {
      const { data: u } = await service.auth.admin.getUserById(m.user_id);
      const label =
        (u?.user?.user_metadata?.full_name as string | undefined) ||
        (u?.user?.user_metadata?.name as string | undefined) ||
        u?.user?.email ||
        "—";
      return { userId: m.user_id, label, role: m.role };
    }),
  );
  return out.sort((a, b) => a.label.localeCompare(b.label, "cs"));
}
