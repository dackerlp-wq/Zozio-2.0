import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { AdminSidebar } from "./_components/sidebar";
import { AdminHeader } from "./_components/header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await requireMembership();
  const supabase = await createClient();
  const institutionId = membership.institutionId;
  const todayStr = new Date().toISOString().slice(0, 10);

  const [{ data: instCfg }, { count: newApplications }, { data: openTasks }] =
    await Promise.all([
      supabase
        .from("institutions")
        .select("housing_mode, foster_enabled")
        .eq("id", institutionId)
        .maybeSingle(),
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("institution_id", institutionId)
        .eq("status", "new"),
      supabase
        .from("animal_tasks")
        .select("due_date, snoozed_until")
        .eq("institution_id", institutionId)
        .eq("status", "open")
        .not("due_date", "is", null)
        .lte("due_date", todayStr),
    ]);

  const cfg = instCfg as
    | { housing_mode: "physical" | "foster_network" | "hybrid" | null; foster_enabled: boolean | null }
    | null;
  const tasks = (openTasks ?? []) as { due_date: string; snoozed_until: string | null }[];
  const active = tasks.filter((t) => !t.snoozed_until || t.snoozed_until <= todayStr);
  const overdueTasks = active.filter((t) => t.due_date < todayStr).length;
  const todayTasks = active.filter((t) => t.due_date === todayStr).length;

  return (
    <div
      className="flex min-h-screen bg-cream"
      style={{
        backgroundImage:
          "radial-gradient(circle at 12% -10%, #FDEAE6 0, transparent 38%), radial-gradient(circle at 95% 0, #FEF3D6 0, transparent 34%)",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <AdminSidebar
        role={membership.role}
        institutionName={membership.institution.name}
        housingMode={cfg?.housing_mode ?? "physical"}
        fosterEnabled={cfg?.foster_enabled ?? true}
        userEmail={membership.user.email ?? ""}
        badges={{
          applications: newApplications ?? 0,
          tasksOverdue: overdueTasks,
          tasksToday: todayTasks,
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader
          institutionName={membership.institution.name}
          institutionSlug={membership.institution.slug}
          isPublished={membership.institution.is_published}
          role={membership.role}
          userEmail={membership.user.email ?? ""}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
