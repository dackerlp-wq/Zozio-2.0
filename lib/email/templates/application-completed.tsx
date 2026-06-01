import { Section, Text } from "@react-email/components";

import { COLORS } from "../config";
import { EmailLayout, styles } from "./base";

interface ApplicationCompletedEmailProps {
  applicantName?: string | null;
  animalName: string;
  institutionName: string;
  recommendations?: string | null;
}

/** Adopce dokončena — posíláme po předání zvířete, s doporučeními. */
export function ApplicationCompletedEmail({
  applicantName,
  animalName,
  institutionName,
  recommendations,
}: ApplicationCompletedEmailProps) {
  return (
    <EmailLayout preview={`${animalName} je doma — děkujeme a hodně štěstí!`}>
      <Text style={styles.heading}>Vítejte doma s {animalName} 🏡</Text>
      <Text style={styles.paragraph}>
        {applicantName ? `Dobrý den, ${applicantName},` : "Dobrý den,"} adopce je
        dokončena a <strong>{animalName}</strong> má konečně svůj domov. Děkujeme,
        že jste mu ho dali. Útulek <strong>{institutionName}</strong> vám přeje
        spoustu krásných společných chvil.
      </Text>

      {recommendations?.trim() ? (
        <Section style={noteBox}>
          <Text style={{ ...styles.muted, margin: "0 0 6px", fontWeight: 700 }}>
            Doporučení útulku
          </Text>
          <Text style={{ ...styles.paragraph, margin: 0, whiteSpace: "pre-line" }}>
            {recommendations}
          </Text>
        </Section>
      ) : null}

      <Text style={styles.paragraph}>
        První dny dejte zvířeti čas na aklimatizaci — nové prostředí může být
        stresující. Při jakýchkoli otázkách se na nás neváhejte obrátit.
      </Text>
      <Text style={styles.muted}>
        Budeme rádi za fotku, jak se vašemu novému parťákovi daří. 🐾
      </Text>
    </EmailLayout>
  );
}

const noteBox = {
  backgroundColor: COLORS.creamWarm,
  borderRadius: "16px",
  padding: "18px 22px",
  margin: "8px 0 20px",
};

export default ApplicationCompletedEmail;
