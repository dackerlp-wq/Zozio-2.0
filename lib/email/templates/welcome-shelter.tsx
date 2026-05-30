import { Button, Section, Text } from "@react-email/components";

import { SITE_URL } from "../config";
import { EmailLayout, styles } from "./base";

interface WelcomeShelterEmailProps {
  institutionName: string;
}

export function WelcomeShelterEmail({
  institutionName,
}: WelcomeShelterEmailProps) {
  return (
    <EmailLayout
      preview={`${institutionName} je založen — čeká na ověření`}
    >
      <Text style={styles.heading}>Útulek je založený 🎉</Text>
      <Text style={styles.paragraph}>
        Díky! <strong>{institutionName}</strong> jsme úspěšně vytvořili. Teď ho
        zkontrolujeme a co nejdřív ověříme — dáme ti vědět e-mailem.
      </Text>
      <Text style={styles.paragraph}>
        Mezitím můžeš v administraci přidávat zvířata a doladit profil. Veřejně
        se útulek zobrazí hned po schválení.
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={`${SITE_URL}/admin/dashboard`} style={styles.button}>
          Do administrace
        </Button>
      </Section>
    </EmailLayout>
  );
}

export default WelcomeShelterEmail;
