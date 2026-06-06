import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { canView } from "@/lib/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import type { MemberRole } from "@/types/database";

import { TeamManager, type InviteRow, type MemberRow } from "./team-manager";

export const metadata = { title: "Tým — Zozio Admin" };

export default async function TeamPage() {
  const { institutionId, role, user, institution } = await requireMembership();
  if (!canView(role, "team")) redirect("/admin/dashboard");

  const service = createServiceClient();

  const [{ data: memberData }, { data: inviteData }] = await Promise.all([
    service
      .from("institution_members")
      .select("user_id, role")
      .eq("institution_id", institutionId),
    service
      .from("institution_invitations")
      .select("id, email, role, expires_at, created_at, accepted_at")
      .eq("institution_id", institutionId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const rawMembers = (memberData ?? []) as {
    user_id: string;
    role: MemberRole;
  }[];

  // Doplň e-mail / jméno / poslední přihlášení z auth.users.
  const members: MemberRow[] = await Promise.all(
    rawMembers.map(async (m) => {
      const { data } = await service.auth.admin.getUserById(m.user_id);
      const u = data?.user;
      const name =
        (u?.user_metadata?.full_name as string | undefined) ||
        (u?.user_metadata?.name as string | undefined) ||
        null;
      return {
        userId: m.user_id,
        email: u?.email ?? "—",
        name,
        role: m.role,
        lastSignInAt: u?.last_sign_in_at ?? null,
        isYou: m.user_id === user.id,
      };
    }),
  );

  const ROLE_RANK: Record<MemberRole, number> = { owner: 0, admin: 1, staff: 2, volunteer: 3 };
  members.sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.email.localeCompare(b.email));

  const invites: InviteRow[] = (
    (inviteData ?? []) as {
      id: string;
      email: string;
      role: MemberRole;
      expires_at: string;
      created_at: string;
    }[]
  ).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    expiresAt: i.expires_at,
    createdAt: i.created_at,
  }));

  return (
    <TeamManager
      members={members}
      invites={invites}
      myRole={role}
      institutionName={institution.name}
    />
  );
}
