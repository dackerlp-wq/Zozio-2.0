import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Home, PawPrint, Search, Sparkles } from "lucide-react";

import { AnimalCard } from "@/components/zozio/animal-card";
import { ZozioButton } from "@/components/zozio/button";
import { loadHomeData } from "@/lib/home";

import { NewsletterForm } from "./newsletter-form";

export const revalidate = 120;

export const metadata = {
  title: "Zozio — najdi parťáka na celý život",
  description:
    "Adopce, která tě chytne za srdce. A za tlapku. Zvířata z útulků v ČR a SK čekají na nový domov. Procházej, ulož si oblíbená a pošli žádost o adopci.",
  openGraph: {
    title: "Zozio — najdi parťáka na celý život",
    description:
      "Zvířata z útulků v ČR a SK čekají na nový domov. Adoptuj, podpoř útulek nebo si přečti magazín.",
    type: "website",
  },
};

export default async function HomePage() {
  const { stats, animals, magazine } = await loadHomeData();

  const quick = [
    { href: "/adopt?species=dog", emoji: "🐕", label: "Psi", count: stats.dogs },
    { href: "/adopt?species=cat", emoji: "🐈", label: "Kočky", count: stats.cats },
    { href: "/adopt?urgent=1", emoji: "🚨", label: "Naléhavé případy", count: stats.urgent },
    { href: "/adopt?long_stay=1", emoji: "⏳", label: "Dlouho čekají", count: stats.longStay },
  ];

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-cream via-cream-warm to-peach-100/50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-7 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            {stats.animalsAvailable > 0 && (
              <span className="mb-5 inline-flex items-center gap-2 rounded-pill bg-peach-100 px-4 py-1.5 text-sm font-bold text-terracotta-600">
                <Sparkles className="size-4" /> {stats.animalsAvailable}{" "}
                {pluralAnimals(stats.animalsAvailable)} čeká právě teď
              </span>
            )}
            <h1 className="font-display text-5xl font-bold leading-[1.03] tracking-tight text-ink-900 md:text-6xl">
              Najdi parťáka na celý život.
            </h1>
            <p className="mt-5 max-w-md text-lg font-medium text-ink-600">
              Adopce, která tě chytne za srdce. A za tlapku. Procházej zvířata z útulků v Česku a na
              Slovensku a najdi to své.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ZozioButton asChild variant="meadow" size="lg">
                <Link href="/adopt">
                  <Search /> Začít hledat
                </Link>
              </ZozioButton>
              <ZozioButton asChild variant="outline" size="lg">
                <Link href="/mapa">Mapa útulků</Link>
              </ZozioButton>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-ink-500">
              <li>🐾 Ověřené útulky</li>
              <li>🔒 Bezpečná adopce</li>
              <li>🇨🇿 🇸🇰 ČR a Slovensko</li>
            </ul>
          </div>

          <HeroBento stats={stats} />
        </div>
      </section>

      {/* PROČ ZOZIO */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-7">
        <div className="grid gap-5 md:grid-cols-3">
          <WhyCard
            emoji="🐾"
            title="Ověřené útulky"
            text="Všechna zvířata jsou z prověřených útulků a záchranných stanic v ČR a SK."
          />
          <WhyCard
            emoji="❤️"
            title="Vše na jednom místě"
            text="Povaha, zdraví, fotky i žádost o adopci — bez nekonečného telefonování."
          />
          <WhyCard
            emoji="🤝"
            title="Podpoříš přímo útulek"
            text="Adopce i dary jdou napřímo útulku. Zozio si z darů nebere nic."
          />
        </div>
      </section>

      {/* CO DNESKA HLEDÁŠ */}
      <section className="mx-auto max-w-6xl px-5 pb-4 sm:px-7">
        <Kicker>Rychlý start</Kicker>
        <SectionTitle>Co dneska hledáš?</SectionTitle>
        <div className="mt-7 flex flex-wrap gap-3.5">
          {quick.map((q) => (
            <Link
              key={q.label}
              href={q.href}
              className="inline-flex items-center gap-2.5 rounded-pill border-[1.5px] border-ink-900/10 bg-card px-5 py-3 text-base font-bold text-ink-700 transition hover:border-terracotta-400 hover:text-terracotta-600"
            >
              <span className="text-lg">{q.emoji}</span>
              {q.label}
              <span className="text-sm font-bold text-ink-400">{q.count}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ZVÍŘATA */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-7">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Kicker>Právě teď na Zoziu</Kicker>
            <SectionTitle>Zvířata, která potřebují domov</SectionTitle>
          </div>
          <Link
            href="/adopt"
            className="ml-auto inline-flex items-center gap-1 text-sm font-bold text-terracotta-600 hover:text-terracotta-500"
          >
            Všechna zvířata <ArrowRight className="size-4" />
          </Link>
        </div>
        {animals.length > 0 ? (
          <div className="mt-9 grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
            {animals.slice(0, 4).map((a) => (
              <AnimalCard key={a.id} animal={a} />
            ))}
          </div>
        ) : (
          <EmptyCard>Zatím tu nejsou žádná zvířata k adopci. Brzy se to změní. 🐾</EmptyCard>
        )}
      </section>

      {/* JAK TO FUNGUJE */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-7">
        <Kicker>Jak to funguje</Kicker>
        <SectionTitle>Od kliku k tlapce za 4 kroky</SectionTitle>
        <div className="mt-9 grid gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
          <Step n="1" icon={<Search className="size-5" />} title="Najdi zvíře" text="Procházej katalog, filtruj podle plemene, povahy nebo lokace. Ulož si oblíbená." />
          <Step n="2" icon={<PawPrint className="size-5" />} title="Pošli žádost" text="Vyplň krátký formulář o sobě. Útulek se ti ozve do několika dní." />
          <Step n="3" icon={<Sparkles className="size-5" />} title="Setkej se" text="Pozdrav svého potenciálního parťáka v útulku. Pokud to klikne, jdete dál." />
          <Step n="4" icon={<Home className="size-5" />} title="Pojď domů" text="Podepiš adopční smlouvu a vezmi parťáka domů. Začíná nový život." />
        </div>
      </section>

      {/* MAGAZÍN */}
      {magazine.length > 0 && (
        <section className="bg-cream">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-7">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Kicker>Magazín</Kicker>
                <SectionTitle>Čti, než si vezmeš parťáka</SectionTitle>
              </div>
              <Link
                href="/magazin"
                className="ml-auto inline-flex items-center gap-1 text-sm font-bold text-terracotta-600 hover:text-terracotta-500"
              >
                Celý magazín <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="mt-9 grid grid-cols-1 gap-[22px] md:grid-cols-3">
              {magazine.map((m) => (
                <Link
                  key={m.id}
                  href={m.href}
                  className="group overflow-hidden rounded-3xl bg-card shadow-soft-sm ring-1 ring-ink-900/5 transition hover:-translate-y-1 hover:shadow-soft-md"
                >
                  <div className="relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br from-sunshine-200 to-peach-100 text-4xl">
                    {m.coverUrl ? (
                      <Image
                        src={m.coverUrl}
                        alt={m.title}
                        fill
                        sizes="(min-width: 768px) 33vw, 100vw"
                        className="object-cover transition group-hover:scale-[1.03]"
                      />
                    ) : (
                      m.emoji
                    )}
                  </div>
                  <div className="p-5">
                    <MagTag source={m.source} />
                    <h3 className="mt-2 font-display text-lg font-bold leading-snug text-ink-900">
                      {m.title}
                    </h3>
                    {m.meta && (
                      <p className="mt-1.5 text-[13px] font-medium text-ink-500">{m.meta}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PŘÍBĚHY */}
      <section className="bg-gradient-to-br from-peach-100/60 to-cream-warm">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-7">
          <Kicker>Příběhy z nových domovů</Kicker>
          <SectionTitle>Adopce mění životy obou stran.</SectionTitle>
          <div className="mt-9 grid gap-[22px] md:grid-cols-3">
            {STORIES.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
          </div>
        </div>
      </section>

      {/* MAPA TEASER */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-7">
        <div className="flex flex-wrap items-center gap-8 rounded-[34px] bg-gradient-to-br from-peach-100 to-sunshine-200/60 p-9 ring-1 ring-terracotta-400/20 md:p-10">
          <div className="min-w-[240px] flex-1">
            <h2 className="font-display text-3xl font-bold tracking-tight text-terracotta-600">
              Najdi útulek u tebe
            </h2>
            <p className="mt-2 max-w-md font-medium text-ink-600">
              Prohlédni si útulky a záchranné stanice na mapě Česka a Slovenska. Síť roste každý
              měsíc.
            </p>
            <ZozioButton asChild variant="meadow" size="lg" className="mt-5">
              <Link href="/mapa">📍 Otevřít mapu</Link>
            </ZozioButton>
          </div>
          <div className="relative h-48 min-w-[260px] flex-1 overflow-hidden rounded-3xl bg-cream ring-1 ring-ink-900/8">
            <div className="absolute inset-6 rounded-[30%_40%_35%_45%/40%_35%_45%_35%] bg-sunshine-200/50" />
            <span className="absolute left-[34%] top-[42%] text-2xl drop-shadow">📍</span>
            <span className="absolute left-[52%] top-[58%] text-2xl drop-shadow">📍</span>
            <span className="absolute left-[62%] top-[30%] text-lg opacity-50 drop-shadow">📍</span>
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-7">
        <div className="rounded-[34px] bg-ink-900 px-6 py-14 text-center text-cream sm:px-10">
          <Sparkles className="mx-auto mb-3 size-7 text-sunshine-400" />
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Buď u toho, když přijde to pravé.
          </h2>
          <p className="mx-auto mt-3 max-w-md font-medium text-cream/70">
            Občasný newsletter s novými zvířaty, příběhy z útulků a pozváními na akce. Žádný spam.
          </p>
          <NewsletterForm className="mt-7" />
          <p className="mt-3 text-xs text-cream/50">Odhlásit se můžeš kdykoliv jedním klikem.</p>
        </div>
      </section>
    </>
  );
}

// ---- helpers & subcomponents -------------------------------------------

function pluralAnimals(n: number): string {
  if (n === 1) return "zvíře";
  if (n >= 2 && n <= 4) return "zvířata";
  return "zvířat";
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-bold uppercase tracking-[0.15em] text-terracotta-600">
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink-900 md:text-4xl">
      {children}
    </h2>
  );
}

function WhyCard({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft-sm ring-1 ring-ink-900/5">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-peach-100 text-2xl">
        {emoji}
      </div>
      <h3 className="mt-3.5 font-display text-xl font-bold text-ink-900">{title}</h3>
      <p className="mt-1.5 text-sm font-medium leading-relaxed text-ink-500">{text}</p>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  text,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft-sm ring-1 ring-ink-900/5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-terracotta-500 font-display text-lg font-bold text-cream">
          {n}
        </span>
        <span className="text-terracotta-600">{icon}</span>
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-ink-900">{title}</h3>
      <p className="mt-1.5 text-sm font-medium leading-relaxed text-ink-500">{text}</p>
    </div>
  );
}

function MagTag({ source }: { source: { kind: "zozio" | "shelter" | "story"; label: string } }) {
  const cls =
    source.kind === "zozio"
      ? "bg-ink-900 text-cream"
      : source.kind === "story"
        ? "bg-fern-100 text-fern-700"
        : "bg-peach-100 text-terracotta-600";
  return (
    <span className={`inline-block rounded-pill px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {source.label}
    </span>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-9 rounded-3xl bg-cream-warm p-12 text-center font-medium text-ink-500">
      {children}
    </div>
  );
}

function HeroBento({
  stats,
}: {
  stats: { animalsAvailable: number; institutions: number; urgent: number };
}) {
  return (
    <div className="grid grid-cols-6 gap-4">
      <div className="col-span-4 rounded-[34px] bg-terracotta-500 p-6 text-cream">
        <div className="text-xs font-bold uppercase tracking-wider opacity-80">Právě teď čeká</div>
        <div className="mt-1.5 font-display text-6xl font-bold leading-none">
          {stats.animalsAvailable.toLocaleString("cs-CZ")}
        </div>
        <div className="mt-2 text-base font-bold">zvířat hledá nový domov</div>
      </div>
      <div className="col-span-2 rounded-[34px] bg-sunshine-400 p-5 text-ink-900">
        <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">V síti</div>
        <div className="mt-1 font-display text-4xl font-bold leading-none">{stats.institutions}</div>
        <div className="mt-1.5 text-sm font-bold">útulků</div>
      </div>
      <div className="col-span-3 rounded-[34px] bg-peach-100 p-5 text-terracotta-600">
        <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">Naléhá</div>
        <div className="mt-1 font-display text-4xl font-bold leading-none">{stats.urgent}</div>
        <div className="mt-1.5 text-sm font-bold">případů</div>
      </div>
      <div className="col-span-3 rounded-[34px] bg-cream-warm p-5 text-ink-700 ring-1 ring-ink-900/5">
        <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">CZ + SK</div>
        <div className="my-1 text-2xl">🇨🇿 🇸🇰</div>
        <div className="text-sm font-bold">společná platforma</div>
      </div>
      <Link
        href="/adopt"
        className="col-span-6 flex items-center gap-3.5 rounded-3xl bg-ink-900 p-5 text-cream transition hover:bg-ink-700"
      >
        <Sparkles className="size-6 shrink-0 text-sunshine-400" />
        <div>
          <div className="font-display text-lg font-bold leading-tight">
            AI ti pomůže najít to pravé
          </div>
          <div className="mt-0.5 text-sm text-cream/70">Kvíz · matching · smart filtry</div>
        </div>
        <ArrowRight className="ml-auto size-5" />
      </Link>
    </div>
  );
}

// Testimonialy (značkový obsah, ne data z DB).
interface Story {
  id: string;
  petName: string;
  ownerName: string;
  location: string;
  quote: string;
  emoji: string;
}

const STORIES: Story[] = [
  {
    id: "1",
    petName: "Lolu",
    ownerName: "Markéta & Tomáš",
    location: "Praha",
    emoji: "🐶",
    quote:
      "Mysleli jsme, že adoptujeme my Lolu. Ukázalo se, že to bylo přesně naopak. Změnila nám život.",
  },
  {
    id: "2",
    petName: "Alberta",
    ownerName: "Eliška",
    location: "Brno",
    emoji: "🐱",
    quote:
      "Z plachého kocoura ze stanice se za půl roku stal nejlepší parťák. Nelituji ani vteřiny.",
  },
  {
    id: "3",
    petName: "Bobeše",
    ownerName: "Rodina Veselých",
    location: "Olomouc",
    emoji: "🐶",
    quote:
      "Hledali jsme psa pro děti. Bobeš nás přesvědčil, že už nikdy nechceme jiného než z útulku.",
  },
];

function StoryCard({ story }: { story: Story }) {
  return (
    <article className="overflow-hidden rounded-3xl bg-card shadow-soft-sm ring-1 ring-ink-900/5">
      <div className="flex h-36 items-center justify-center bg-gradient-to-br from-sunshine-200/70 to-cream-warm text-4xl">
        {story.emoji}
      </div>
      <div className="p-6">
        <p className="font-display text-base italic leading-relaxed text-ink-700">
          „{story.quote}"
        </p>
        <div className="mt-3.5 text-sm font-bold text-ink-900">{story.ownerName}</div>
        <div className="text-xs font-medium text-ink-500">
          adoptovali {story.petName} · {story.location}
        </div>
      </div>
    </article>
  );
}
