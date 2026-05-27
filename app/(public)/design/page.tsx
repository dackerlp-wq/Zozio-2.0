import { Bell, Heart, PawPrint, Search, Sparkles } from "lucide-react";

import { AnimalCard, type AnimalCardData } from "@/components/zozio/animal-card";
import { ZozioBadge } from "@/components/zozio/badge";
import { ZozioButton } from "@/components/zozio/button";
import { PawLoader } from "@/components/zozio/paw-loader";

export const metadata = {
  title: "Zozio Design System — Look Book",
};

const sampleAnimals: AnimalCardData[] = [
  {
    id: "bobik",
    name: "Bobík",
    species: "dog",
    breed: "Kříženec retrievera",
    ageLabel: "3 roky",
    city: "Brno",
    shelterName: "Útulek Hostivař",
    photoUrl:
      "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800&q=80",
    status: "available",
    tags: ["Vhodný k dětem", "Aktivní", "Kastrovaný"],
  },
  {
    id: "luna",
    name: "Luna",
    species: "cat",
    breed: "Britská krátkosrstá",
    ageLabel: "2 roky",
    city: "Praha",
    shelterName: "Kočičí útulek Lvíček",
    photoUrl:
      "https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=800&q=80",
    status: "available",
    isUrgent: true,
    tags: ["Tichá", "Mazlivá"],
  },
  {
    id: "rocky",
    name: "Rocky",
    species: "dog",
    breed: "Stafordšírský bulteriér",
    ageLabel: "6 let",
    city: "Ostrava",
    shelterName: "Pes v nouzi",
    photoUrl:
      "https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=800&q=80",
    status: "available",
    isLongStay: true,
    tags: ["Klidný", "Jen do bytu"],
  },
  {
    id: "miska",
    name: "Miška",
    species: "cat",
    breed: "Evropská",
    ageLabel: "5 měsíců",
    city: "Plzeň",
    shelterName: "Útulek U koťat",
    photoUrl:
      "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800&q=80",
    status: "reserved",
    tags: ["Hravá"],
  },
];

const palette = [
  { name: "meadow-500", hex: "#52B788", role: "Primární, CTA" },
  { name: "meadow-700", hex: "#2D7A57", role: "Hover, dark" },
  { name: "sunshine-400", hex: "#FFC857", role: "Akcenty, stars" },
  { name: "peach-300", hex: "#FFB5A7", role: "Warmth, soft urgent" },
  { name: "sage-500", hex: "#5C8A6F", role: "B2B admin" },
  { name: "terracotta-500", hex: "#C97B5A", role: "Urgent, long-stay" },
  { name: "cream", hex: "#FFFDF7", role: "Hlavní pozadí" },
  { name: "cream-warm", hex: "#FAF5EB", role: "Sekce, karty" },
  { name: "ink-900", hex: "#1A2B25", role: "Headings" },
  { name: "ink-600", hex: "#4F5D55", role: "Body text" },
  { name: "berry", hex: "#D62246", role: "Errors only" },
];

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-background pb-32">
      {/* Hero */}
      <section className="border-b border-ink-900/8 bg-cream-warm">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex items-center gap-2 text-sm font-semibold text-meadow-700">
            <Sparkles className="size-4" />
            <span>Zozio Design System v0.1</span>
          </div>
          <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight text-ink-900 md:text-7xl">
            Adopce, která tě{" "}
            <span className="italic text-meadow-700">chytne</span> za srdce.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-600">
            Look book Zozio značky — paleta, typografie, komponenty a
            mikro-interakce. Hybrid Duolingo (B2C) + Linear (B2B admin).
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ZozioButton variant="meadow" size="lg">
              <PawPrint /> Začít hledat
            </ZozioButton>
            <ZozioButton variant="outline" size="lg">
              Procházet všechny
            </ZozioButton>
          </div>
        </div>
      </section>

      {/* Paleta */}
      <Section title="Paleta" eyebrow="Tokens">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {palette.map((c) => (
            <div
              key={c.name}
              className="overflow-hidden rounded-2xl ring-1 ring-ink-900/8"
            >
              <div
                className="h-24 w-full"
                style={{ backgroundColor: c.hex }}
              />
              <div className="space-y-1 p-4">
                <div className="font-mono text-sm font-semibold text-ink-900">
                  {c.name}
                </div>
                <div className="font-mono text-xs text-ink-400">{c.hex}</div>
                <div className="text-xs text-ink-600">{c.role}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Typografie */}
      <Section title="Typografie" eyebrow="Fonty">
        <div className="space-y-8">
          <div>
            <div className="mb-2 font-mono text-xs uppercase tracking-wider text-ink-400">
              Display — Fraunces 700 / 72px
            </div>
            <p className="font-display text-7xl font-bold leading-[0.95] tracking-tight text-ink-900">
              Najdi parťáka na celý život.
            </p>
          </div>
          <div>
            <div className="mb-2 font-mono text-xs uppercase tracking-wider text-ink-400">
              Display italic — Fraunces 600 italic / 48px
            </div>
            <p className="font-display text-5xl font-semibold italic text-meadow-700">
              Útulek, kam se každý vrátí rád.
            </p>
          </div>
          <div>
            <div className="mb-2 font-mono text-xs uppercase tracking-wider text-ink-400">
              Body — Inter 400 / 18px
            </div>
            <p className="max-w-2xl text-lg text-ink-700">
              V útulku Hostivař na něj čeká 847 zvířat. Mezi nimi je jistě i to
              tvoje. Procházej jejich příběhy a najdi parťáka, který se ti
              hodí do života. Adopce není smutná. Je to nejhezčí začátek.
            </p>
          </div>
          <div>
            <div className="mb-2 font-mono text-xs uppercase tracking-wider text-ink-400">
              UI — Inter 600 / 14px
            </div>
            <p className="text-sm font-semibold text-ink-900">
              Bobík · 3 roky · Brno · Vhodný k dětem
            </p>
          </div>
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Tlačítka" eyebrow="ZozioButton">
        <div className="space-y-8">
          <Row label="Velikosti (meadow varianta)">
            <ZozioButton size="sm">Small</ZozioButton>
            <ZozioButton size="md">Medium</ZozioButton>
            <ZozioButton size="lg">Large</ZozioButton>
            <ZozioButton size="xl">Extra Large</ZozioButton>
          </Row>
          <Row label="Varianty">
            <ZozioButton variant="meadow">
              <PawPrint /> Meadow (primární)
            </ZozioButton>
            <ZozioButton variant="sunshine">
              <Sparkles /> Sunshine
            </ZozioButton>
            <ZozioButton variant="outline">Outline</ZozioButton>
            <ZozioButton variant="ghost">Ghost</ZozioButton>
            <ZozioButton variant="sage">Sage (B2B)</ZozioButton>
          </Row>
          <Row label="S ikonami">
            <ZozioButton size="lg">
              <Search /> Hledat zvíře
            </ZozioButton>
            <ZozioButton size="lg" variant="sunshine">
              <Heart /> Přidat oblíbené
            </ZozioButton>
            <ZozioButton size="icon" variant="outline" aria-label="Notifikace">
              <Bell />
            </ZozioButton>
          </Row>
          <p className="text-sm text-ink-600">
            ✨ Tlačítka mají Duolingo-style 3D dolní stín. Klikni a sleduj jak
            se „zmáčknou" (translate-y).
          </p>
        </div>
      </Section>

      {/* Badges */}
      <Section title="Badges" eyebrow="ZozioBadge">
        <div className="space-y-6">
          <Row label="Status zvířete">
            <ZozioBadge variant="available">K adopci</ZozioBadge>
            <ZozioBadge variant="reserved">Rezervováno</ZozioBadge>
            <ZozioBadge variant="adopted">Adoptováno</ZozioBadge>
            <ZozioBadge variant="urgent">Naléhá</ZozioBadge>
            <ZozioBadge variant="longStay">Dlouho čeká</ZozioBadge>
          </Row>
          <Row label="Obecné">
            <ZozioBadge variant="soft">Vhodný k dětem</ZozioBadge>
            <ZozioBadge variant="outline">Kastrovaný</ZozioBadge>
            <ZozioBadge variant="soft" size="sm">
              Aktivní
            </ZozioBadge>
            <ZozioBadge variant="soft" size="lg">
              Vyžaduje zkušenost
            </ZozioBadge>
          </Row>
        </div>
      </Section>

      {/* Animal cards */}
      <Section title="Karty zvířat" eyebrow="AnimalCard — flagship komponenta">
        <p className="mb-6 max-w-2xl text-sm text-ink-600">
          ✨ Najed myší na kartu — uvidíš jemný tilt + lift. Klikni na srdce —
          tepe.
        </p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {sampleAnimals.map((a) => (
            <AnimalCard key={a.id} animal={a} />
          ))}
        </div>
      </Section>

      {/* Loader */}
      <Section title="Loader" eyebrow="PawLoader">
        <div className="flex items-center justify-center rounded-3xl bg-cream-warm p-16">
          <PawLoader label="Hledáme zvířátka…" />
        </div>
      </Section>

      {/* Bento stats */}
      <Section title="Bento Statistiky" eyebrow="BentoStats (preview)">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <BentoStat value="847" label="zvířat čeká" tone="meadow" />
          <BentoStat value="124" label="útulků v síti" tone="sage" />
          <BentoStat value="12 384" label="dokončených adopcí" tone="sunshine" />
          <BentoStat value="98 %" label="spokojených adoptantů" tone="peach" />
        </div>
      </Section>
    </main>
  );
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-ink-900/8">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-8">
          <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
            {eyebrow}
          </div>
          <h2 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink-900">
            {title}
          </h2>
        </div>
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-400">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function BentoStat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "meadow" | "sage" | "sunshine" | "peach";
}) {
  const tones = {
    meadow: "bg-meadow-100 text-meadow-700",
    sage: "bg-sage-100 text-sage-700",
    sunshine: "bg-sunshine-200 text-sunshine-600",
    peach: "bg-peach-200 text-terracotta-600",
  } as const;
  return (
    <div className={`rounded-3xl p-8 ${tones[tone]}`}>
      <div className="font-display text-5xl font-bold leading-none tracking-tight">
        {value}
      </div>
      <div className="mt-3 text-sm font-semibold text-ink-700">{label}</div>
    </div>
  );
}
