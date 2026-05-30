import { Button, Section, Text } from "@react-email/components";

import { EmailLayout, styles } from "./base";

interface ConfirmSignupEmailProps {
  confirmationUrl: string;
  /** Útulek vs. adoptant — mírně jiný text. */
  isShelter?: boolean;
}

export function ConfirmSignupEmail({
  confirmationUrl,
  isShelter = false,
}: ConfirmSignupEmailProps) {
  return (
    <EmailLayout preview="Potvrď svůj e-mail a dokončíme registraci na Zoziu">
      <Text style={styles.heading}>Vítej v Zoziu! 🐾</Text>
      <Text style={styles.paragraph}>
        {isShelter
          ? "Díky, že chceš pomáhat zvířatům přes Zozio. Potvrď prosím svůj e-mail a pustíme se do nastavení tvého útulku."
          : "Jsme rádi, že tu jsi. Potvrď prosím svůj e-mail a budeš moct začít hledat nového parťáka."}
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={confirmationUrl} style={styles.button}>
          Potvrdit e-mail
        </Button>
      </Section>

      <Text style={styles.paragraph}>
        Pokud tlačítko nefunguje, zkopíruj tento odkaz do prohlížeče:
      </Text>
      <Text style={styles.link}>{confirmationUrl}</Text>

      <Text style={styles.muted}>
        Pokud sis účet nezakládal/a, tento e-mail klidně ignoruj.
      </Text>
    </EmailLayout>
  );
}

export default ConfirmSignupEmail;
