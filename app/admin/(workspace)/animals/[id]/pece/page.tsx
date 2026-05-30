import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { CareLogEntryRow } from "@/types/database";

import { CareLog, type CareLogItem } from "../care-log";

export const metadata = { title: "Péče — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnimalCarePage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data: owned } = await supabase
    .from("animals")
    .select("id")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!owned) notFound();

  const { data } = await supabase
    .from("care_log_entries")
    .select("*")
    .eq("animal_id", id)
    .order("logged_at", { ascending: false })
    .limit(200);

  const entries = (data ?? []) as CareLogEntryRow[];

  // Dořeš jména autorů (auth.users přes service klienta).
  const authorIds = [
    ...new Set(entries.map((e) => e.logged_by).filter(Boolean)),
  ] as string[];
  const authorNames = new Map<string, string>();
  if (authorIds.length > 0) {
    const service = createServiceClient();
    await Promise.all(
      authorIds.map(async (uid) => {
        const { data: u } = await service.auth.admin.getUserById(uid);
        const name =
          (u?.user?.user_metadata?.full_name as string | undefined) ||
          (u?.user?.user_metadata?.name as string | undefined) ||
          u?.user?.email ||
          null;
        if (name) authorNames.set(uid, name);
      }),
    );
  }

  const items: CareLogItem[] = entries.map((e) => ({
    ...e,
    author: e.logged_by ? (authorNames.get(e.logged_by) ?? null) : null,
  }));

  return <CareLog animalId={id} items={items} />;
}
