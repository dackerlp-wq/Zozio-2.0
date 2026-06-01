import { Text } from "@react-email/components";

import { EmailLayout, styles } from "./base";

interface ApplicationPhoneMissedEmailProps {
  applicantName?: string | null;
  animalName: string;
  institutionName: string;
  institutionPhone?: string | null;
  institutionEmail?: string | null;
}

/** Telefonický kontakt se nezdařil (nezvedl/jiný problém) — výzva k ozvání. */
export function ApplicationPhoneMissedEmail({
  applicantName,
  animalName,
  institutionName,
  institutionPhone,
  institutionEmail,
}: ApplicationPhoneMissedEmailProps) {
  return (
    <EmailLayout preview={`Nepodařilo se nám vás zastihnout — ${animalName}`}>
      <Text style={styles.heading}>Nepodařilo se dovolat 📞</Text>
      <Text style={styles.paragraph}>
        {applicantName ? `Dobrý den, ${applicantName},` : "Dobrý den,"} pokoušeli
        jsme se vám dovolat ohledně vaší žádosti o adopci{" "}
        <strong>{animalName}</strong>, ale bohužel se nám vás nepodařilo
        zastihnout.
      </Text>
      <Text style={styles.paragraph}>
        Ozvěte se nám prosím zpět, ať můžeme domluvit osobní schůzku:
      </Text>
      <Text style={styles.paragraph}>
        <strong>{institutionName}</strong>
        {institutionPhone ? (
          <>
            <br />Telefon: <strong>{institutionPhone}</strong>
          </>
        ) : null}
        {institutionEmail ? (
          <>
            <br />E-mail: <strong>{institutionEmail}</strong>
          </>
        ) : null}
      </Text>
      <Text style={styles.muted}>
        Vaše žádost zůstává aktivní — těšíme se na vaše ozvání.
      </Text>
    </EmailLayout>
  );
}

export default ApplicationPhoneMissedEmail;
