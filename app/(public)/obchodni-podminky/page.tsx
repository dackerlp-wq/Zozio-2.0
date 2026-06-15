import { LegalProse } from "@/components/zozio/legal-prose";

export const metadata = {
  title: "Obchodní podmínky — Zozio",
  description: "Podmínky používání platformy Zozio pro adoptanty a útulky.",
};

export default function TermsPage() {
  return (
    <LegalProse title="Obchodní podmínky" updated="28. 5. 2026">
      <p>
        Tyto podmínky upravují používání platformy Zozio (dále jen „služba"),
        která propojuje útulky a záchranné stanice s lidmi, kteří chtějí
        adoptovat nebo podpořit zvířata. Registrací a používáním služby s těmito
        podmínkami souhlasíš.
      </p>

      <h2>1. Popis služby</h2>
      <p>
        Zozio je online platforma umožňující útulkům zveřejňovat profily zvířat k
        adopci a uživatelům tato zvířata procházet, podávat žádosti o adopci a
        podporovat sbírky. Zozio je zprostředkovatel — samotná adopce probíhá
        mezi uživatelem a příslušným útulkem.
      </p>

      <h2>2. Uživatelský účet</h2>
      <ul>
        <li>Pro některé funkce je potřeba registrace e-mailem nebo přes Google.</li>
        <li>Jsi povinen uvádět pravdivé údaje a chránit své přihlašovací údaje.</li>
        <li>Za veškerou aktivitu pod svým účtem odpovídáš ty.</li>
      </ul>

      <h2>3. Žádosti o adopci</h2>
      <p>
        Podání žádosti o adopci není nárokem na adopci. O schválení rozhoduje
        výhradně daný útulek podle vlastních pravidel. Zozio neručí za průběh ani
        výsledek adopčního procesu.
      </p>

      <h2>4. Obsah a chování uživatelů</h2>
      <ul>
        <li>Zavazuješ se službu nezneužívat a nevkládat protiprávní či klamavý obsah.</li>
        <li>Útulky odpovídají za správnost údajů o zveřejněných zvířatech.</li>
        <li>Vyhrazujeme si právo omezit nebo zrušit účet při porušení podmínek.</li>
      </ul>

      <h2>5. Útulky a placené plány</h2>
      <p>
        Instituce mohou využívat rozšířené funkce v rámci placených plánů.
        Konkrétní rozsah a ceny jsou uvedeny v ceníku. Platební podmínky se řídí
        smlouvou uzavřenou při objednání plánu.
      </p>

      <h2>6. Odpovědnost</h2>
      <p>
        Službu poskytujeme „tak jak je". Neneseme odpovědnost za škody vzniklé
        používáním služby v rozsahu, který připouští právní řád. Usilujeme o
        nepřetržitý provoz, negarantujeme ho však bez výpadků.
      </p>

      <h2>7. Změny podmínek</h2>
      <p>
        Podmínky můžeme aktualizovat. O podstatných změnách tě budeme informovat
        a pokračováním v používání služby s aktualizovaným zněním souhlasíš.
      </p>

      <h2>8. Kontakt</h2>
      <p>
        S dotazy k podmínkám nás kontaktuj na{" "}
        <a href="mailto:info@zozio.cz">info@zozio.cz</a>.
      </p>
    </LegalProse>
  );
}
