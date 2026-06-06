import { type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Odhlášení odběru newsletteru (z e-mailu). */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    const service = createServiceClient();
    await service
      .from("newsletter_subscribers")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("id", id);
  }
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Odhlášeno</title><body style="font-family:sans-serif;text-align:center;padding:48px;color:#2C1810;background:#FFFCF8"><h1 style="color:#E8634A">zozio.</h1><p>Odběr novinek byl zrušen. Mrzí nás to — kdykoli se můžeš přihlásit znovu.</p></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
