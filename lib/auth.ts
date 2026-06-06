import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { can, type PermArea } from "@/lib/permissions";
import type { MemberRole, VerificationStatus } from "@/types/database";

export interface Membership {
  user: User;
  institutionId: string;
  role: MemberRole;
  institution: {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    is_published: boolean;
    is_verified: boolean;
    verification_status: VerificationStatus;
    rejection_reason: string | null;
    suspension_reason: string | null;
  };
}

/** Vrací přihlášeného usera nebo null. */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Vrací membership přihlášeného usera (první institutce ke které patří) nebo
 * null. Multi-tenancy = 1 user : 1 instituce, takže bereme první.
 */
export async function getCurrentMembership(): Promise<Membership | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("institution_members")
    .select(
      "institution_id, role, institution:institutions(id, slug, name, logo_url, is_published, is_verified, verification_status, rejection_reason, suspension_reason)",
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as {
    institution_id: string;
    role: MemberRole;
    institution: Membership["institution"] | null;
  };
  if (!row.institution) return null;

  return {
    user,
    institutionId: row.institution_id,
    role: row.role,
    institution: row.institution,
  };
}

/**
 * Vyžaduje přihlášení + membership. Když chybí → redirect.
 * Použij na začátku admin Server Components / actions.
 */
export async function requireMembership(): Promise<Membership> {
  const user = await getUser();
  if (!user) redirect("/auth/login?next=/admin/dashboard");

  const membership = await getCurrentMembership();
  if (!membership) redirect("/admin/onboarding");

  return membership;
}

export type PermissionResult =
  | { ok: true; membership: Membership }
  | { ok: false; error: string };

/**
 * Ověří, že přihlášený člen má v dané oblasti plné (zápisové) oprávnění.
 * Pro server akce — vrací membership nebo chybu (ne redirect).
 */
export async function ensurePermission(area: PermArea): Promise<PermissionResult> {
  const membership = await requireMembership();
  if (!can(membership.role, area)) {
    return { ok: false, error: "Na tuto akci nemáš oprávnění." };
  }
  return { ok: true, membership };
}

/** Owner-only guard (billing, smazání útulku, transfer). */
export async function requireOwner(): Promise<Membership> {
  const membership = await requireMembership();
  if (membership.role !== "owner") redirect("/admin/dashboard");
  return membership;
}

/** Je uživatel superadmin (Dan)? Role drží v user_metadata. */
export function isSuperadmin(user: User | null | undefined): boolean {
  return user?.user_metadata?.role === "superadmin";
}

/** Superadmin guard — pro celou /superadmin sekci. */
export async function requireSuperadmin(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/auth/login?next=/superadmin");
  if (!isSuperadmin(user)) redirect("/");
  return user;
}
