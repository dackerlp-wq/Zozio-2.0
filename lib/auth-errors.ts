/**
 * Mapuje Supabase Auth chyby na srozumitelné české hlášky.
 * Necháváme fallback na původní zprávu, ať nikdy neztratíme info.
 */
export function authErrorMessage(raw: string | undefined | null): string {
  if (!raw) return "Něco se pokazilo. Zkus to prosím znovu.";
  const m = raw.toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "Nesprávný e-mail nebo heslo.";
  }
  if (m.includes("email not confirmed")) {
    return "E-mail ještě není potvrzený. Zkontroluj svou schránku a klikni na potvrzovací odkaz.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Účet s tímto e-mailem už existuje. Přihlas se.";
  }
  if (m.includes("password should be at least")) {
    return "Heslo musí mít alespoň 8 znaků.";
  }
  if (m.includes("unable to validate email address") || m.includes("invalid email")) {
    return "Zadej platnou e-mailovou adresu.";
  }
  if (m.includes("rate limit") || m.includes("for security purposes")) {
    return "Příliš mnoho pokusů. Zkus to prosím za chvíli znovu.";
  }
  if (m.includes("same as the old password") || m.includes("should be different")) {
    return "Nové heslo musí být jiné než to staré.";
  }
  if (m.includes("token has expired") || m.includes("expired or is invalid")) {
    return "Odkaz vypršel nebo už byl použit. Vyžádej si nový.";
  }

  return raw;
}
