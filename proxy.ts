import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

const PUBLIC_PREFIXES = ["/auth", "/api/widget", "/api/public"];
const ADMIN_PREFIXES = ["/admin"];
const OWNER_PREFIXES = ["/admin/billing", "/admin/settings/danger"];
const VISITOR_PREFIXES = ["/profil"];

type Role = "owner" | "admin" | "staff" | "visitor" | "public";

function matchesAny(path: string, prefixes: string[]) {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  // Pass pathname to Server Components (for active nav state, etc.)
  response.headers.set("x-pathname", path);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          response.headers.set("x-pathname", path);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role: Role = (user?.user_metadata?.role as Role) ?? "public";

  // Always-public paths
  if (matchesAny(path, PUBLIC_PREFIXES)) {
    // Already logged-in user landing on auth pages → redirect to their home
    if (user && (path === "/auth/login" || path === "/auth/register")) {
      const next = request.nextUrl.searchParams.get("next");
      if (next) return NextResponse.redirect(new URL(next, request.url));
      return NextResponse.redirect(
        new URL(role === "visitor" ? "/profil" : "/admin/dashboard", request.url),
      );
    }
    return response;
  }

  // Visitor area
  if (matchesAny(path, VISITOR_PREFIXES)) {
    if (!user) return redirectToLogin(request, path);
    return response;
  }

  // Admin area
  if (matchesAny(path, ADMIN_PREFIXES)) {
    if (!user) return redirectToLogin(request, path);

    // Owner-only paths
    if (matchesAny(path, OWNER_PREFIXES) && role !== "owner") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }

    // Admin area allows: owner, admin, staff
    if (!["owner", "admin", "staff"].includes(role)) {
      return NextResponse.redirect(new URL("/profil", request.url));
    }
    return response;
  }

  return response;
}

function redirectToLogin(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  url.searchParams.set("next", path);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Run on everything except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)$).*)",
  ],
};
