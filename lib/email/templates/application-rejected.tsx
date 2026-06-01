import { Section, Text } from "@react-email/components";

import { COLORS, SITE_URL } from "../config";
import { Button } from "@react-email/components";
import { EmailLayout, styles } from "./base";

interface ApplicationRejectedEmailProps {
  applicantName?: string | null;
  animalName: string;
  institutionName: string;
  reason?: string | null;
}

/** Zamítnutí žádosti o adopci. */
export function ApplicationRejectedEmail({
  applicantName,
  animalName,
  institutionName,
  reason,
}: ApplicationRejectedEmailProps) {
  return (
    <EmailLayout preview={`Žádost o adopci ${animalName} — vyjádření útulku`}>
      <Text style={styles.heading}>Vyjádření k žádosti</Text>
      <Text style={styles.paragraph}>
        {applicantName ? `Dobrý den, ${applicantName},` : "Dobrý den,"} děkujeme
        za zájem o adopci <strong>{animalName}</strong>. Po posouzení vás musíme
        bohužel informovat, že útulek <strong>{institutionName}</strong> vaši
        žádost tentokrát nemůže schválit.
      </Text>

      {reason?.trim() ? (
        <Section style={noteBox}>
          <Text style={{ ...styles.muted, margin: "0 0 6px", fontWeight: 700 }}>
            Důvod
          </Text>
          <Text style={{ ...styles.paragraph, margin: 0, whiteSpace: "pre-line" }}>
            {reason}
          </Text>
        </Section>
      ) : null}

      <Text style={styles.paragraph}>
        Mrzí nás to. Věříme ale, že se najde jiné zvíře, kterému dokážete dát
        skvělý domov. Mrkněte na náš katalog:
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={`${SITE_URL}/adopt`} style={styles.button}>
          Prohlédnout zvířata
        </Button>
      </Section>
    </EmailLayout>
  );
}

const noteBox = {
  backgroundColor: COLORS.creamWarm,
  borderRadius: "16px",
  padding: "18px 22px",
  margin: "8px 0 20px",
};

export default ApplicationRejectedEmail;
