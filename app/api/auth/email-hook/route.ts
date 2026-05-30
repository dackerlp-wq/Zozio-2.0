import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "standardwebhooks";
import type { ReactElement } from "react";

import { SITE_URL } from "@/lib/email/config";
import { sendEmail } from "@/lib/email/send";
import { ConfirmSignupEmail } from "@/lib/email/templates/confirm-signup";
import { ResetPasswordEmail } from "@/lib/email/templates/reset-password";
import { MagicLinkEmail } from "@/lib/email/templates/magic-link";

export const runtime = "nodejs";

/**
 * Supabase „Send Email Hook" — Supabase sem POSTne při každém auth e-mailu
 * (potvrzení registrace, reset hesla, magic link…). My vyrenderujeme branded
 * šablonu a pošleme přes Resend. Odkaz stavíme na náš /auth/callback, takže
 * verifikace probíhá serverově pod naší kontrolou.
 *
 * Konfigurace v Supabase: Authentication → Hooks → Send Email Hook →
 * URL: {SITE_URL}/api/auth/email-hook, secret ulož do SEND_EMAIL_HOOK_SECRET.
 */

interface HookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown> | null;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function buildConfirmationUrl(
  redirectTo: string,
  tokenHash: string,
  type: string,
): string {
  let callback: URL;
  try {
    const raw = new URL(redirectTo || `${SITE_URL}/auth/callback`);
    if (raw.pathname.startsWith("/auth/callback")) {
      callback = raw;
    } else {
      // Cíl není náš callback → prožeň ho callbackem a původní cíl dej jako next
      callback = new URL("/auth/callback", SITE_URL);
      callback.searchParams.set("next", raw.pathname + raw.search);
    }
  } catch {
    callback = new URL("/auth/callback", SITE_URL);
  }
  callback.searchParams.set("token_hash", tokenHash);
  callback.searchParams.set("type", type);
  return callback.toString();
}

export async function POST(request: NextRequest) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) {
    console.error("[email-hook] Chybí SEND_EMAIL_HOOK_SECRET");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const payload = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };

  let data: HookPayload;
  try {
    const wh = new Webhook(secret.replace("v1,whsec_", ""));
    data = wh.verify(payload, headers) as HookPayload;
  } catch (e) {
    console.error("[email-hook] Neplatný podpis:", e);
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const { user, email_data } = data;
  const type = email_data.email_action_type;
  const confirmationUrl = buildConfirmationUrl(
    email_data.redirect_to,
    email_data.token_hash,
    type,
  );

  const isShelter = user.user_metadata?.intended_role === "owner";

  let subject: string;
  let react: ReactElement;
  switch (type) {
    case "recovery":
      subject = "Obnovení hesla — Zozio";
      react = ResetPasswordEmail({ confirmationUrl });
      break;
    case "magiclink":
      subject = "Tvůj přihlašovací odkaz — Zozio";
      react = MagicLinkEmail({ confirmationUrl });
      break;
    case "signup":
    case "invite":
    default:
      subject = "Potvrď svůj e-mail — Zozio";
      react = ConfirmSignupEmail({ confirmationUrl, isShelter });
      break;
  }

  const result = await sendEmail({ to: user.email, subject, react });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
