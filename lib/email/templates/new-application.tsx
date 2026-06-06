import { Button, Section, Text } from "@react-email/components";

import { SITE_URL } from "../config";
import { EmailLayout, styles } from "./base";

interface NewApplicationEmailProps {
  animalName: string;
  applicantName: string;
  applicantCity?: string | null;
  message?: string | null;
  isFoster?: boolean;
  applicationId: string;
}

/** Upozornění útulku na novou žádost o adopci / nabídku dočasné péče. */
export function NewApplicationEmail({
  animalName,
  applicantName,
  applicantCity,
  message,
  isFoster,
  applicationId,
}: NewApplicationEmailProps) {
  const kind = isFoster ? "nabídku dočasné péče" : "žádost o adopci";
  return (
    <EmailLayout preview={`Nová ${kind} — ${animalName}`}>
      <Text style={styles.heading}>
        {isFoster ? "🏡 Nová nabídka dočasné péče" : "❤️ Nová žádost o adopci"}
      </Text>
      <Text style={styles.paragraph}>
        Na <strong>{animalName}</strong> přišla nová {kind} od{" "}
        <strong>{applicantName}</strong>
        {applicantCity ? ` (${applicantCity})` : ""}.
      </Text>
      {message && (
        <Text style={{ ...styles.paragraph, fontStyle: "italic" }}>„{message}"</Text>
      )}
      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={`${SITE_URL}/admin/applications/${applicationId}`} style={styles.button}>
          Otevřít žádost
        </Button>
      </Section>
      <Text style={styles.muted}>
        Ozvěte se zájemci co nejdřív — rychlá reakce výrazně zvyšuje šanci na úspěšnou adopci.
      </Text>
    </EmailLayout>
  );
}

export default NewApplicationEmail;
