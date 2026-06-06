import { type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Zaznamená zobrazení publikovaného článku / příběhu / akce. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/public/content/[id]/view">) {
  const { id } = await ctx.params;
  const service = createServiceClient();

  const { data: item } = await service
    .from("content_items")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!item || (item as { status: string }).status !== "published") {
    return Response.json({ ok: false }, { status: 404 });
  }

  const rpc = service.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
  await rpc("increment_content_view", { _id: id });

  return Response.json({ ok: true });
}
