import { Resend } from "resend";

let client: Resend | null = null;

/**
 * Líně inicializovaný Resend klient. Vyhazuje srozumitelnou chybu, když chybí
 * API klíč (např. v dev bez nastaveného .env.local).
 */
export function getResend(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("Chybí RESEND_API_KEY — nastav ho v env proměnných.");
    }
    client = new Resend(apiKey);
  }
  return client;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
