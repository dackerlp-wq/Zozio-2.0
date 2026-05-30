import { Button, Section, Text } from "@react-email/components";

import { EmailLayout, styles } from "./base";

interface MagicLinkEmailProps {
  confirmationUrl: string;
}

export function MagicLinkEmail({ confirmationUrl }: MagicLinkEmailProps) {
  return (
    <EmailLayout preview="Tvůj přihlašovací odkaz do Zozia">
      <Text style={styles.heading}>Přihlášení do Zozia</Text>
      <Text style={styles.paragraph}>
        Klikni na tlačítko níže a budeš přihlášen/a. Žádné heslo není potřeba.
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={confirmationUrl} style={styles.button}>
          Přihlásit se
        </Button>
      </Section>

      <Text style={styles.paragraph}>
        Pokud tlačítko nefunguje, zkopíruj tento odkaz do prohlížeče:
      </Text>
      <Text style={styles.link}>{confirmationUrl}</Text>

      <Text style={styles.muted}>
        Pokud ses nepokoušel/a přihlásit, tento e-mail ignoruj.
      </Text>
    </EmailLayout>
  );
}

export default MagicLinkEmail;
