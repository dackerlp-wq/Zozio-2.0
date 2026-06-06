import { type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Zaznamená zobrazení veřejného profilu zvířete (denní počítadlo). */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/public/animals/[id]/view">) {
  const { id } = await ctx.params;
  const service = createServiceClient();

  const { data: animal } = await service
    .from("animals")
    .select("institution_id")
    .eq("id", id)
    .maybeSingle();
  if (!animal) return Response.json({ ok: false }, { status: 404 });

  const rpc = service.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
  await rpc("increment_profile_view", {
    _animal_id: id,
    _institution_id: (animal as { institution_id: string }).institution_id,
  });

  return Response.json({ ok: true });
}
