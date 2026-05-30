import { Button, Section, Text } from "@react-email/components";

import { COLORS, SITE_URL } from "../config";
import { EmailLayout, styles } from "./base";

interface InstitutionSuspendedEmailProps {
  institutionName: string;
  reason: string;
}

export function InstitutionSuspendedEmail({
  institutionName,
  reason,
}: InstitutionSuspendedEmailProps) {
  return (
    <EmailLayout preview={`Profil útulku ${institutionName} byl pozastaven`}>
      <Text style={styles.heading}>Útulek byl pozastaven</Text>
      <Text style={styles.paragraph}>
        Profil útulku <strong>{institutionName}</strong> jsme dočasně
        pozastavili, takže se teď veřejně nezobrazuje. Důvod:
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
        Pojďme to vyřešit — napiš nám na ahoj@zozio.cz nebo uprav údaje
        v nastavení. Jakmile bude vše v pořádku, profil zase zveřejníme.
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={`${SITE_URL}/admin/settings`} style={styles.button}>
          Upravit útulek
        </Button>
      </Section>
    </EmailLayout>
  );
}

export default InstitutionSuspendedEmail;
