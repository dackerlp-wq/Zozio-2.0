import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType, User } from "@supabase/supabase-js";

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

  const loginWithError = (message: string) => {
    const redirectUrl = new URL("/auth/login", request.url);
    redirectUrl.searchParams.set("error", message);
    return NextResponse.redirect(redirectUrl);
  };

  if (error) {
    return loginWithError(errorDescription ?? error);
  }

  // Odpověď vytvoříme předem, aby na ni Supabase mohl připnout session cookies.
  // Ručně vytvořený NextResponse.redirect jinak cookies ze server klienta
  // nepřevezme a session by se neuložila.
  const response = NextResponse.redirect(new URL(next, request.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // PKCE flow (OAuth, ?code=)
  if (code) {
    const { data, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return loginWithError(exchangeError.message);
    }
    await applyOAuthRole(data.user, role);
    return response;
  }

  // OTP flow — potvrzení e-mailu, magic-link, recovery (?token_hash=&type=)
  if (tokenHash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (verifyError) {
      return loginWithError(verifyError.message);
    }
    return response;
  }

  return loginWithError("Chybí autentizační kód.");
}
