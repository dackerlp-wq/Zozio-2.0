import { Section, Text } from "@react-email/components";

import { COLORS } from "../config";
import { EmailLayout, styles } from "./base";

interface ApplicationMeetingEmailProps {
  applicantName?: string | null;
  animalName: string;
  institutionName: string;
  meetingLabel: string;
  location?: string | null;
}

/** Domluvený termín osobní schůzky. */
export function ApplicationMeetingEmail({
  applicantName,
  animalName,
  institutionName,
  meetingLabel,
  location,
}: ApplicationMeetingEmailProps) {
  return (
    <EmailLayout preview={`Osobní schůzka kvůli ${animalName} — ${meetingLabel}`}>
      <Text style={styles.heading}>Osobní schůzka domluvena 🤝</Text>
      <Text style={styles.paragraph}>
        {applicantName ? `Dobrý den, ${applicantName},` : "Dobrý den,"} máme pro
        vás termín osobní schůzky kvůli adopci <strong>{animalName}</strong>.
        Těšíme se na setkání!
      </Text>

      <Section style={meetingBox}>
        <Text style={meetingLabelStyle}>Termín</Text>
        <Text style={meetingValue}>{meetingLabel}</Text>
        <Text style={meetingLabelStyle}>Místo</Text>
        <Text style={meetingValue}>{location?.trim() || institutionName}</Text>
      </Section>

      <Text style={styles.paragraph}>
        Vezměte si prosím doklad totožnosti. Pokud vám termín nevyhovuje, ozvěte
        se nám co nejdříve a domluvíme jiný.
      </Text>
      <Text style={styles.muted}>
        Den předem vám ještě pošleme připomínku.
      </Text>
    </EmailLayout>
  );
}

const meetingBox = {
  backgroundColor: COLORS.creamWarm,
  borderRadius: "16px",
  padding: "20px 24px",
  margin: "8px 0 24px",
};

const meetingLabelStyle = {
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  color: COLORS.ink400,
  margin: "0 0 2px",
};

const meetingValue = {
  fontSize: "18px",
  fontWeight: 700,
  color: COLORS.espresso,
  margin: "0 0 14px",
};

export default ApplicationMeetingEmail;
