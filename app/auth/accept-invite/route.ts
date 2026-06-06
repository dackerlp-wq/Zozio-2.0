import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { MemberRole } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * Přijetí pozvánky do týmu. Přihlášený uživatel se shodným e-mailem se
 * připojí k útulku (single-institution kontext). Bez přihlášení → login
 * s návratem zpět.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const origin = request.nextUrl.origin;
  if (!token) return NextResponse.redirect(new URL("/admin/dashboard", origin));

  const user = await getUser();
  if (!user) {
    const next = `/auth/accept-invite?token=${token}`;
    return NextResponse.redirect(
      new URL(`/auth/login?next=${encodeURIComponent(next)}`, origin),
    );
  }

  const service = createServiceClient();
  const { data: inv } = await service
    .from("institution_invitations")
    .select("id, institution_id, email, role, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle();

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/admin/dashboard?invite=${reason}`, origin));

  if (!inv) return fail("notfound");
  const invitation = inv as {
    id: string;
    institution_id: string;
    email: string;
    role: MemberRole;
    expires_at: string;
    accepted_at: string | null;
  };

  if (invitation.accepted_at) return fail("used");
  if (new Date(invitation.expires_at).getTime() < Date.now()) return fail("expired");
  if ((user.email ?? "").toLowerCase() !== invitation.email.toLowerCase()) {
    return fail("email");
  }

  // Připoj člena (idempotentně) + označ pozvánku přijatou.
  const { data: existing } = await service
    .from("institution_members")
    .select("user_id")
    .eq("institution_id", invitation.institution_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await service.from("institution_members").insert({
      institution_id: invitation.institution_id,
      user_id: user.id,
      role: invitation.role,
    });
    if (error) return fail("error");
  }

  await service
    .from("institution_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return NextResponse.redirect(new URL("/admin/dashboard?invite=ok", origin));
}
