import Image from "next/image";
import Link from "next/link";

import { animalEmoji, type ArticleAnimalCard } from "@/lib/magazine";
import { ADOPTION_STATUS_LABEL } from "@/lib/format";

const STATUS_BADGE: Record<string, string> = {
  available: "bg-meadow-100 text-meadow-700",
  reserved: "bg-sunshine-200 text-sunshine-600",
  adopted: "bg-fern-100 text-fern-700",
};

/** Sekce „Zvířata v článku" (M:N) s aktuálním stavem a volitelným % shody. */
export function ArticleAnimals({ animals }: { animals: ArticleAnimalCard[] }) {
  if (animals.length === 0) return null;

  return (
    <section className="my-7">
      <h2 className="mb-4 font-display text-xl font-bold tracking-tight text-ink-900">
        {animals.length === 1 ? "Zvíře v článku" : "Zvířata v článku"}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {animals.map((a) => {
          const adopted = a.status === "adopted";
          return (
            <div
              key={a.id}
              className="flex items-center gap-3.5 rounded-3xl bg-cream p-3.5 ring-1 ring-ink-900/8"
            >
              <Link
                href={`/animals/${a.id}`}
                className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-cream-warm text-3xl"
              >
                {a.photo ? (
                  <Image src={a.photo} alt={a.name} fill sizes="64px" className="object-cover" />
                ) : (
                  animalEmoji(a.species)
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/animals/${a.id}`} className="font-display text-base font-bold text-ink-900 hover:text-terracotta-600">
                    {a.name}
                  </Link>
                  <span
                    className={`rounded-pill px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[a.status] ?? "bg-cream-warm text-ink-500"}`}
                  >
                    {adopted ? "Adoptováno 🎉" : ADOPTION_STATUS_LABEL[a.status]}
                  </span>
                  {a.matchScore != null && (
                    <span className="rounded-pill bg-peach-200 px-2 py-0.5 text-[10px] font-bold text-terracotta-600">
                      {a.matchScore}% shoda
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[13px] font-semibold text-ink-500">
                  {[a.breed, a.ageLabel].filter(Boolean).join(" · ")}
                </div>
              </div>
              {a.status === "available" && (
                <Link
                  href={`/animals/${a.id}/zajem`}
                  className="shrink-0 rounded-pill bg-terracotta-500 px-3.5 py-2 text-[13px] font-bold text-cream transition hover:bg-terracotta-600"
                >
                  Adoptovat
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
