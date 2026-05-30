import Link from "next/link";
import {
  Plus,
  PawPrint,
  Inbox,
  Eye,
  AlertTriangle,
  Clock,
  XCircle,
  PauseCircle,
  CheckSquare,
} from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import { requireMembership } from "@/lib/auth";
import { ANIMAL_TASK_TYPE_LABEL } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { AnimalTaskType } from "@/types/database";

export const metadata = { title: "Přehled — Zozio Admin" };

interface DashboardTask {
  id: string;
  title: string;
  type: AnimalTaskType;
  due_date: string | null;
  animal_id: string | null;
  animals: { name: string } | null;
}

function dueLabel(due: string | null, todayStr: string): {
  text: string;
  cls: string;
} {
  if (!due) return { text: "Bez termínu", cls: "text-ink-400" };
  if (due < todayStr) return { text: "Po termínu", cls: "text-terracotta-600" };
  if (due === todayStr) return { text: "Dnes", cls: "text-sunshine-600" };
  return {
    text: new Date(due).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "numeric",
    }),
    cls: "text-sage-700",
  };
}

export default async function DashboardPage() {
  const { institutionId, institution } = await requireMembership();
  const supabase = await createClient();

  const todayStr = new Date().toISOString().slice(0, 10);

  const [animalsTotal, animalsAvailable, applicationsNew, openTasks] =
    await Promise.all([
      supabase
        .from("animals")
        .select("*", { count: "exact", head: true })
        .eq("institution_id", institutionId),
      supabase
        .from("animals")
        .select("*", { count: "exact", head: true })
        .eq("institution_id", institutionId)
        .eq("adoption_status", "available"),
      supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("institution_id", institutionId)
        .eq("status", "new"),
      supabase
        .from("animal_tasks")
        .select("id, title, type, due_date, animal_id, animals(name)")
        .eq("institution_id", institutionId)
        .eq("status", "open")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(500),
    ]);

  const tasks = (openTasks.data ?? []) as unknown as DashboardTask[];
  const openTasksCount = tasks.length;
  const overdueCount = tasks.filter(
    (t) => t.due_date && t.due_date < todayStr,
  ).length;
  // Nejnaléhavější: po termínu a dnešní nahoru, pak nejbližší termín.
  const urgentTasks = tasks
    .filter((t) => t.due_date && t.due_date <= todayStr)
    .slice(0, 5);

  const stats = [
    {
      label: "Zvířat celkem",
      value: animalsTotal.count ?? 0,
      icon: PawPrint,
      href: "/admin/animals",
      alert: false,
    },
    {
      label: "Zveřejněno",
      value: animalsAvailable.count ?? 0,
      icon: Eye,
      href: "/admin/animals?status=available",
      alert: false,
    },
    {
      label: "Nové žádosti",
      value: applicationsNew.count ?? 0,
      icon: Inbox,
      href: "/admin/applications",
      alert: false,
    },
    {
      label:
        overdueCount > 0 ? `Úkoly · ${overdueCount} po termínu` : "Aktivní úkoly",
      value: openTasksCount,
      icon: CheckSquare,
      href: "/admin/tasks",
      alert: overdueCount > 0,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            Vítej zpátky 👋
          </h2>
          <p className="mt-1 text-ink-600">
            Přehled tvého útulku {institution.name}.
          </p>
        </div>
        <ZozioButton asChild variant="meadow" size="md">
          <Link href="/admin/animals/new">
            <Plus /> Přidat zvíře
          </Link>
        </ZozioButton>
      </div>

      {/* Verification / publish banner */}
      {institution.verification_status === "pending" && (
        <div className="flex items-start gap-3 rounded-3xl bg-sunshine-200 p-5 text-sm ring-1 ring-inset ring-sunshine-400/40">
          <Clock className="size-5 shrink-0 text-sunshine-600" />
          <div>
            <p className="font-semibold text-ink-900">Útulek čeká na ověření</p>
            <p className="mt-0.5 text-ink-700">
              Tvůj útulek prošel registrací a teď ho zkontrolujeme. Mezitím můžeš
              přidávat zvířata a upravovat profil — veřejně se útulek zobrazí až
              po schválení.
            </p>
          </div>
        </div>
      )}

      {institution.verification_status === "rejected" && (
        <div className="flex items-start gap-3 rounded-3xl bg-berry/10 p-5 text-sm ring-1 ring-inset ring-berry/30">
          <XCircle className="size-5 shrink-0 text-berry" />
          <div>
            <p className="font-semibold text-ink-900">Ověření zamítnuto</p>
            <p className="mt-0.5 text-ink-700">
              {institution.rejection_reason
                ? institution.rejection_reason
                : "Útulek se nepodařilo ověřit. Uprav prosím profil v nastavení a ozvi se nám na ahoj@zozio.cz."}
            </p>
          </div>
        </div>
      )}

      {institution.verification_status === "suspended" && (
        <div className="flex items-start gap-3 rounded-3xl bg-peach-100 p-5 text-sm ring-1 ring-inset ring-peach-300/60">
          <PauseCircle className="size-5 shrink-0 text-terracotta-600" />
          <div>
            <p className="font-semibold text-ink-900">Útulek je pozastaven</p>
            <p className="mt-0.5 text-ink-700">
              {institution.suspension_reason
                ? institution.suspension_reason
                : "Profil útulku jsme dočasně pozastavili a veřejně se nezobrazuje. Ozvi se nám na ahoj@zozio.cz."}
            </p>
          </div>
        </div>
      )}

      {institution.verification_status === "approved" &&
        !institution.is_published && (
          <div className="flex items-start gap-3 rounded-3xl bg-sunshine-200 p-5 text-sm ring-1 ring-inset ring-sunshine-400/40">
            <AlertTriangle className="size-5 shrink-0 text-sunshine-600" />
            <div>
              <p className="font-semibold text-ink-900">
                Útulek je ověřený, ale ještě skrytý
              </p>
              <p className="mt-0.5 text-ink-700">
                Přidej alespoň jedno zvíře a zveřejni útulek v nastavení, aby tě
                adoptanti našli na zozio.cz.
              </p>
            </div>
          </div>
        )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="group rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8 transition hover:-translate-y-0.5 hover:shadow-soft-md"
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex size-10 items-center justify-center rounded-2xl",
                    s.alert
                      ? "bg-peach-200 text-terracotta-600"
                      : "bg-sage-100 text-sage-700",
                  )}
                >
                  <Icon className="size-5" />
                </span>
              </div>
              <div className="mt-4 font-display text-4xl font-bold tracking-tight text-ink-900">
                {s.value}
              </div>
              <div
                className={cn(
                  "mt-1 text-sm font-semibold",
                  s.alert ? "text-terracotta-600" : "text-ink-600",
                )}
              >
                {s.label}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Naléhavé úkoly */}
      {urgentTasks.length > 0 && (
        <div className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-bold text-ink-900">
              Co je potřeba dnes
            </h3>
            <Link
              href="/admin/tasks"
              className="text-sm font-semibold text-meadow-600 hover:text-meadow-700"
            >
              Všechny úkoly →
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {urgentTasks.map((t) => {
              const due = dueLabel(t.due_date, todayStr);
              return (
                <li key={t.id}>
                  <Link
                    href={
                      t.animal_id
                        ? `/admin/animals/${t.animal_id}/ukoly`
                        : "/admin/tasks"
                    }
                    className="flex items-center justify-between gap-3 rounded-2xl bg-cream-warm px-4 py-3 ring-1 ring-ink-900/5 transition hover:ring-ink-900/15"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-ink-900">
                        {t.title}
                      </span>
                      <span className="ml-2 text-xs text-ink-500">
                        {ANIMAL_TASK_TYPE_LABEL[t.type]}
                        {t.animals?.name ? ` · ${t.animals.name}` : ""}
                      </span>
                    </div>
                    <span
                      className={cn("shrink-0 text-sm font-semibold", due.cls)}
                    >
                      {due.text}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Quick actions */}
      <div className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h3 className="font-display text-xl font-bold text-ink-900">
          Rychlé akce
        </h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <ZozioButton asChild variant="outline" size="md">
            <Link href="/admin/animals/new">Přidat zvíře</Link>
          </ZozioButton>
          <ZozioButton asChild variant="outline" size="md">
            <Link href="/admin/animals">Spravovat zvířata</Link>
          </ZozioButton>
          <ZozioButton asChild variant="outline" size="md">
            <Link href="/admin/settings">Upravit profil útulku</Link>
          </ZozioButton>
        </div>
      </div>
    </div>
  );
}
