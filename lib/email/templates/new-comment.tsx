import { Button, Section, Text } from "@react-email/components";

import { SITE_URL } from "../config";
import { EmailLayout, styles } from "./base";

interface NewCommentEmailProps {
  articleTitle: string;
  authorName: string;
  body: string;
  needsApproval: boolean;
  moderationUrl: string;
}

/** Upozornění autora článku na nový komentář (host → čeká na schválení). */
export function NewCommentEmail({
  articleTitle,
  authorName,
  body,
  needsApproval,
  moderationUrl,
}: NewCommentEmailProps) {
  return (
    <EmailLayout preview={`Nový komentář — ${articleTitle}`}>
      <Text style={styles.heading}>💬 Nový komentář</Text>
      <Text style={styles.paragraph}>
        K článku <strong>{articleTitle}</strong> přidal{" "}
        <strong>{authorName}</strong> komentář
        {needsApproval ? " — čeká na schválení." : "."}
      </Text>
      <Text style={{ ...styles.paragraph, fontStyle: "italic" }}>„{body}"</Text>
      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={`${SITE_URL}${moderationUrl}`} style={styles.button}>
          {needsApproval ? "Zkontrolovat a schválit" : "Zobrazit komentáře"}
        </Button>
      </Section>
      <Text style={styles.muted}>
        Komentáře hostů zveřejníte až po schválení. Reakce čtenářů pomáhají zvířatům najít domov.
      </Text>
    </EmailLayout>
  );
}

export default NewCommentEmail;
