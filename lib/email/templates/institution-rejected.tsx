import { Button, Section, Text } from "@react-email/components";

import { COLORS, SITE_URL } from "../config";
import { EmailLayout, styles } from "./base";

interface InstitutionRejectedEmailProps {
  institutionName: string;
  reason: string;
}

export function InstitutionRejectedEmail({
  institutionName,
  reason,
}: InstitutionRejectedEmailProps) {
  return (
    <EmailLayout preview={`Ověření útulku ${institutionName} potřebuje doplnit`}>
      <Text style={styles.heading}>Ověření zatím neprošlo</Text>
      <Text style={styles.paragraph}>
        Útulek <strong>{institutionName}</strong> jsme prozatím nemohli ověřit.
        Tady je důvod:
      </Text>

      <Section
        style={{
          backgroundColor: "#FDEEEB",
          borderRadius: "16px",
          border: `1px solid ${COLORS.coral}33`,
          padding: "16px 20px",
          margin: "0 0 20px",
        }}
      >
        <Text style={{ ...styles.paragraph, margin: 0, color: COLORS.espresso }}>
          {reason}
        </Text>
      </Section>

      <Text style={styles.paragraph}>
        Uprav prosím údaje v nastavení a my útulek znovu zkontrolujeme. Kdyby
        cokoli, napiš nám — rádi pomůžeme.
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={`${SITE_URL}/admin/settings`} style={styles.button}>
          Upravit útulek
        </Button>
      </Section>
    </EmailLayout>
  );
}

export default InstitutionRejectedEmail;
