import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";

import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Generuje QR kód pro veřejný profil zvířete (SVG).
 *   GET /api/qr/<animal-id>?size=512
 *
 * Příklad použití:
 *   <img src="/api/qr/abc-123" alt="QR Bobík" />
 *   Tisk: /api/qr/abc-123?size=1024 → vytiskni do A4
 */
export async function GET(request: NextRequest, ctx: RouteParams) {
  const { id } = await ctx.params;
  const size = Math.min(
    2048,
    Math.max(128, parseInt(request.nextUrl.searchParams.get("size") ?? "512", 10) || 512),
  );

  // Ověř že zvíře existuje a je publishable (nepublikované nepošleme veřejně)
  const supabase = await createClient();
  const { data } = await supabase
    .from("animals")
    .select("id, institution:institutions!inner(is_published)")
    .eq("id", id)
    .eq("institutions.is_published", true)
    .maybeSingle();

  if (!data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const origin = request.nextUrl.origin;
  const target = `${origin}/animals/${id}?ref=qr`;

  const svg = await QRCode.toString(target, {
    type: "svg",
    width: size,
    margin: 2,
    color: {
      dark: "#1A2B25", // ink-900
      light: "#FFFDF7", // cream
    },
    errorCorrectionLevel: "M",
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
