import { requireSuperadmin } from "@/lib/auth";

import { SuperadminSidebar } from "./_components/sidebar";

export const metadata = { title: "Superadmin — Zozio" };

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperadmin();

  return (
    <div className="flex min-h-screen bg-sage-50">
      <SuperadminSidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
