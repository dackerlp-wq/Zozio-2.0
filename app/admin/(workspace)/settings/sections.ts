/** Sekce nastavení — sdílené mezi server page, klientským formulářem a sidebarem. */
export type SettingsSection =
  | "profil"
  | "provoz"
  | "evidence"
  | "adopce"
  | "web"
  | "spadova"
  | "dary"
  | "email"
  | "reklamy"
  | "predplatne"
  | "ucet";

export const SETTINGS_SECTIONS: { key: SettingsSection; label: string }[] = [
  { key: "profil", label: "Profil & zveřejnění" },
  { key: "provoz", label: "Provoz" },
  { key: "evidence", label: "Evidence & lhůty" },
  { key: "adopce", label: "Adopce" },
  { key: "web", label: "Web & katalog" },
  { key: "spadova", label: "Spádová oblast" },
  { key: "dary", label: "Dary & platby" },
  { key: "email", label: "E-maily & notifikace" },
  { key: "reklamy", label: "Reklamy" },
  { key: "predplatne", label: "Předplatné" },
  { key: "ucet", label: "Účet & data" },
];
