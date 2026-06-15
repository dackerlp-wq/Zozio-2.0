/**
 * Centrální konfigurace e-mailů (Resend + React Email).
 * Barvy jsou inline hex hodnoty — e-mailoví klienti neumí Tailwind ani CSS
 * proměnné, takže design tokeny držíme tady jako konstanty.
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.zozio.cz";

/** Odesílatel. Doména musí být ověřená v Resendu. */
export const EMAIL_FROM = process.env.EMAIL_FROM || "Zozio <info@zozio.cz>";

/** Adresa pro odpovědi uživatelů. */
export const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || "info@zozio.cz";

/** Barevné tokeny pro e-maily (sladěné s design systémem webu). */
export const COLORS = {
  coral: "#E8634A",
  coralDark: "#D44A30",
  amber: "#F0A500",
  espresso: "#2C1810",
  cream: "#FFFCF8",
  creamWarm: "#F5E6D3",
  ink600: "#6B5346",
  ink400: "#A0928A",
  border: "#EAE0D2",
  teal: "#2E9E8F",
  berry: "#DC2626",
} as const;
