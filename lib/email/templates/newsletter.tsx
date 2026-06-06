import { Hr, Img, Link, Section, Text } from "@react-email/components";

import { EmailLayout } from "./base";

interface NewsletterEmailProps {
  institutionName: string;
  subject: string;
  bodyHtml: string;
  openPixelUrl: string;
  unsubscribeUrl: string;
}

/** Hromadný newsletter útulku — obsah + open-tracking pixel + odhlášení. */
export function NewsletterEmail({
  institutionName,
  subject,
  bodyHtml,
  openPixelUrl,
  unsubscribeUrl,
}: NewsletterEmailProps) {
  return (
    <EmailLayout preview={subject}>
      <Section>
        <Text style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 6px" }}>
          {subject}
        </Text>
        <Text style={{ fontSize: "12px", color: "#8B7355", margin: "0 0 14px" }}>
          {institutionName}
        </Text>
        <div
          style={{ fontSize: "14px", lineHeight: "1.6", color: "#2C1810" }}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </Section>
      <Hr style={{ borderColor: "#F0E8DC", margin: "20px 0" }} />
      <Text style={{ fontSize: "11px", color: "#8B7355" }}>
        Tento e-mail jsi dostal{"(a)"} jako odběratel novinek útulku{" "}
        {institutionName}.{" "}
        <Link href={unsubscribeUrl} style={{ color: "#C44B33" }}>
          Odhlásit odběr
        </Link>
        .
      </Text>
      <Img src={openPixelUrl} width="1" height="1" alt="" />
    </EmailLayout>
  );
}
