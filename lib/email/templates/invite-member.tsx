import { Button, Section, Text } from "@react-email/components";

import { COLORS } from "../config";
import { EmailLayout } from "./base";

interface InviteMemberEmailProps {
  institutionName: string;
  acceptUrl: string;
}

/** Pozvánka nového člena do týmu útulku. */
export function InviteMemberEmail({
  institutionName,
  acceptUrl,
}: InviteMemberEmailProps) {
  return (
    <EmailLayout preview={`Pozvánka do týmu ${institutionName}`}>
      <Section>
        <Text style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 12px" }}>
          Pozvánka do týmu
        </Text>
        <Text style={{ fontSize: "14px", margin: "0 0 16px" }}>
          Byl{"(a)"} jsi pozván{"(a)"} do týmu útulku{" "}
          <strong>{institutionName}</strong> na platformě Zozio. Po přijetí
          získáš přístup do administrace útulku.
        </Text>
        <Button
          href={acceptUrl}
          style={{
            backgroundColor: COLORS.coral,
            color: "#fff",
            fontWeight: 700,
            fontSize: "15px",
            padding: "13px 26px",
            borderRadius: "100px",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Přijmout pozvánku
        </Button>
        <Text style={{ fontSize: "12px", color: "#8B7355", margin: "16px 0 0" }}>
          Pozvánka platí 7 dní. Pokud jsi o ni nežádal{"(a)"}, e-mail ignoruj.
        </Text>
      </Section>
    </EmailLayout>
  );
}
