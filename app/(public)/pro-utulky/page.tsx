import Link from "next/link";
import {
  ArrowRight,
  Check,
  Plus,
  Sparkles,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  FEATURE_TILES,
  FEATURE_TIER_LABEL,
  MARKETING_PLANS,
  type FeatureTier,
} from "@/lib/plans";

const REGISTER_HREF = "/auth/register?role=institution";
const DEMO_HREF = "mailto:ahoj@zozio.cz?subject=Z%C3%A1jem%20o%20uk%C3%A1zku%20Zozio%20pro%20%C3%BAtulky";

export const metadata = {
  title: "Zozio pro útulky — méně papírů, více zvířat doma",
  description:
    "Zozio spojuje evidenci, provoz a veřejnou adopci na jednom místě. Evidence zvířat, KVS výstup, kotce, sbírky a statistiky pro české a slovenské útulky. Základ zdarma.",
  alternates: { canonical: "/pro-utulky" },
  openGraph: {
    title: "Zozio pro útulky — méně papírů, více zvířat doma",
    description:
      "Evidence, provoz i veřejná adopce na jednom místě. KVS výstup jedním klikem, z darů 0 %. Postaveno pro české útulky.",
    type: "website",
    url: "/pro-utulky",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zozio pro útulky",
    description:
      "Evidence, provoz i veřejná adopce na jednom místě. Postaveno pro české útulky.",
  },
};

const TIER_BADGE: Record<FeatureTier, string> = {
  free: "bg-fern-50 text-fern-600",
  start: "bg-meadow-50 text-meadow-700",
  profi: "bg-sunshine-200/70 text-sunshine-600",
};

const PROBLEMS = [
  "Excel, papíry a šanony všude",
  "Zvířata na Facebooku, který nikdo nehledá",
  "KVS evidence ručně, na poslední chvíli",
  "Ochranná lhůta a očkování v hlavě",
  "Dárci a sbírky v sešitě",
];

const SOLUTIONS = [
  "Celá evidence na jednom místě",
  "Veřejný profil a katalog, kde lidé adoptují",
  "KVS výstup jedním klikem (PDF)",
  "Lhůty a úkoly hlídá systém za vás",
  "Sbírky, dárci a statistiky pro granty",
];

const STEPS = [
  { n: 1, title: "Registrace", desc: "Založíte útulek a vyplníte základní profil. Zdarma." },
  { n: 2, title: "Přidáte zvířata", desc: "Naimportujete nebo zadáte zvířata a zveřejníte profil." },
  { n: 3, title: "Lidé adoptují", desc: "Zvířata se objeví v katalogu a chodí vám žádosti." },
  { n: 4, title: "Rostete", desc: "Statistiky, sbírky a granty — a víc zvířat doma." },
];

const WHY = [
  { e: "⚖️", title: "Česká legislativa", desc: "Ochranná lhůta, KVS evidence i §25 zákona 246/1992 Sb. — přímo v systému." },
  { e: "🇨🇿", title: "Česky a srozumitelně", desc: "Žádný překlad cizího softwaru. Mluvíme vaším jazykem." },
  { e: "💝", title: "Férové k darům", desc: "Z darů a sbírek si nebereme nic. Peníze jdou celé útulku." },
  { e: "🚀", title: "Roste s vámi", desc: "Od malého spolku po síť poboček. Začnete zdarma, platíte až za rozsah." },
];

const FAQ = [
  {
    q: "Je Free verze opravdu zdarma navždy?",
    a: "Ano — Free funguje jako adopční portál: přidáte profil útulku a zvířat a dostáváte zájem o adopci přes jednoduchý formulář. Evidence, KVS a provoz (kotce, zdraví, právní stav) jsou od tarifu Start.",
  },
  {
    q: "Berete si procenta z darů?",
    a: "Ne. Z darů ani sbírek si Zozio nebere nic — peníze jdou přímo vám.",
  },
  {
    q: "Zvládneme přechod z Excelu?",
    a: "Ano, pomůžeme s importem. Většina útulků je hotová za jedno odpoledne.",
  },
  {
    q: "Funguje KVS výstup podle zákona?",
    a: "Ano, generuje oficiální PDF evidenci pro krajskou veterinární správu.",
  },
];

export default function ProUtulkyPage() {
  return (
    <div className="bg-cream text-ink-900">
      {/* Pruh „testovací režim" je teď globální (public layout). */}

      {/* HERO */}
      <section className="bg-gradient-to-b from-cream via-peach-100/50 to-cream-warm/60 px-4 py-16 text-center sm:py-20">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-pill border border-ink-900/10 bg-cream px-4 py-1.5 text-sm font-bold text-meadow-700">
            🐾 Pro útulky v ČR a SR
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink-900 sm:text-5xl md:text-6xl">
            Méně papírů. <em className="text-meadow-700 not-italic">Více zvířat</em> doma.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg font-semibold text-ink-600">
            Zozio spojuje evidenci, provoz a veřejnou adopci na jednom místě.
            Ať se můžete věnovat zvířatům, ne tabulkám.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={REGISTER_HREF} className={ctaPrimary}>
              Začít zdarma
            </Link>
            <Link href={DEMO_HREF} className={ctaSecondary}>
              Domluvit ukázku
            </Link>
          </div>
          <div className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-bold text-ink-600">
            <span className="flex items-center gap-1.5">✓ Základ zdarma</span>
            <span className="flex items-center gap-1.5">🇨🇿 KVS evidence (od Start)</span>
            <span className="flex items-center gap-1.5">💛 Z darů 0 % poplatek</span>
          </div>
        </div>
      </section>

      {/* PROBLÉM → ŘEŠENÍ */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <Kicker>Konec chaosu</Kicker>
        <SectionTitle>Znáte to?</SectionTitle>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl bg-cream p-7 ring-1 ring-ink-900/10">
            <h3 className="font-display text-xl font-bold text-ink-900">Bez Zozio</h3>
            <ul className="mt-4 space-y-1">
              {PROBLEMS.map((p) => (
                <li key={p} className="flex items-start gap-2.5 py-1 text-[15px] font-semibold text-ink-500">
                  <X className="mt-0.5 size-4 shrink-0 text-terracotta-600" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-ink-900 p-7 text-cream">
            <h3 className="font-display text-xl font-bold">Se Zozio</h3>
            <ul className="mt-4 space-y-1">
              {SOLUTIONS.map((s) => (
                <li key={s} className="flex items-start gap-2.5 py-1 text-[15px] font-semibold">
                  <Check className="mt-0.5 size-4 shrink-0 text-fern-100" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FUNKCE */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Kicker>Co Zozio umí</Kicker>
        <SectionTitle>Celý útulek na jednom místě</SectionTitle>
        <SectionSub>Od příjmu po nový domov — a všechno mezi tím.</SectionSub>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_TILES.map((f) => (
            <div key={f.title} className="relative rounded-3xl bg-cream p-6 shadow-soft-sm ring-1 ring-ink-900/8">
              <span
                className={cn(
                  "absolute right-4 top-4 rounded-pill px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide",
                  TIER_BADGE[f.tier],
                )}
              >
                {FEATURE_TIER_LABEL[f.tier]}
              </span>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-meadow-50 text-2xl">
                {f.icon}
              </div>
              <h3 className="mt-3.5 font-display text-lg font-bold text-ink-900">{f.title}</h3>
              <p className="mt-1 text-sm font-semibold text-ink-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* JAK TO ROZJEDETE */}
      <section className="bg-cream-warm/50 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <Kicker>Začátek za pár minut</Kicker>
          <SectionTitle>Jak to rozjedete</SectionTitle>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-meadow-500 font-display text-xl font-extrabold text-cream">
                  {s.n}
                </div>
                <h3 className="mt-3 font-display text-lg font-bold text-ink-900">{s.title}</h3>
                <p className="mt-1 text-sm font-semibold text-ink-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CENÍK */}
      <section id="cenik" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
        <Kicker>Ceník</Kicker>
        <SectionTitle>Plaťte jen za to, co potřebujete</SectionTitle>
        <SectionSub>
          <b>Free</b> funguje jako adopční portál. Od tarifu <b>Start</b> získáte
          plnou platformu — evidenci, provoz a vše ostatní. Ceny bez DPH za měsíc.
        </SectionSub>
        <div className="mt-12 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MARKETING_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8",
                plan.popular && "shadow-soft-md ring-2 ring-meadow-500",
              )}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-pill bg-meadow-500 px-3.5 py-1 text-xs font-bold text-cream">
                  Nejoblíbenější
                </span>
              )}
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-meadow-700">
                {plan.kind}
              </div>
              <div className="mt-1 font-display text-xl font-extrabold text-ink-900">{plan.name}</div>
              <div className="mt-2 font-display text-4xl font-bold tracking-tight text-ink-900">
                {plan.priceCzk === 0 ? "0" : plan.priceCzk.toLocaleString("cs-CZ")}{" "}
                <span className="text-sm font-semibold text-ink-500">Kč</span>
              </div>
              <p className="mt-2 min-h-[44px] text-[13px] font-semibold text-ink-500">{plan.description}</p>
              <ul className="my-5 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] font-semibold text-ink-600">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-fern-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={REGISTER_HREF}
                className={cn(
                  "block rounded-pill px-4 py-3 text-center text-sm font-extrabold transition-colors",
                  plan.popular
                    ? "bg-meadow-500 text-cream hover:bg-meadow-600"
                    : "border-[1.5px] border-ink-900/15 bg-cream text-ink-700 hover:border-meadow-500 hover:text-meadow-700",
                )}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-[15px] font-bold text-fern-600">
          💛 Z vašich darů si Zozio nebere ani korunu.
        </p>
      </section>

      {/* PROČ ZOZIO */}
      <section className="bg-cream-warm/50 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <Kicker>Proč Zozio</Kicker>
          <SectionTitle>Postavené pro české útulky</SectionTitle>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {WHY.map((w) => (
              <div key={w.title} className="flex gap-4 rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8">
                <span className="text-3xl">{w.e}</span>
                <div>
                  <h3 className="font-display text-base font-bold text-ink-900">{w.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-ink-500">{w.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-16">
        <Kicker>Časté dotazy</Kicker>
        <SectionTitle>Co vás nejspíš zajímá</SectionTitle>
        <div className="mt-8 space-y-3">
          {FAQ.map((qa) => (
            <details key={qa.q} className="group rounded-2xl bg-cream p-5 ring-1 ring-ink-900/8">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-base font-bold text-ink-900">
                {qa.q}
                <Plus className="size-5 shrink-0 text-ink-400 transition-transform group-open:rotate-45" />
              </summary>
              <p className="mt-3 text-sm font-semibold text-ink-500">{qa.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-5xl rounded-[2.2rem] bg-ink-900 px-6 py-14 text-center text-cream">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Pojďme najít víc domovů.</h2>
          <p className="mx-auto mt-3 max-w-md font-semibold text-cream/70">
            Založte útulek na Zoziu zdarma a zveřejněte první zvíře ještě dnes.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href={REGISTER_HREF} className={ctaPrimary}>
              Začít zdarma <ArrowRight className="size-4" />
            </Link>
            <Link
              href={DEMO_HREF}
              className="inline-flex items-center gap-2 rounded-pill border-[1.5px] border-cream/25 px-6 py-3.5 text-base font-extrabold text-cream hover:bg-cream/10"
            >
              Domluvit ukázku
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

const ctaPrimary =
  "inline-flex items-center gap-2 rounded-pill bg-meadow-500 px-7 py-3.5 text-base font-extrabold text-cream shadow-soft-md transition-colors hover:bg-meadow-600";
const ctaSecondary =
  "inline-flex items-center gap-2 rounded-pill border-[1.5px] border-ink-900/15 bg-cream px-6 py-3.5 text-base font-extrabold text-ink-700 transition-colors hover:border-meadow-500 hover:text-meadow-700";

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-meadow-700">
      <Sparkles className="size-3.5" />
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-2 text-center font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
      {children}
    </h2>
  );
}

function SectionSub({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-auto mt-3 max-w-xl text-center text-base font-semibold text-ink-500">
      {children}
    </p>
  );
}
