import { render } from "@react-email/render";
import type { ReactElement } from "react";

import { EMAIL_FROM, EMAIL_REPLY_TO } from "./config";
import { getResend, isEmailConfigured } from "./resend";

interface SendEmailArgs {
  to: string | string[];
  subject: string;
  react: ReactElement;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer }[];
}

type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

/**
 * Vyrenderuje React Email šablonu na HTML + plain-text a pošle přes Resend.
 * Když není nastaven RESEND_API_KEY, jen zaloguje (dev) místo pádu.
 */
export async function sendEmail({
  to,
  subject,
  react,
  replyTo = EMAIL_REPLY_TO,
  attachments,
}: SendEmailArgs): Promise<SendResult> {
  if (!isEmailConfigured()) {
    console.warn(`[email] RESEND_API_KEY chybí — přeskakuji odeslání "${subject}" na ${to}`);
    return { ok: false, error: "email_not_configured" };
  }

  const [html, text] = await Promise.all([
    render(react),
    render(react, { plainText: true }),
  ]);

  try {
    const { data, error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text,
      replyTo,
      ...(attachments && attachments.length > 0
        ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })) }
        : {}),
    });
    if (error) {
      console.error("[email] Resend error:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id ?? null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Neznámá chyba";
    console.error("[email] send failed:", message);
    return { ok: false, error: message };
  }
}
