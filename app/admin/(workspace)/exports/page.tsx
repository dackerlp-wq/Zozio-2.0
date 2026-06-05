import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  ExportColumnTemplateRow,
  ExportLogRow,
  InstitutionRow,
} from "@/types/database";

import { ExportsPanel, type PersonOption } from "./exports-panel";

export const metadata = { title: "Evidence & exporty — Zozio Admin" };

export default async function ExportsAdminPage() {
  const { institutionId, role } = await requireMembership();
  const supabase = await createClient();

  const [
    { data: instData },
    { data: logData },
    { data: tplData },
    { data: animalRows },
    { data: carerRows },
    { data: appRows },
  ] = await Promise.all([
    supabase
      .from("institutions")
      .select("plan, export_kvs_monthly, export_accounting_monthly")
      .eq("id", institutionId)
      .maybeSingle(),
    supabase
      .from("export_log")
      .select("*")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("export_column_templates")
      .select("*")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false }),
    supabase
      .from("animals")
      .select("id, name, record_number")
      .eq("institution_id", institutionId)
      .order("name", { ascending: true }),
    supabase
      .from("foster_carers")
      .select("id, name")
      .eq("institution_id", institutionId)
      .order("name", { ascending: true }),
    supabase
      .from("applications")
      .select("applicant_name, applicant_email")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false }),
  ]);

  const inst = instData as Pick<
    InstitutionRow,
    "plan" | "export_kvs_monthly" | "export_accounting_monthly"
  > | null;

  const animals = (animalRows ?? []) as {
    id: string;
    name: string;
    record_number: string | null;
  }[];

  // Osoby pro GDPR: pěstouni + jedineční žadatelé (dle e-mailu).
  const persons: PersonOption[] = [];
  for (const c of (carerRows ?? []) as { id: string; name: string }[]) {
    persons.push({ kind: "foster", id: c.id, label: `${c.name} (pěstoun)` });
  }
  const seen = new Set<string>();
  for (const a of (appRows ?? []) as {
    applicant_name: string;
    applicant_email: string;
  }[]) {
    if (!a.applicant_email || seen.has(a.applicant_email)) continue;
    seen.add(a.applicant_email);
    persons.push({
      kind: "applicant",
      id: a.applicant_email,
      label: `${a.applicant_name} (žadatel)`,
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <ExportsPanel
        plan={inst?.plan ?? "free"}
        canManage={role === "owner" || role === "admin"}
        kvsMonthly={inst?.export_kvs_monthly ?? false}
        accountingMonthly={inst?.export_accounting_monthly ?? false}
        log={(logData ?? []) as ExportLogRow[]}
        templates={(tplData ?? []) as ExportColumnTemplateRow[]}
        animals={animals}
        persons={persons}
      />
    </div>
  );
}
