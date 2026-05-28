import { LegalProse } from "@/components/zozio/legal-prose";

export const metadata = {
  title: "Zásady ochrany osobních údajů — Zozio",
  description:
    "Jak Zozio zpracovává a chrání osobní údaje uživatelů v souladu s GDPR.",
};

export default function PrivacyPage() {
  return (
    <LegalProse title="Zásady ochrany osobních údajů" updated="28. 5. 2026">
      <p>
        Tyto zásady popisují, jaké osobní údaje shromažďujeme při používání
        platformy Zozio (dále jen „služba"), proč je zpracováváme a jaká máš jako
        subjekt údajů práva. Zpracování probíhá v souladu s nařízením (EU)
        2016/679 (GDPR).
      </p>

      <h2>Správce údajů</h2>
      <p>
        Správcem osobních údajů je provozovatel platformy Zozio. Ve věcech
        ochrany osobních údajů nás kontaktuj na{" "}
        <a href="mailto:ahoj@zozio.cz">ahoj@zozio.cz</a>.
      </p>

      <h2>Jaké údaje zpracováváme</h2>
      <ul>
        <li>
          <strong>Registrační údaje</strong> — e-mailová adresa, jméno a heslo
          (uložené v zašifrované podobě). Při přihlášení přes Google získáváme
          tvé jméno, e-mail a profilový obrázek z tvého Google účtu.
        </li>
        <li>
          <strong>Údaje z žádostí o adopci</strong> — jméno, kontaktní údaje a
          informace, které dobrovolně vyplníš ve formuláři.
        </li>
        <li>
          <strong>Technické údaje</strong> — IP adresa, typ prohlížeče a údaje o
          používání nezbytné pro provoz a zabezpečení služby.
        </li>
      </ul>

      <h2>Účely a právní základ zpracování</h2>
      <ul>
        <li>
          <strong>Poskytování služby</strong> (správa účtu, zprostředkování
          adopcí) — plnění smlouvy.
        </li>
        <li>
          <strong>Zabezpečení a prevence zneužití</strong> — oprávněný zájem.
        </li>
        <li>
          <strong>Zasílání newsletteru</strong> — jen na základě tvého souhlasu,
          který můžeš kdykoli odvolat.
        </li>
      </ul>

      <h2>Přihlášení přes Google</h2>
      <p>
        Pokud se přihlásíš přes Google, použijeme pouze tvé jméno, e-mail a
        profilový obrázek pro vytvoření a správu účtu. Nezískáváme přístup k
        dalšímu obsahu tvého Google účtu a údaje nesdílíme s třetími stranami nad
        rámec popsaný v těchto zásadách.
      </p>

      <h2>Zpracovatelé a předávání údajů</h2>
      <p>
        K provozu služby využíváme prověřené poskytovatele, kteří pro nás údaje
        zpracovávají: <strong>Supabase</strong> (databáze a autentizace),{" "}
        <strong>Vercel</strong> (hosting) a <strong>Resend</strong> (rozesílka
        e-mailů). S každým z nich máme uzavřenou smlouvu o zpracování osobních
        údajů.
      </p>

      <h2>Doba uchování</h2>
      <p>
        Údaje uchováváme po dobu trvání tvého účtu. Po jeho zrušení je smažeme
        nebo anonymizujeme, pokud nám zákon neukládá je uchovat déle.
      </p>

      <h2>Tvá práva</h2>
      <ul>
        <li>právo na přístup ke svým údajům a jejich kopii,</li>
        <li>právo na opravu nepřesných údajů,</li>
        <li>právo na výmaz („právo být zapomenut"),</li>
        <li>právo na omezení zpracování a právo vznést námitku,</li>
        <li>právo na přenositelnost údajů,</li>
        <li>právo odvolat souhlas a právo podat stížnost u Úřadu pro ochranu osobních údajů.</li>
      </ul>

      <h2>Kontakt</h2>
      <p>
        Pro uplatnění svých práv nebo jakékoli dotazy nám napiš na{" "}
        <a href="mailto:ahoj@zozio.cz">ahoj@zozio.cz</a>.
      </p>
    </LegalProse>
  );
}
