import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Profil zvířete se přesunul do záložkového hubu.
export default async function EditAnimalRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/admin/animals/${id}/profil`);
}
