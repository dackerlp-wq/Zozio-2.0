import { Button, Section, Text } from "@react-email/components";

import { SITE_URL } from "../config";
import { EmailLayout, styles } from "./base";

interface ApplicationReceivedEmailProps {
  applicantName?: string | null;
  animalName: string;
  institutionName: string;
}

/** Potvrzení po odeslání nové žádosti o adopci. */
export function ApplicationReceivedEmail({
  applicantName,
  animalName,
  institutionName,
}: ApplicationReceivedEmailProps) {
  return (
    <EmailLayout preview={`Žádost o adopci — ${animalName} — jsme přijali`}>
      <Text style={styles.heading}>Žádost jsme přijali 🐾</Text>
      <Text style={styles.paragraph}>
        {applicantName ? `Dobrý den, ${applicantName},` : "Dobrý den,"} děkujeme
        za zájem o adopci. Vaši žádost o <strong>{animalName}</strong> jsme úspěšně
        přijali a předali útulku <strong>{institutionName}</strong>.
      </Text>
      <Text style={styles.paragraph}>
        Co bude následovat: žádost nejprve posoudíme, poté vás telefonicky
        kontaktujeme a domluvíme osobní schůzku. O každém kroku vás budeme
        informovat e-mailem.
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={`${SITE_URL}/profil`} style={styles.button}>
          Moje žádosti
        </Button>
      </Section>

      <Text style={styles.muted}>
        Pokud jste o adopci nežádali, tento e-mail prosím ignorujte.
      </Text>
    </EmailLayout>
  );
}

export default ApplicationReceivedEmail;
