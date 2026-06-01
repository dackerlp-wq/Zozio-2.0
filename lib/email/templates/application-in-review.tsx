import { Text } from "@react-email/components";

import { EmailLayout, styles } from "./base";

interface ApplicationInReviewEmailProps {
  applicantName?: string | null;
  animalName: string;
  institutionName: string;
}

/** Žádost přešla do posuzování. */
export function ApplicationInReviewEmail({
  applicantName,
  animalName,
  institutionName,
}: ApplicationInReviewEmailProps) {
  return (
    <EmailLayout preview={`Probíhá posouzení žádosti o ${animalName}`}>
      <Text style={styles.heading}>Probíhá posouzení 🔎</Text>
      <Text style={styles.paragraph}>
        {applicantName ? `Dobrý den, ${applicantName},` : "Dobrý den,"} vaši
        žádost o adopci <strong>{animalName}</strong> nyní pečlivě posuzujeme.
        Útulek <strong>{institutionName}</strong> chce mít jistotu, že to bude ten
        správný domov.
      </Text>
      <Text style={styles.paragraph}>
        Jakmile posouzení dokončíme, telefonicky vás kontaktujeme a domluvíme
        další postup. Děkujeme za trpělivost.
      </Text>
    </EmailLayout>
  );
}

export default ApplicationInReviewEmail;
