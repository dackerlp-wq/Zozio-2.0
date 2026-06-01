import { Section, Text } from "@react-email/components";

import { COLORS } from "../config";
import { EmailLayout, styles } from "./base";

interface ApplicationMeetingReminderEmailProps {
  applicantName?: string | null;
  animalName: string;
  institutionName: string;
  meetingLabel: string;
  location?: string | null;
}

/** Připomínka osobní schůzky den předem. */
export function ApplicationMeetingReminderEmail({
  applicantName,
  animalName,
  institutionName,
  meetingLabel,
  location,
}: ApplicationMeetingReminderEmailProps) {
  return (
    <EmailLayout preview={`Připomínka: zítra schůzka kvůli ${animalName}`}>
      <Text style={styles.heading}>Zítra se vidíme ⏰</Text>
      <Text style={styles.paragraph}>
        {applicantName ? `Dobrý den, ${applicantName},` : "Dobrý den,"}{" "}
        připomínáme vám zítřejší osobní schůzku kvůli adopci{" "}
        <strong>{animalName}</strong>.
      </Text>

      <Section style={meetingBox}>
        <Text style={meetingLabelStyle}>Termín</Text>
        <Text style={meetingValue}>{meetingLabel}</Text>
        <Text style={meetingLabelStyle}>Místo</Text>
        <Text style={meetingValue}>{location?.trim() || institutionName}</Text>
      </Section>

      <Text style={styles.paragraph}>
        Nezapomeňte doklad totožnosti. Kdyby se cokoli změnilo, dejte nám prosím
        vědět.
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

export default ApplicationMeetingReminderEmail;
