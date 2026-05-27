import Link from "next/link";

import { ZozioButton } from "@/components/zozio/button";

export default function AnimalNotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <div className="text-6xl">🐾</div>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-ink-900 md:text-5xl">
        Tohle zvířátko jsme nenašli
      </h1>
      <p className="mt-3 text-lg text-ink-600">
        Možná už našlo nový domov — nebo odkaz není platný. Mrkni do katalogu na
        ostatní hledající.
      </p>
      <ZozioButton asChild variant="meadow" size="lg" className="mt-8">
        <Link href="/adopt">Procházet katalog</Link>
      </ZozioButton>
    </div>
  );
}
