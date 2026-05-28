import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { AdoptionStatus, Sex } from "@/types/database";

import { ApplicationForm, type Prefill } from "./application-form";

interface AnimalLite {
  id: string;
  name: string;
  sex: Sex;
  primary_photo_url: string | null;
  adoption_status: AdoptionStatus;
  institution: { name: string } | null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("animals")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  return {
    title: data ? `Zájem o adopci — ${data.name} · Zozio` : "Zájem o adopci · Zozio",
    robots: { index: false },
  };
}

export default async function AdoptionInterestPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("animals")
    .select(
      `id, name, sex, primary_photo_url, adoption_status,
       institution:institutions!inner(name, is_published)`,
    )
    .eq("id", id)
    .eq("institutions.is_published", true)
    .maybeSingle();

  const animal = data as unknown as AnimalLite | null;
  if (!animal) notFound();

  // Adoptovaná / nezveřejněná zvířata nelze žádat → zpět na profil
  if (animal.adoption_status !== "available") {
    redirect(`/animals/${id}`);
  }

  const inst = animal.institution;

  // Předvyplnění pro přihlášeného uživatele
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let prefill: Prefill = { name: "", email: user?.email ?? "", phone: "", city: "" };
  if (user) {
    const { data: profile } = await supabase
      .from("applicant_profiles")
      .select("full_name, phone, city")
      .eq("user_id", user.id)
      .maybeSingle();
    prefill = {
      name: profile?.full_name ?? "",
      email: user.email ?? "",
      phone: profile?.phone ?? "",
      city: profile?.city ?? "",
    };
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link
        href={`/animals/${id}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-meadow-700"
      >
        <ChevronLeft className="size-4" /> Zpět na profil
      </Link>

      <div className="mt-6 flex items-center gap-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-2xl bg-cream-warm">
          {animal.primary_photo_url ? (
            <Image
              src={animal.primary_photo_url}
              alt={animal.name}
              width={64}
              height={64}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-2xl">
              🐾
            </div>
          )}
        </div>
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
            Zájem o adopci
          </div>
          <h1 className="font-display text-3xl font-bold leading-tight text-ink-900">
            {animal.name}
          </h1>
          {inst?.name && (
            <p className="text-sm text-ink-600">{inst.name}</p>
          )}
        </div>
      </div>

      <p className="mt-6 text-ink-700">
        Vyplň pár údajů a útulek se ti co nejdřív ozve. Žádné políčko tě k ničemu
        nezavazuje — je to první krok k seznámení.
      </p>

      <div className="mt-8">
        <ApplicationForm
          animalId={animal.id}
          animalName={animal.name}
          prefill={prefill}
        />
      </div>
    </div>
  );
}
