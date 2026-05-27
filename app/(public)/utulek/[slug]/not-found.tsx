import Link from "next/link";

import { ZozioButton } from "@/components/zozio/button";

export default function ShelterNotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <div className="text-6xl">🏡</div>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-ink-900 md:text-5xl">
        Tento útulek jsme nenašli
      </h1>
      <p className="mt-3 text-lg text-ink-600">
        Možná byl odebrán nebo odkaz není správný. Mrkni na všechny útulky v
        síti.
      </p>
      <ZozioButton asChild variant="meadow" size="lg" className="mt-8">
        <Link href="/utulky">Všechny útulky</Link>
      </ZozioButton>
    </div>
  );
}
