"use server";

import { revalidatePath } from "next/cache";

import { ensurePermission } from "@/lib/auth";
import { sendEmail } from "@/lib/email/send";
import { SITE_URL } from "@/lib/email/config";
import { InviteMemberEmail } from "@/lib/email/templates/invite-member";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import type { MemberRole } from "@/types/database";

type Result = { error: string } | { ok: true };

const INVITE_DAYS = 7;

function newToken(): string {
  return (
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "")
  );
}

async function ownerCount(
  service: ReturnType<typeof createServiceClient>,
  institutionId: string,
): Promise<number> {
  const { count } = await service
    .from("institution_members")
    .select("user_id", { count: "exact", head: true })
    .eq("institution_id", institutionId)
    .eq("role", "owner");
  return count ?? 0;
}

export async function inviteMember(
  email: string,
  role: MemberRole,
): Promise<Result> {
  const perm = await ensurePermission("team");
  if (!perm.ok) return { error: perm.error };
  const { institutionId } = perm.membership;

  const clean = email.trim().toLowerCase();
  if (!clean || !clean.includes("@")) return { error: "Zadej platný e-mail." };
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return { error: "Tuto roli nelze přidělit." };
  }

  const service = createServiceClient();
  const token = newToken();
  const expires = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();

  // Nahraď případnou existující čekající pozvánku stejného e-mailu.
  await service
    .from("institution_invitations")
    .delete()
    .eq("institution_id", institutionId)
    .eq("email", clean)
    .is("accepted_at", null);

  const { error } = await service.from("institution_invitations").insert({
    institution_id: institutionId,
    email: clean,
    role,
    token,
    invited_by: perm.membership.user.id,
    expires_at: expires,
  });
  if (error) return { error: error.message };

  await sendEmail({
    to: clean,
    subject: `Pozvánka do týmu — ${perm.membership.institution.name}`,
    react: InviteMemberEmail({
      institutionName: perm.membership.institution.name,
      acceptUrl: `${SITE_URL}/auth/accept-invite?token=${token}`,
    }),
  });

  revalidatePath("/admin/team");
  return { ok: true };
}

export async function resendInvite(id: string): Promise<Result> {
  const perm = await ensurePermission("team");
  if (!perm.ok) return { error: perm.error };
  const service = createServiceClient();

  const { data: inv } = await service
    .from("institution_invitations")
    .select("email, token")
    .eq("id", id)
    .eq("institution_id", perm.membership.institutionId)
    .maybeSingle();
  if (!inv) return { error: "Pozvánka nenalezena." };

  const expires = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();
  await service
    .from("institution_invitations")
    .update({ expires_at: expires })
    .eq("id", id);

  await sendEmail({
    to: (inv as { email: string }).email,
    subject: `Připomínka pozvánky — ${perm.membership.institution.name}`,
    react: InviteMemberEmail({
      institutionName: perm.membership.institution.name,
      acceptUrl: `${SITE_URL}/auth/accept-invite?token=${(inv as { token: string }).token}`,
    }),
  });

  revalidatePath("/admin/team");
  return { ok: true };
}

export async function cancelInvite(id: string): Promise<Result> {
  const perm = await ensurePermission("team");
  if (!perm.ok) return { error: perm.error };
  const service = createServiceClient();
  const { error } = await service
    .from("institution_invitations")
    .delete()
    .eq("id", id)
    .eq("institution_id", perm.membership.institutionId);
  if (error) return { error: error.message };
  revalidatePath("/admin/team");
  return { ok: true };
}

export async function changeMemberRole(
  userId: string,
  role: MemberRole,
): Promise<Result> {
  const perm = await ensurePermission("team");
  if (!perm.ok) return { error: perm.error };
  const { institutionId, role: myRole, user } = perm.membership;
  const service = createServiceClient();

  const { data: target } = await service
    .from("institution_members")
    .select("role")
    .eq("institution_id", institutionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!target) return { error: "Člen nenalezen." };
  const targetRole = (target as { role: MemberRole }).role;

  // Roli „vlastník" smí přidělovat/odebírat jen vlastník.
  if ((role === "owner" || targetRole === "owner") && myRole !== "owner") {
    return { error: "Vlastníka může měnit jen vlastník." };
  }
  // Poslední vlastník nesmí přijít o roli.
  if (targetRole === "owner" && role !== "owner" && (await ownerCount(service, institutionId)) <= 1) {
    return { error: "Útulek musí mít aspoň jednoho vlastníka." };
  }
  // Sebe nelze degradovat, pokud jsi poslední vlastník.
  if (userId === user.id && myRole === "owner" && role !== "owner" && (await ownerCount(service, institutionId)) <= 1) {
    return { error: "Jsi poslední vlastník — nelze změnit vlastní roli." };
  }

  const { error } = await service
    .from("institution_members")
    .update({ role })
    .eq("institution_id", institutionId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/team");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<Result> {
  const perm = await ensurePermission("team");
  if (!perm.ok) return { error: perm.error };
  const { institutionId, role: myRole, user } = perm.membership;
  if (userId === user.id) return { error: "Sebe nelze odebrat." };
  const service = createServiceClient();

  const { data: target } = await service
    .from("institution_members")
    .select("role")
    .eq("institution_id", institutionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!target) return { error: "Člen nenalezen." };
  const targetRole = (target as { role: MemberRole }).role;

  if (targetRole === "owner" && myRole !== "owner") {
    return { error: "Vlastníka může odebrat jen vlastník." };
  }
  if (targetRole === "owner" && (await ownerCount(service, institutionId)) <= 1) {
    return { error: "Nelze odebrat posledního vlastníka." };
  }

  const { error } = await service
    .from("institution_members")
    .delete()
    .eq("institution_id", institutionId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/team");
  return { ok: true };
}
