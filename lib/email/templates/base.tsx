import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

import { COLORS, SITE_URL } from "../config";

interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
}

/**
 * Sdílený rámec všech e-mailů — hlavička s logem, obsah, patička.
 * Vše inline styly kvůli kompatibilitě s e-mailovými klienty.
 */
export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="cs">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Logo */}
          <Section style={{ padding: "8px 0 24px" }}>
            <Link href={SITE_URL} style={logo}>
              zozio<span style={{ color: COLORS.amber }}>.</span>
            </Link>
          </Section>

          {/* Obsah v kartě */}
          <Section style={card}>{children}</Section>

          {/* Patička */}
          <Hr style={hr} />
          <Text style={footer}>
            Zozio — pomáháme zvířatům najít domov.
            <br />
            <Link href={SITE_URL} style={footerLink}>
              zozio.cz
            </Link>{" "}
            ·{" "}
            <Link href={`${SITE_URL}/zasady-soukromi`} style={footerLink}>
              Zásady soukromí
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// --- Sdílené styly pro tělo e-mailů (lze importovat v šablonách) ---

export const styles = {
  heading: {
    fontSize: "24px",
    fontWeight: 700,
    color: COLORS.espresso,
    margin: "0 0 16px",
    lineHeight: "1.3",
  } as const,
  paragraph: {
    fontSize: "16px",
    lineHeight: "1.6",
    color: COLORS.ink600,
    margin: "0 0 16px",
  } as const,
  button: {
    display: "inline-block",
    backgroundColor: COLORS.coral,
    color: COLORS.cream,
    fontSize: "16px",
    fontWeight: 700,
    textDecoration: "none",
    padding: "14px 28px",
    borderRadius: "100px",
  } as const,
  muted: {
    fontSize: "13px",
    lineHeight: "1.5",
    color: COLORS.ink400,
    margin: "16px 0 0",
  } as const,
  link: {
    color: COLORS.coral,
    textDecoration: "underline",
    wordBreak: "break-all" as const,
  } as const,
};

const body = {
  backgroundColor: COLORS.creamWarm,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "32px 0",
};

const container = {
  maxWidth: "520px",
  margin: "0 auto",
  padding: "0 16px",
};

const logo = {
  fontSize: "26px",
  fontWeight: 800,
  color: COLORS.espresso,
  textDecoration: "none",
  letterSpacing: "-0.5px",
};

const card = {
  backgroundColor: COLORS.cream,
  borderRadius: "24px",
  border: `1px solid ${COLORS.border}`,
  padding: "32px",
};

const hr = {
  borderColor: COLORS.border,
  margin: "24px 0 16px",
};

const footer = {
  fontSize: "13px",
  lineHeight: "1.6",
  color: COLORS.ink400,
  textAlign: "center" as const,
  margin: 0,
};

const footerLink = {
  color: COLORS.ink400,
  textDecoration: "underline",
};
