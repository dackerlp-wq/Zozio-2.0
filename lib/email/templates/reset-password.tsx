import { Button, Section, Text } from "@react-email/components";

import { EmailLayout, styles } from "./base";

interface ResetPasswordEmailProps {
  confirmationUrl: string;
}

export function ResetPasswordEmail({
  confirmationUrl,
}: ResetPasswordEmailProps) {
  return (
    <EmailLayout preview="Nastav si nové heslo k účtu Zozio">
      <Text style={styles.heading}>Obnovení hesla</Text>
      <Text style={styles.paragraph}>
        Dostali jsme žádost o nastavení nového hesla k tvému účtu. Klikni na
        tlačítko níže a zvol si nové heslo.
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={confirmationUrl} style={styles.button}>
          Nastavit nové heslo
        </Button>
      </Section>

      <Text style={styles.paragraph}>
        Pokud tlačítko nefunguje, zkopíruj tento odkaz do prohlížeče:
      </Text>
      <Text style={styles.link}>{confirmationUrl}</Text>

      <Text style={styles.muted}>
        Odkaz je platný omezenou dobu. Pokud jsi o změnu hesla nežádal/a, nic
        nedělej — heslo zůstane beze změny.
      </Text>
    </EmailLayout>
  );
}

export default ResetPasswordEmail;
