import { requireMembership } from "@/lib/auth";

import { AdminSidebar } from "./_components/sidebar";
import { AdminHeader } from "./_components/header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await requireMembership();

  return (
    <div className="flex min-h-screen bg-sage-50">
      <AdminSidebar role={membership.role} />
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
