import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
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

/**
 * Kam uživatele po ověření poslat. Odvozeno z metadat, aby flow fungoval i
 * když se ztratí `next` parametr (Supabase ho při potvrzení e-mailu někdy
 * zahodí). Recovery (reset hesla) si vždy nechá svůj `next`.
 */
function destinationFor(
  user: User | null | undefined,
  next: string,
  type: EmailOtpType | null,
): string {
  if (type === "recovery") return next;

  const role = user?.user_metadata?.role as string | undefined;
  if (role === "visitor") return "/profil";
  if (role === "superadmin") return "/superadmin";
  if (role && ["owner", "admin", "staff"].includes(role)) {
    return "/admin/dashboard";
  }

  // Bez role → registrant útulku (intended_role: owner) jde na wizard.
  if (user?.user_metadata?.intended_role === "owner") {
    return "/admin/onboarding";
  }

  return next;
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

  // Session cookies posbíráme, ať je můžeme připnout na finální redirect
  // (cíl známe až po ověření uživatele).
  const cookieJar: { name: string; value: string; options: CookieOptions }[] =
    [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookieJar.push(...cookiesToSet);
        },
      },
    },
  );

  const redirectTo = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url));
    cookieJar.forEach(({ name, value, options }) =>
      res.cookies.set(name, value, options),
    );
    return res;
  };

  // PKCE flow (OAuth, ?code=)
  if (code) {
    const { data, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return loginWithError(exchangeError.message);
    }
    await applyOAuthRole(data.user, role);
    return redirectTo(destinationFor(data.user, next, null));
  }

  // OTP flow — potvrzení e-mailu, magic-link, recovery (?token_hash=&type=)
  if (tokenHash && type) {
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (verifyError) {
      return loginWithError(verifyError.message);
    }
    return redirectTo(destinationFor(data.user, next, type));
  }

  return loginWithError("Chybí autentizační kód.");
}
