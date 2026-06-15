import { LegalProse } from "@/components/zozio/legal-prose";

export const metadata = {
  title: "Zásady používání cookies — Zozio",
  description: "Jaké cookies Zozio používá a k čemu slouží.",
};

export default function CookiesPage() {
  return (
    <LegalProse title="Zásady používání cookies" updated="28. 5. 2026">
      <p>
        Cookies jsou malé soubory, které se ukládají ve tvém prohlížeči. Zozio je
        používá v nezbytné míře pro fungování a zlepšování služby.
      </p>

      <h2>Nezbytné cookies</h2>
      <p>
        Slouží k přihlášení a udržení relace (session). Bez nich nelze používat
        účet a chráněné části služby. Tyto cookies nelze vypnout.
      </p>

      <h2>Analytické cookies</h2>
      <p>
        Pomáhají nám anonymně rozumět tomu, jak se služba používá, abychom ji
        mohli zlepšovat. K analytice využíváme Vercel Analytics.
      </p>

      <h2>Správa cookies</h2>
      <p>
        Cookies můžeš kdykoli spravovat nebo mazat v nastavení svého prohlížeče.
        Omezení nezbytných cookies může ovlivnit funkčnost služby.
      </p>

      <p>
        S dotazy nás kontaktuj na{" "}
        <a href="mailto:info@zozio.cz">info@zozio.cz</a>.
      </p>
    </LegalProse>
  );
}
