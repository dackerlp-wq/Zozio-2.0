import { Section, Text } from "@react-email/components";

import { EmailLayout } from "./base";

interface ScheduledExportEmailProps {
  institutionName: string;
  exportLabel: string;
  periodLabel: string;
}

/** Průvodní e-mail k naplánovanému exportu (PDF/XLSX je v příloze). */
export function ScheduledExportEmail({
  institutionName,
  exportLabel,
  periodLabel,
}: ScheduledExportEmailProps) {
  return (
    <EmailLayout preview={`${exportLabel} — ${periodLabel}`}>
      <Section>
        <Text style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 12px" }}>
          {exportLabel}
        </Text>
        <Text style={{ fontSize: "14px", margin: "0 0 8px" }}>
          Dobrý den, posíláme naplánovaný export pro útulek{" "}
          <strong>{institutionName}</strong> za období {periodLabel}.
        </Text>
        <Text style={{ fontSize: "14px", margin: "0 0 8px" }}>
          Soubor najdete v příloze tohoto e-mailu.
        </Text>
      </Section>
    </EmailLayout>
  );
}
