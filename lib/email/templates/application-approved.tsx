import { Section, Text } from "@react-email/components";

import { COLORS } from "../config";
import { EmailLayout, styles } from "./base";

interface ApplicationApprovedEmailProps {
  applicantName?: string | null;
  animalName: string;
  institutionName: string;
  feeLabel?: string | null;
}

/** Schválení adopce — v příloze e-mailu je PDF smlouva. */
export function ApplicationApprovedEmail({
  applicantName,
  animalName,
  institutionName,
  feeLabel,
}: ApplicationApprovedEmailProps) {
  return (
    <EmailLayout preview={`Schváleno! Adopce ${animalName} může proběhnout`}>
      <Text style={styles.heading}>Adopce schválena 🎉</Text>
      <Text style={styles.paragraph}>
        {applicantName ? `Dobrý den, ${applicantName},` : "Dobrý den,"} máme
        radost — útulek <strong>{institutionName}</strong> schválil vaši adopci{" "}
        <strong>{animalName}</strong>!
      </Text>

      <Section style={noteBox}>
        <Text style={{ ...styles.paragraph, margin: 0 }}>
          📎 V příloze tohoto e-mailu najdete <strong>adopční smlouvu v PDF</strong>.
          Smlouvu si prosím přečtěte a přineste s sebou na předání.
          {feeLabel ? (
            <>
              {" "}
              Adopční příspěvek: <strong>{feeLabel}</strong>.
            </>
          ) : null}
        </Text>
      </Section>

      <Text style={styles.paragraph}>
        Na předání domluvíme konkrétní detaily. Po převzetí zvířete vám přijde
        závěrečný e-mail s doporučeními pro první dny doma.
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

export default ApplicationApprovedEmail;
