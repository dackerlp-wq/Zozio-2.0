"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Upload,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ApplicationQuestionRow, MemberRole, VerificationStatus } from "@/types/database";
import { deleteInstitution, updateSettings, type SettingsValues } from "./actions";
import { SETTINGS_SECTIONS, type SettingsSection } from "./sections";
import { MunicipalitiesPanel } from "./municipalities-panel";
import { ApplicationQuestionsManager } from "./application-questions-manager";

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  standard: "Profi",
  pro: "Komplet",
};

export function SettingsForm({
  initial,
  section,
  role,
  plan,
  institutionName,
  verificationStatus,
  questions,
}: {
  initial: SettingsValues;
  section: SettingsSection;
  role: MemberRole;
  plan: string;
  institutionName: string;
  verificationStatus: VerificationStatus;
  questions: ApplicationQuestionRow[];
}) {
  const [v, setV] = useState<SettingsValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const [isPending, startTransition] = useTransition();

  const canPublish = verificationStatus === "approved";
  const isOwner = role === "owner";
  const isProfiPlus = plan === "standard" || plan === "pro";
  const isKomplet = plan === "pro";

  const set = <K extends keyof SettingsValues>(k: K, val: SettingsValues[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  async function upload(kind: "logo" | "cover", file: File) {
    setUploading(kind);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload selhal");
      set(kind === "logo" ? "logo_url" : "hero_url", data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload selhal");
    } finally {
      setUploading(null);
    }
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await updateSettings(v);
      if ("error" in r) setError(r.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    });
  }

  const sectionLabel = SETTINGS_SECTIONS.find((s) => s.key === section)?.label ?? "";

  return (
    <div className="pb-28">
      <div className="mb-5">
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
          Nastavení útulku
        </h2>
        <p className="mt-1 text-ink-600">{sectionLabel}</p>
      </div>

      <div className="max-w-3xl space-y-4">
        {section === "profil" && (
          <>
            <Card>
              <Toggle
                checked={v.is_published}
                disabled={!canPublish}
                onChange={(b) => set("is_published", b)}
                title="Zveřejnit útulek na zozio.cz"
                desc="Když je zapnuto, profil a zvířata se zobrazují veřejně v katalogu. Bez toho tě adoptanti nenajdou."
              />
              {!canPublish && (
                <p className="mt-2 text-sm font-medium text-sunshine-600">
                  Útulek půjde zveřejnit až po ověření.
                </p>
              )}
            </Card>
            <Card title="🏠 Veřejný profil" desc="Tyto údaje se zobrazují na veřejném profilu útulku.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Logo">
                  <UploadBox
                    url={v.logo_url}
                    busy={uploading === "logo"}
                    round
                    onPick={(f) => upload("logo", f)}
                    onClear={() => set("logo_url", "")}
                  />
                </Field>
                <Field label="Úvodní fotka (cover)">
                  <UploadBox
                    url={v.hero_url}
                    busy={uploading === "cover"}
                    onPick={(f) => upload("cover", f)}
                    onClear={() => set("hero_url", "")}
                  />
                </Field>
              </div>
              <Field label="Název útulku *">
                <Input required value={v.name} onChange={(e) => set("name", e.target.value)} className="admin-input" />
              </Field>
              <Field label="Popis">
                <textarea value={v.description} onChange={(e) => set("description", e.target.value)} rows={3} className="admin-input resize-y" placeholder="Krátké představení útulku…" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Telefon"><Input value={v.phone} onChange={(e) => set("phone", e.target.value)} className="admin-input" /></Field>
                <Field label="E-mail"><Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} className="admin-input" /></Field>
                <Field label="Web"><Input value={v.website} onChange={(e) => set("website", e.target.value)} className="admin-input" placeholder="https://" /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Adresa"><Input value={v.address} onChange={(e) => set("address", e.target.value)} className="admin-input" /></Field>
                <Field label="Otevírací doba"><Input value={v.opening_hours} onChange={(e) => set("opening_hours", e.target.value)} className="admin-input" placeholder="Po–Pá 9–17…" /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Rok založení">
                  <Input
                    type="number"
                    min={1800}
                    max={new Date().getFullYear()}
                    value={v.founded_year ?? ""}
                    onChange={(e) => set("founded_year", e.target.value ? Number(e.target.value) : null)}
                    className="admin-input"
                    placeholder="např. 1998 — zobrazí se na veřejném profilu"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Facebook"><Input value={v.facebook_url} onChange={(e) => set("facebook_url", e.target.value)} className="admin-input" /></Field>
                <Field label="Instagram"><Input value={v.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} className="admin-input" /></Field>
              </div>
            </Card>
          </>
        )}

        {section === "provoz" && (
          <Card title="⚙️ Provoz" desc="Tato volba určuje, jaké sekce a funkce se v Zoziu zobrazují.">
            <Field label="Režim ustájení">
              <div className="grid gap-2 sm:grid-cols-3">
                {([
                  ["physical", "🏘️ Kamenný", "kotce"],
                  ["foster_network", "🏡 Pěstounská síť", "bez kotců"],
                  ["hybrid", "🔀 Hybrid", "kotce + pěstouni"],
                ] as const).map(([val, label, sub]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => set("housing_mode", val)}
                    className={cn(
                      "rounded-2xl border-[1.5px] p-3 text-center transition-colors",
                      v.housing_mode === val
                        ? "border-meadow-500 bg-meadow-50 text-meadow-700"
                        : "border-ink-900/15 bg-cream text-ink-700 hover:border-meadow-500",
                    )}
                  >
                    <div className="text-sm font-bold">{label}</div>
                    <div className="text-xs text-ink-500">{sub}</div>
                  </button>
                ))}
              </div>
            </Field>
            <Toggle
              checked={v.foster_enabled}
              onChange={(b) => set("foster_enabled", b)}
              title="Pěstounská péče zapnuta"
              desc="Zpřístupní modul Pěstouni a umísťování zvířat k pěstounům."
            />
          </Card>
        )}

        {section === "evidence" && (
          <Card title="📋 Evidence & lhůty" desc="Nastavení pro zákonnou evidenci a stavovou logiku zvířat.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ochranná lhůta (měsíce)">
                <Input type="number" min={1} max={24} value={v.protection_period_months} onChange={(e) => set("protection_period_months", e.target.value ? Number(e.target.value) : 4)} className="admin-input" />
                <p className="mt-1 text-xs text-ink-500">Výchozí lhůta nalezence (lze přepsat u konkrétního zvířete).</p>
              </Field>
              <Field label="Formát čísla zvířete">
                <Input value={v.record_number_format} onChange={(e) => set("record_number_format", e.target.value)} className="admin-input" placeholder="YYYY/0001" />
                <p className="mt-1 text-xs text-ink-500">Např. 2026/0042.</p>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Evidenční / registrační číslo"><Input value={v.registration_number} onChange={(e) => set("registration_number", e.target.value)} className="admin-input" /></Field>
              <Field label="Příslušná KVS (kraj)"><Input value={v.kvs_region} onChange={(e) => set("kvs_region", e.target.value)} className="admin-input" placeholder="Středočeský kraj…" /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="IČO"><Input value={v.ico} onChange={(e) => set("ico", e.target.value)} className="admin-input" /></Field>
              <Field label="Právní forma"><Input value={v.legal_form} onChange={(e) => set("legal_form", e.target.value)} className="admin-input" placeholder="spolek / s.r.o. / o.p.s." /></Field>
            </div>
            <Toggle checked={v.staff_can_manage_legal} onChange={(b) => set("staff_can_manage_legal", b)} title="Zaměstnanci mohou spravovat právní stav" desc="Když je vypnuto, právní stav a lhůtu mění jen vlastník a správce." />
          </Card>
        )}

        {section === "adopce" && (
          <Card title="🤝 Adopce" desc="Jak fungují veřejné žádosti o adopci.">
            <Toggle checked={v.accept_web_applications} onChange={(b) => set("accept_web_applications", b)} title="Přijímat žádosti z webu" desc="Návštěvníci mohou podat žádost přímo z profilu zvířete." />
            <Toggle checked={v.screening_form_enabled} onChange={(b) => set("screening_form_enabled", b)} title="Skríningový formulář" desc="Doplňující otázky pro žadatele (bydlení, zkušenosti, jiná zvířata)." />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Výchozí zkušební doba (dní)"><Input type="number" min={0} value={v.trial_period_days} onChange={(e) => set("trial_period_days", e.target.value ? Number(e.target.value) : 0)} className="admin-input" /></Field>
              <Field label="Výchozí adopční poplatek (Kč)"><Input type="number" min={0} value={v.adoption_fee_default ?? ""} onChange={(e) => set("adoption_fee_default", e.target.value ? Number(e.target.value) : null)} className="admin-input" placeholder="0" /></Field>
            </div>
            <Field label="Šablona adopční smlouvy (URL)"><Input value={v.contract_template_url} onChange={(e) => set("contract_template_url", e.target.value)} className="admin-input" placeholder="https://…" /></Field>
            <Toggle checked={v.foster_fee_enabled} onChange={(b) => set("foster_fee_enabled", b)} title="Vybírat poplatek i u dočasné péče" desc="Některé útulky účtují poplatek také pěstounům." />
            <ApplicationQuestionsManager questions={questions} />
          </Card>
        )}

        {section === "web" && (
          <Card title="🌐 Web & katalog" desc="Co se zobrazuje veřejně a kde.">
            <Toggle checked={v.show_protected_in_catalog} onChange={(b) => set("show_protected_in_catalog", b)} title="Zobrazovat nalezence" desc="Nalezená zvířata v ochranné lhůtě se ukáží veřejně jako nalezenci." />
            <Toggle checked={v.widget_enabled} onChange={(b) => set("widget_enabled", b)} title="Embed widget na vlastní web" desc="Zobraz svá zvířata na svém webu přes vložený kód." />
            <Toggle
              checked={!!v.custom_domain && isKomplet}
              disabled={!isKomplet}
              onChange={(b) => set("custom_domain", b ? v.custom_domain || "muj-utulek.cz" : "")}
              title="Vlastní doména"
              desc="Veřejný profil na vaší doméně (white-label)."
              tag="Komplet"
            />
            {isKomplet && (
              <Field label="Vlastní doména"><Input value={v.custom_domain} onChange={(e) => set("custom_domain", e.target.value)} className="admin-input" placeholder="muj-utulek.cz" /></Field>
            )}
          </Card>
        )}

        {section === "spadova" && (
          <Card title="🗺️ Spádová oblast" desc="Obce, které váš útulek pokrývá — zobrazí se na veřejné mapě.">
            <MunicipalitiesPanel />
          </Card>
        )}

        {section === "dary" && (
          <Card title="💝 Dary & platby" desc="Napojení sbírek a darů. Zozio si z darů nebere nic." tag="Profi+">
            {isProfiPlus ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Darujme.cz — ID organizace"><Input value={v.darujme_org_id} onChange={(e) => set("darujme_org_id", e.target.value)} className="admin-input" /></Field>
                <Field label="Bankovní účet pro dary"><Input value={v.bank_account} onChange={(e) => set("bank_account", e.target.value)} className="admin-input" placeholder="000000/0000" /></Field>
              </div>
            ) : (
              <LockedNote text="Dary a platby jsou dostupné od tarifu Profi+." />
            )}
          </Card>
        )}

        {section === "email" && (
          <Card title="✉️ E-maily & notifikace" desc="Odesílatel a automatické e-maily.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Odesílatel (FROM)"><Input value={v.email_from} onChange={(e) => set("email_from", e.target.value)} className="admin-input" placeholder="Zozio <info@zozio.cz>" /></Field>
              <Field label="Odpovědi na (reply-to)"><Input value={v.email_reply_to} onChange={(e) => set("email_reply_to", e.target.value)} className="admin-input" placeholder="vas@email.cz" /></Field>
            </div>
            <Toggle checked={v.auto_emails_enabled} onChange={(b) => set("auto_emails_enabled", b)} title="Automatické e-maily žadatelům" desc="Potvrzení, schválení, zamítnutí žádosti." />
            <Toggle checked={v.task_digest_enabled} onChange={(b) => set("task_digest_enabled", b)} title="Ranní souhrn úkolů" desc="Denní e-mail s úkoly na dnešek." />
          </Card>
        )}

        {section === "reklamy" && (
          <Card title="📢 Reklamy" desc="Řízeno tarifem.">
            <div className="flex items-start gap-3 border-b border-ink-900/8 py-3">
              <div className="flex-1">
                <div className="font-semibold text-ink-900">Profil a zvířata bez reklam</div>
                <p className="text-sm text-ink-500">Aktivní v placených tarifech.</p>
              </div>
              <span className={cn("text-sm font-bold", isProfiPlus ? "text-meadow-700" : "text-ink-400")}>
                {isProfiPlus ? `✓ aktivní (${PLAN_LABEL[plan]})` : "neaktivní"}
              </span>
            </div>
            <Toggle
              checked={v.custom_ads_enabled && isKomplet}
              disabled={!isKomplet}
              onChange={(b) => set("custom_ads_enabled", b)}
              title="Vlastní reklamy útulku"
              desc="Banner pro vlastní sbírky, akce, sponzory."
              tag="Komplet"
            />
          </Card>
        )}

        {section === "predplatne" && (
          <Card title="💳 Předplatné" desc="Aktuální tarif a fakturace.">
            <div className="flex items-start gap-3 border-b border-ink-900/8 py-3">
              <div className="flex-1">
                <div className="font-semibold text-ink-900">
                  Tarif {PLAN_LABEL[plan]}{" "}
                  <span className="rounded-pill bg-sunshine-200 px-2 py-0.5 text-[10px] font-bold text-sunshine-600">−50 % neziskovka</span>
                </div>
                <p className="text-sm text-ink-500">Správa tarifu a plateb.</p>
              </div>
              <span className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-bold text-ink-400">
                Brzy
              </span>
            </div>
            <div className="flex items-start gap-3 py-3">
              <div className="flex-1">
                <div className="font-semibold text-ink-900">Faktury</div>
                <p className="text-sm text-ink-500">Historie plateb ke stažení.</p>
              </div>
              <span className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-bold text-ink-400">Brzy</span>
            </div>
          </Card>
        )}

        {section === "ucet" && (
          <Card title="🔒 Účet & data" desc="Jazyk, zabezpečení a správa dat." danger>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Jazyk">
                <select value={v.locale} onChange={(e) => set("locale", e.target.value)} className="admin-input">
                  <option value="cs">Čeština</option>
                  <option value="sk">Slovenština</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field label="Časové pásmo">
                <select value={v.timezone} onChange={(e) => set("timezone", e.target.value)} className="admin-input">
                  <option value="Europe/Prague">Praha (CET)</option>
                  <option value="Europe/Bratislava">Bratislava (CET)</option>
                </select>
              </Field>
            </div>
            <ActionRow title="Změna hesla" desc="Aktualizuj přihlašovací heslo." href="/auth/forgot-password" label="Změnit heslo" />
            <ActionRow title="Export všech dat" desc="Kompletní data útulku (GDPR / záloha)." href="/admin/exports" label="Exportovat" />
            <DangerZone isOwner={isOwner} institutionName={institutionName} />
          </Card>
        )}
      </div>

      {/* Lepkavá save lišta (kromě čistě informačních sekcí) */}
      {section !== "predplatne" && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-ink-900/8 bg-cream/95 px-4 py-3 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <span className="text-sm text-ink-500">Změny se uloží až po potvrzení.</span>
            {error && (
              <span className="inline-flex items-center gap-1.5 text-sm text-terracotta-600">
                <AlertCircle className="size-4" /> {error}
              </span>
            )}
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-meadow-700">
                <CheckCircle2 className="size-4" /> Uloženo
              </span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={isPending || !!uploading || !v.name.trim()}
              className="ml-auto rounded-pill bg-meadow-500 px-6 py-3 text-sm font-bold text-cream shadow-soft-md hover:bg-meadow-600 disabled:opacity-50"
            >
              {isPending ? "Ukládám…" : "Uložit nastavení"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  title,
  desc,
  tag,
  danger,
  children,
}: {
  title?: string;
  desc?: string;
  tag?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-3xl bg-cream p-6 ring-1", danger ? "ring-terracotta-400/40" : "ring-ink-900/8")}>
      {title && (
        <h2 className={cn("flex items-center gap-2 font-display text-lg font-bold", danger ? "text-terracotta-600" : "text-ink-900")}>
          {title}
          {tag && <span className="rounded-pill bg-sunshine-200 px-2 py-0.5 text-[10px] font-bold text-sunshine-600">{tag}</span>}
        </h2>
      )}
      {desc && <p className="mb-4 mt-0.5 text-sm text-ink-500">{desc}</p>}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  desc,
  disabled,
  tag,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  title: string;
  desc: string;
  disabled?: boolean;
  tag?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1">
        <div className="flex items-center gap-2 font-semibold text-ink-900">
          {title}
          {tag && <span className="rounded-pill bg-sunshine-200 px-2 py-0.5 text-[10px] font-bold text-sunshine-600">{tag}</span>}
        </div>
        <p className="text-sm text-ink-500">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-pill transition-colors disabled:opacity-40",
          checked ? "bg-meadow-500" : "bg-ink-900/20",
        )}
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-cream transition-all", checked ? "right-0.5" : "left-0.5")} />
      </button>
    </div>
  );
}

function UploadBox({
  url,
  busy,
  round,
  onPick,
  onClear,
}: {
  url: string;
  busy: boolean;
  round?: boolean;
  onPick: (f: File) => void;
  onClear: () => void;
}) {
  if (url) {
    return (
      <div className={cn("relative overflow-hidden ring-1 ring-ink-900/10", round ? "size-20 rounded-2xl" : "h-20 w-full rounded-2xl")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="size-full object-cover" />
        <button type="button" onClick={onClear} className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-ink-900/70 text-cream">
          <X className="size-3.5" />
        </button>
      </div>
    );
  }
  return (
    <label className={cn("inline-flex cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed border-ink-900/15 text-ink-400 hover:border-meadow-500 hover:text-meadow-700", round ? "size-20 rounded-2xl" : "h-20 w-full rounded-2xl", busy && "pointer-events-none opacity-60")}>
      {busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onPick(e.target.files[0]); }} />
    </label>
  );
}

function LockedNote({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-cream-warm p-4 text-sm font-semibold text-ink-500">
      <Lock className="size-4" /> {text}
    </div>
  );
}

function ActionRow({ title, desc, href, label }: { title: string; desc: string; href: string; label: string }) {
  return (
    <div className="flex items-start gap-3 border-t border-ink-900/8 pt-4">
      <div className="flex-1">
        <div className="font-semibold text-ink-900">{title}</div>
        <p className="text-sm text-ink-500">{desc}</p>
      </div>
      <a href={href} className="rounded-pill border-[1.5px] border-ink-900/15 px-4 py-2 text-sm font-bold text-ink-700 hover:border-ink-900/30">
        {label}
      </a>
    </div>
  );
}

function DangerZone({ isOwner, institutionName }: { isOwner: boolean; institutionName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2 border-t border-ink-900/8 pt-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="font-semibold text-terracotta-600">Smazat útulek</div>
          <p className="text-sm text-ink-500">Nevratné. Smaže profil a všechna data útulku.</p>
        </div>
        {isOwner ? (
          <button type="button" onClick={() => setConfirming((c) => !c)} className="rounded-pill border-[1.5px] border-terracotta-400/60 px-4 py-2 text-sm font-bold text-terracotta-600 hover:bg-peach-100">
            Smazat
          </button>
        ) : (
          <span className="text-xs font-semibold text-ink-400">jen vlastník</span>
        )}
      </div>
      {confirming && isOwner && (
        <div className="rounded-2xl bg-peach-100 p-4 ring-1 ring-terracotta-400/30">
          <p className="text-sm font-semibold text-terracotta-600">
            Pro potvrzení napiš název útulku: <strong>{institutionName}</strong>
          </p>
          <input value={name} onChange={(e) => setName(e.target.value)} className="admin-input mt-2" placeholder={institutionName} />
          {error && <p className="mt-2 text-sm text-terracotta-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending || name.trim() !== institutionName}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const r = await deleteInstitution(name);
                  if ("error" in r) setError(r.error);
                  else {
                    router.push("/auth/logout");
                  }
                })
              }
              className="rounded-pill bg-terracotta-500 px-4 py-2 text-sm font-bold text-cream disabled:opacity-50"
            >
              {pending ? "Mažu…" : "Trvale smazat útulek"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-pill px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-cream-warm">
              Zrušit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
