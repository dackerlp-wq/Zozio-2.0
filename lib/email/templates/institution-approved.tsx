import { Button, Section, Text } from "@react-email/components";

import { SITE_URL } from "../config";
import { EmailLayout, styles } from "./base";

interface InstitutionApprovedEmailProps {
  institutionName: string;
}

export function InstitutionApprovedEmail({
  institutionName,
}: InstitutionApprovedEmailProps) {
  return (
    <EmailLayout preview={`${institutionName} byl ověřen a může být zveřejněn`}>
      <Text style={styles.heading}>Útulek byl ověřen ✅</Text>
      <Text style={styles.paragraph}>
        Skvělá zpráva — <strong>{institutionName}</strong> jsme úspěšně ověřili.
        Teď ho můžeš kdykoli zveřejnit, aby vás adoptanti našli na zozio.cz.
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={`${SITE_URL}/admin/settings`} style={styles.button}>
          Zveřejnit útulek
        </Button>
      </Section>

      <Text style={styles.paragraph}>
        Nezapomeň přidat alespoň jedno zvíře — profil pak bude hned k světu.
      </Text>
    </EmailLayout>
  );
}

export default InstitutionApprovedEmail;
