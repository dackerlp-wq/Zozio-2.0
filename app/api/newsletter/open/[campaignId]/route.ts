import { type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// 1×1 průhledný GIF.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

/** Open-tracking pixel — inkrementuje počet otevření kampaně. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/newsletter/open/[campaignId]">) {
  const { campaignId } = await ctx.params;
  const service = createServiceClient();
  // Inkrement otevření (drobná konkurence nevadí).
  const { data } = await service
    .from("newsletter_campaigns")
    .select("opens")
    .eq("id", campaignId)
    .maybeSingle();
  if (data) {
    await service
      .from("newsletter_campaigns")
      .update({ opens: ((data as { opens: number }).opens ?? 0) + 1 })
      .eq("id", campaignId);
  }

  return new Response(PIXEL as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
