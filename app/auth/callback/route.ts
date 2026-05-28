import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Pro OAuth registrace (Google) přijde role jako ?role=visitor. Supabase u
 * OAuth nedovolí nastavit user_metadata předem, takže ji doplníme tady —
 * jen když uživatel ještě žádnou roli nemá (nepřepisujeme existující).
 */
async function applyOAuthRole(user: User | null | undefined, role: string | null) {
  if (!user || role !== "visitor") return;
  if (user.user_metadata?.role) return;
  const service = createServiceClient();
  await service.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, role },
  });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const role = url.searchParams.get("role");
  const next = url.searchParams.get("next") ?? "/";
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    const redirectUrl = new URL("/auth/login", request.url);
    redirectUrl.searchParams.set("error", errorDescription ?? error);
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createClient();

  // PKCE flow (OAuth, ?code=)
  if (code) {
    const { data, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      const redirectUrl = new URL("/auth/login", request.url);
      redirectUrl.searchParams.set("error", exchangeError.message);
      return NextResponse.redirect(redirectUrl);
    }
    await applyOAuthRole(data.user, role);
    return NextResponse.redirect(new URL(next, request.url));
  }

  // OTP flow — potvrzení e-mailu, magic-link, recovery (?token_hash=&type=)
  if (tokenHash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (verifyError) {
      const redirectUrl = new URL("/auth/login", request.url);
      redirectUrl.searchParams.set("error", verifyError.message);
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  const redirectUrl = new URL("/auth/login", request.url);
  redirectUrl.searchParams.set("error", "Chybí autentizační kód.");
  return NextResponse.redirect(redirectUrl);
}
