/**
 * Oprávnění rolí útulku — jediný zdroj pravdy pro UI i server.
 *
 * 4 role: owner (Vlastník), admin (Správce), staff (Personál),
 * volunteer (Dobrovolník). Matice (oblast × role) určuje viditelnost
 * a akce; server akce ji vynucují přes `requirePermission` (lib/auth).
 */
import type { MemberRole } from "@/types/database";

export type PermLevel = "full" | "view" | "none";

export type PermArea =
  | "animals_view"
  | "animals_edit"
  | "animals_status"
  | "health"
  | "kennels"
  | "foster"
  | "tasks_fulfill"
  | "tasks_manage"
  | "applications_view"
  | "applications_screen"
  | "web"
  | "finance"
  | "stats"
  | "exports"
  | "settings"
  | "team"
  | "billing"
  | "delete_institution";

const ALL: Record<MemberRole, PermLevel> = { owner: "full", admin: "full", staff: "full", volunteer: "full" };
const VAS: Record<MemberRole, PermLevel> = { owner: "full", admin: "full", staff: "full", volunteer: "none" };
const VA: Record<MemberRole, PermLevel> = { owner: "full", admin: "full", staff: "none", volunteer: "none" };
const OWNER: Record<MemberRole, PermLevel> = { owner: "full", admin: "none", staff: "none", volunteer: "none" };

export const PERMISSIONS: Record<PermArea, Record<MemberRole, PermLevel>> = {
  animals_view: ALL,
  animals_edit: VAS,
  animals_status: VAS,
  health: VAS,
  kennels: VAS,
  foster: VAS,
  tasks_fulfill: ALL,
  tasks_manage: VAS,
  applications_view: VAS,
  applications_screen: VA,
  web: VA,
  finance: VA,
  stats: { owner: "full", admin: "full", staff: "view", volunteer: "none" },
  exports: VAS,
  settings: VA,
  team: VA,
  billing: OWNER,
  delete_institution: OWNER,
};

/** Plné oprávnění (zápis) v dané oblasti. */
export function can(role: MemberRole, area: PermArea): boolean {
  return PERMISSIONS[area][role] === "full";
}

/** Aspoň náhled (zobrazit) v dané oblasti. */
export function canView(role: MemberRole, area: PermArea): boolean {
  return PERMISSIONS[area][role] !== "none";
}

// --- Popisky a vzhled rolí (žádná modrá ani teal) --------------------------

export const ROLE_ORDER: MemberRole[] = ["owner", "admin", "staff", "volunteer"];

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Vlastník",
  admin: "Správce",
  staff: "Personál",
  volunteer: "Dobrovolník",
};

export const ROLE_BADGE: Record<MemberRole, string> = {
  owner: "bg-meadow-50 text-meadow-700",
  admin: "bg-sand text-ink-700",
  staff: "bg-cream-warm text-ink-600",
  volunteer: "bg-sunshine-200 text-sunshine-600",
};

/** Role, které lze přidělit při pozvání (vlastníka nelze pozvat). */
export const ASSIGNABLE_ROLES: MemberRole[] = ["admin", "staff", "volunteer"];

// --- Souhrnné karty „Co která role může" -----------------------------------

export const ROLE_CARDS: Record<MemberRole, { text: string; ok: boolean }[]> = {
  owner: [
    { text: "Vše včetně předplatného", ok: true },
    { text: "Správa týmu a rolí", ok: true },
    { text: "Smazání útulku", ok: true },
    { text: "Nastavení útulku", ok: true },
  ],
  admin: [
    { text: "Zvířata, adopce, provoz", ok: true },
    { text: "Web, sbírky, statistiky", ok: true },
    { text: "Správa týmu (kromě vlastníka)", ok: true },
    { text: "Předplatné a smazání útulku", ok: false },
  ],
  staff: [
    { text: "Zvířata, péče, úkoly", ok: true },
    { text: "Karanténa, kotce, pěstouni", ok: true },
    { text: "Nastavení, tým, předplatné", ok: false },
    { text: "Sbírky a finance", ok: false },
  ],
  volunteer: [
    { text: "Náhled zvířat a úkolů", ok: true },
    { text: "Plnění přiřazených úkolů", ok: true },
    { text: "Úpravy evidence a stavů", ok: false },
    { text: "Nastavení a finance", ok: false },
  ],
};

// --- Detailní matice pro tabulku -------------------------------------------

export const PERMISSION_MATRIX: {
  group: string;
  rows: { area: PermArea; label: string }[];
}[] = [
  {
    group: "Zvířata & provoz",
    rows: [
      { area: "animals_view", label: "Zobrazit zvířata" },
      { area: "animals_edit", label: "Přidat / upravit zvíře" },
      { area: "animals_status", label: "Změnit stav zvířete (příjem, adopce, úhyn…)" },
      { area: "health", label: "Zdraví & karanténa" },
      { area: "kennels", label: "Kotce — přesuny" },
      { area: "foster", label: "Pěstouni — umísťování" },
      { area: "tasks_fulfill", label: "Úkoly — plnit přiřazené" },
      { area: "tasks_manage", label: "Úkoly — vytvářet a přiřazovat" },
    ],
  },
  {
    group: "Adopce & žádosti",
    rows: [
      { area: "applications_view", label: "Zobrazit žádosti" },
      { area: "applications_screen", label: "Skríning, schvalovat / zamítat" },
    ],
  },
  {
    group: "Web & finance",
    rows: [
      { area: "web", label: "Web & obsah" },
      { area: "finance", label: "Sbírky, dárci, finance" },
      { area: "stats", label: "Statistiky" },
      { area: "exports", label: "Evidence & exporty (KVS)" },
    ],
  },
  {
    group: "Systém",
    rows: [
      { area: "settings", label: "Nastavení útulku" },
      { area: "team", label: "Správa týmu a rolí" },
      { area: "billing", label: "Předplatné a fakturace" },
      { area: "delete_institution", label: "Smazání útulku" },
    ],
  },
];
