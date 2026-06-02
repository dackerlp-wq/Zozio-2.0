import { NextResponse, type NextRequest } from "next/server";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export interface AdminSearchResult {
  id: string;
  name: string;
  record_number: string | null;
  species: string;
  adoption_status: string;
  primary_photo_url: string | null;
}

/** Globální admin hledání: zvířata dle jména a evidenčního čísla (jen instituce). */
export async function GET(request: NextRequest) {
  const { institutionId } = await requireMembership();
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const supabase = await createClient();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const { data } = await supabase
    .from("animals")
    .select("id, name, record_number, species, adoption_status, primary_photo_url")
    .eq("institution_id", institutionId)
    .or(`name.ilike.${like},record_number.ilike.${like}`)
    .order("name", { ascending: true })
    .limit(8);

  return NextResponse.json({ results: (data ?? []) as AdminSearchResult[] });
}
