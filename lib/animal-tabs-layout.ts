/**
 * Stavově řízené rozložení záložek karty zvířete + odvození „dalšího kroku".
 *
 * Čistá funkce bez side-efektů a bez DB — používá ji jak lišta záložek
 * (`AnimalTabs`), tak render obsahu (zamčená záložka nesmí jít otevřít) a
 * Přehled (gate chipy, „Co teď"). Veškeré popisky stavů jdou z `lib/format.ts`.
 */
import { blockers, type ReadinessItem } from "@/lib/animal-readiness";
import type {
  AdoptionStatus,
  AnimalLegalStatus,
  AnimalSupervisionStatus,
} from "@/types/database";

export type TabState =
  | "primary" // kde je teď práce (korálová)
  | "available" // klikni kdykoli
  | "locked" // vidět + důvod, nejde editovat
  | "overflow" // schované pod „Více ⋯"
  | "hidden"; // nevykresluje se

export type TabAttention = "urgent" | undefined;

export interface TabLayout {
  tab: string;
  state: TabState;
  /** U `locked` — proč je zamčená. */
  reason?: string;
  /** U `locked` — segment, kam jít, aby se odemklo. */
  unlockTab?: string;
  /** Červená tečka „vyžaduje pozornost". */
  attention?: TabAttention;
}

/** Popisky segmentů (jediný zdroj pravdy pro lištu i LockedTabNotice). */
export const TAB_LABEL: Record<string, string> = {
  "": "Přehled",
  profil: "Profil",
  prijem: "Příjem & právo",
  zdravi: "Zdraví",
  karantena: "Karanténa",
  pestoun: "Pěstoun",
  adopce: "Adopce",
  ustajeni: "Ustájení",
  evidence: "Náklady",
  dokumenty: "Dokumenty",
  historie: "Historie",
};

/** Kanonické pořadí záložek (lišta se čte zleva doprava jako cesta zvířete). */
export const TAB_ORDER: string[] = [
  "",
  "profil",
  "prijem",
  "zdravi",
  "karantena",
  "pestoun",
  "adopce",
  "ustajeni",
  "evidence",
  "dokumenty",
  "historie",
];

/** Tři kotvy jsou vždy dostupné. */
const CORE = new Set(["", "profil", "historie"]);

/**
 * „Uzavřeno" = zvíře opustilo útulek nebo zemřelo. Pozn.: zahrnuje i
 * `returned`, který `isTerminalAdoptionStatus` (jen pro zámky akcí) nebere —
 * tady je z pohledu karty také uzavřený (read-only).
 */
export function isClosedStatus(s: AdoptionStatus): boolean {
  return (
    s === "adopted" || s === "transferred" || s === "deceased" || s === "returned"
  );
}

export interface TabsLayoutInput {
  adoptionStatus: AdoptionStatus;
  legalStatus: AnimalLegalStatus;
  supervisionStatus: AnimalSupervisionStatus;
  kennelId: string | null;
  /** Režim ustájení útulku — řídí prominenci Pěstoun/Ustájení. */
  housingMode?: "physical" | "foster_network" | "hybrid";
  /** Je pěstounská péče v útulku zapnutá? (false → Pěstoun skrytý) */
  fosterEnabled?: boolean;
  /** Existuje historie v jednotlivých modulech (pro skrývání záložek). */
  history: {
    foster: boolean;
    quarantine: boolean;
    adoption: boolean;
    exit: boolean;
    trial: boolean;
    /** Poslední pozorování dohledu má flag „sledovat". */
    quarantineWatch?: boolean;
  };
  readiness: ReadinessItem[];
}

const PROTECTION_LOCK_REASON =
  "Probíhá ochranná lhůta — adopci nelze zahájit, dokud lhůta neskončí.";

/**
 * Vrátí rozložení záložek (stav + pozornost + důvod zámku) v kanonickém
 * pořadí. Role strukturu nemění (staff vidí totéž co admin), liší se jen
 * dostupnost akcí uvnitř.
 */
export function getAnimalTabsLayout(input: TabsLayoutInput): TabLayout[] {
  const {
    adoptionStatus: status,
    legalStatus,
    supervisionStatus,
    kennelId,
    history,
    readiness,
  } = input;

  const inProtection = legalStatus === "in_protection";
  const inQuarantine =
    supervisionStatus === "quarantine" || supervisionStatus === "isolation";
  const closed = isClosedStatus(status);
  const karantenaVisible =
    inQuarantine || supervisionStatus === "monitored" || history.quarantine;

  const hardPublish = blockers(readiness, "publish");
  const firstHardResolve = hardPublish.find((b) => b.resolve)?.resolve ?? null;
  const softOpen = readiness.filter((i) => i.severity === "soft" && !i.ok);
  const adoptStartReady = blockers(readiness, "adopt_start").length === 0;

  // Výchozí: kotvy dostupné, ostatní pod „Více".
  const state: Record<string, TabState> = {};
  for (const seg of TAB_ORDER) {
    state[seg] = CORE.has(seg) ? "available" : "overflow";
  }
  const set = (seg: string, s: TabState) => {
    state[seg] = s;
  };

  // Pomocná: nastav karanténu na viditelnost, ale nepřepisuj, když je primary.
  const setKarantena = (s: TabState) => {
    if (state.karantena !== "primary") {
      set("karantena", karantenaVisible ? s : "hidden");
    }
  };

  if (closed) {
    // Režim jen ke čtení — lišta se smrští na to, co má smysl dohledat.
    for (const seg of TAB_ORDER) {
      state[seg] = CORE.has(seg) ? "available" : "hidden";
    }
    set("", "primary");
    set("dokumenty", "available");
    if (history.foster) set("pestoun", "available");
    if (history.adoption || history.exit) set("adopce", "available");
    if (history.quarantine) set("karantena", "available");
    if (kennelId) set("ustajeni", "available");
  } else if (status === "foster") {
    // Dočasná péče je těžiště (povolená i v ochranné lhůtě).
    set("pestoun", "primary");
    set("zdravi", "available");
    set("adopce", inProtection ? "locked" : "overflow");
    setKarantena("overflow");
  } else if (status === "reserved") {
    set("adopce", "primary");
    set("pestoun", "available");
    setKarantena("overflow");
  } else if (inProtection) {
    set("prijem", "primary");
    set("pestoun", "available"); // dočasná péče je během lhůty povolená
    set("zdravi", "available");
    set("adopce", "locked");
    setKarantena("available");
  } else if (
    status === "intake" ||
    status === "on_hold" ||
    status === "unpublished"
  ) {
    // Připravuje se. Primární = záložka řešící nesplněný tvrdý bod,
    // jinak měkký bod (typicky očkování → Zdraví), jinak Přehled.
    let primary = "";
    if (firstHardResolve) primary = firstHardResolve;
    else if (softOpen[0]?.resolve) primary = softOpen[0].resolve;
    set(primary, "primary");
    if (state.prijem !== "primary") set("prijem", "available");
    if (state.zdravi !== "primary") set("zdravi", "available");
    if (state.adopce !== "primary") {
      set("adopce", adoptStartReady ? "available" : "overflow");
    }
    if (state.ustajeni !== "primary") {
      set("ustajeni", kennelId ? "available" : "overflow");
    }
    setKarantena("available");
  } else if (status === "available") {
    set("adopce", "primary");
    set("zdravi", "available");
    set("prijem", "overflow");
    setKarantena("overflow");
  } else {
    setKarantena("available");
  }

  // Režim ustájení útulku.
  const housingMode = input.housingMode ?? "physical";
  const fosterEnabled = input.fosterEnabled ?? true;
  if (!fosterEnabled) {
    set("pestoun", "hidden");
  } else if (housingMode === "foster_network") {
    // Pěstoun = běžné ustájení → prominentní; kotce skryté.
    set("ustajeni", "hidden");
    if (!closed && state.pestoun !== "primary") {
      const preparing =
        status === "intake" || status === "on_hold" || status === "unpublished";
      set("pestoun", preparing ? "primary" : "available");
    }
  }

  // Pozornostní tečky (zachované chování).
  const att: Record<string, TabAttention> = {};
  if (inQuarantine || history.quarantineWatch) att.karantena = "urgent";
  if (inProtection) att.prijem = "urgent";
  if (history.trial) att.adopce = "urgent";

  return TAB_ORDER.map((seg) => {
    const layout: TabLayout = { tab: seg, state: state[seg] };
    if (att[seg]) layout.attention = att[seg];
    if (seg === "adopce" && state[seg] === "locked") {
      layout.reason = PROTECTION_LOCK_REASON;
      layout.unlockTab = "prijem";
    }
    return layout;
  });
}

// --- Hradla pro Přehled (gate chipy) --------------------------------------

export interface GateView {
  ok: boolean;
  reasons: string[];
}

/**
 * Stav tří hradel pro vizuální chipy. Ochranná lhůta tvrdě blokuje všechna
 * tři (zveřejnění i adopci) — sjednoceno s logikou v `changeAnimalStatus`
 * a `startAdoption`/`finalizeAdoption`.
 */
export function evaluateGates(
  readiness: ReadinessItem[],
  inProtection: boolean,
): { publish: GateView; adopt_start: GateView; adopt_finalize: GateView } {
  const mk = (gate: "publish" | "adopt_start" | "adopt_finalize"): GateView => {
    const reasons: string[] = [];
    if (inProtection) reasons.push("ochranná lhůta");
    for (const b of blockers(readiness, gate)) {
      reasons.push(b.label.toLowerCase());
    }
    return { ok: reasons.length === 0, reasons };
  };
  return {
    publish: mk("publish"),
    adopt_start: mk("adopt_start"),
    adopt_finalize: mk("adopt_finalize"),
  };
}

// --- „Co teď" — jeden doporučený krok -------------------------------------

export interface NextStep {
  label: string;
  targetTab: string;
  blockedReason?: string;
}

export interface NextStepInput {
  adoptionStatus: AdoptionStatus;
  legalStatus: AnimalLegalStatus;
  readiness: ReadinessItem[];
  name?: string;
}

/** Odvodí jednu lidskou větu „co teď udělat". */
export function getNextStep(input: NextStepInput): NextStep {
  const { adoptionStatus: status, legalStatus, readiness } = input;
  const name = input.name?.trim() || "zvíře";
  const inProtection = legalStatus === "in_protection";

  if (isClosedStatus(status)) {
    return { label: "Případ je uzavřen — karta je jen ke čtení.", targetTab: "" };
  }

  if (inProtection) {
    return {
      label: `Probíhá ochranná lhůta. Po jejím konci převeď ${name} do vlastnictví útulku.`,
      targetTab: "prijem",
      blockedReason: "ochranná lhůta",
    };
  }

  const hardOpen = readiness.filter((i) => i.severity === "hard" && !i.ok);
  if (hardOpen.length > 0) {
    const it = hardOpen[0];
    return {
      label: `Vyřeš: ${it.label.toLowerCase()}.`,
      targetTab: it.resolve ?? "",
    };
  }

  const softOpen = readiness.filter((i) => i.severity === "soft" && !i.ok);

  if (status === "intake" || status === "on_hold" || status === "unpublished") {
    if (softOpen.length > 0 && softOpen[0].resolve) {
      return {
        label: `Doplň: ${softOpen[0].label.toLowerCase()} — pak bude ${name} připravená k adopci.`,
        targetTab: softOpen[0].resolve,
      };
    }
    return {
      label: `${name} je připravená — zveřejni ji jako „K adopci".`,
      targetTab: "",
    };
  }

  if (status === "available") {
    return { label: `${name} je k adopci a čeká na zájemce.`, targetTab: "adopce" };
  }
  if (status === "reserved") {
    return {
      label: "Probíhá adopce — po zkušební době ji uzavři, nebo zvíře vrať.",
      targetTab: "adopce",
    };
  }
  if (status === "foster") {
    return { label: `${name} je v dočasné péči u pěstouna.`, targetTab: "pestoun" };
  }

  return { label: "Vše vyřízeno.", targetTab: "" };
}
