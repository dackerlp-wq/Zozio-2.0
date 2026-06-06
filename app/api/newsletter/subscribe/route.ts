import { type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import type { NewsletterSegment } from "@/types/database";

export const dynamic = "force-dynamic";

const SEGMENTS: NewsletterSegment[] = ["donor", "adopter", "supporter"];

/** Veřejné přihlášení k newsletteru (GDPR souhlas). */
export async function POST(request: NextRequest) {
  let body: { institutionId?: string; email?: string; segment?: string; consent?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) return Response.json({ error: "Zadej platný e-mail." }, { status: 400 });
  if (!body.institutionId) return Response.json({ error: "Chybí útulek." }, { status: 400 });
  if (!body.consent) return Response.json({ error: "Je potřeba souhlas se zpracováním." }, { status: 400 });

  const segment: NewsletterSegment = SEGMENTS.includes(body.segment as NewsletterSegment)
    ? (body.segment as NewsletterSegment)
    : "supporter";

  const service = createServiceClient();
  const { error } = await service
    .from("newsletter_subscribers")
    .upsert(
      {
        institution_id: body.institutionId,
        email,
        segment,
        consent_at: new Date().toISOString(),
        unsubscribed_at: null,
      },
      { onConflict: "institution_id,email" },
    );
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
