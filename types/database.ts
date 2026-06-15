/**
 * Manual Supabase database types — udržuj v sync s
 * supabase/migrations/. Až nastaví SUPABASE_ACCESS_TOKEN,
 * regeneruj přes: npx supabase gen types typescript --project-id <ref> --schema public
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---- Enums --------------------------------------------------------------
export type InstitutionType = "shelter" | "rescue_station";
export type MemberRole = "owner" | "admin" | "staff" | "volunteer";
export type Species = "dog" | "cat" | "rabbit" | "other";
export type Sex = "male" | "female" | "unknown";
export type AnimalSize = "small" | "medium" | "large" | "xlarge";
export type AdoptionStatus =
  | "available"
  | "reserved"
  | "adopted"
  | "on_hold"
  | "unpublished"
  | "intake"
  | "foster"
  | "transferred"
  | "returned"
  | "deceased";
export type HealthStatus =
  | "healthy"
  | "sick"
  | "treated"
  | "special_needs"
  | "unknown";
export type EnergyLevel = "low" | "medium" | "high";
export type Compatibility = "yes" | "no" | "unknown";
export type AdopterExperience = "beginner_ok" | "experienced_only";
export type CareDifficulty = "easy" | "medium" | "high";
export type SuitableHousing = "apartment" | "house" | "both";
export type ChipCheckResult = "owner_not_found" | "owner_found" | "not_checked";
export type VerificationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";
export type ApplicationStatus =
  | "new"
  | "review"
  | "phone_contact"
  | "in_person_meeting"
  | "approved"
  | "contract_signed"
  | "completed"
  | "rejected";
export type NotificationType =
  | "new_application"
  | "application_status_change"
  | "long_stay_alert"
  | "vaccination_due"
  | "task_due"
  | "newsletter_sent"
  | "system";

// Správa zvířat — nové enumy (migrace 0006)
export type TreatmentType =
  | "medication"
  | "deworming"
  | "antiparasitic"
  | "other";
export type CareLogType =
  | "feeding"
  | "walk"
  | "play"
  | "grooming"
  | "behavior"
  | "training"
  | "cleaning"
  | "note"
  | "photo"
  | "medical";
export type AnimalTaskType =
  | "vaccination"
  | "treatment"
  | "deworming"
  | "vet_checkup"
  | "grooming"
  | "long_stay"
  | "adoption_followup"
  | "protection_deadline"
  | "quarantine_end"
  | "foster_followup"
  | "custom";
export type AnimalTaskStatus = "open" | "done" | "dismissed";
export type AnimalTaskSource = "manual" | "auto";
export type AnimalTaskPriority = "low" | "normal" | "high";
export type TaskScheduleFreq = "daily" | "weekly" | "monthly" | "yearly";

// Příjem & právní stav (migrace 0008)
export type AnimalLegalStatus =
  | "in_protection"
  | "shelter_owned"
  | "owner_claimed"
  | "transferred_out";
export type AnimalIntakeType =
  | "found"
  | "surrender"
  | "transfer"
  | "confiscation"
  | "born"
  | "other";

// Karanténa & veterinární dohled (migrace 0009)
export type AnimalSupervisionStatus =
  | "released"
  | "quarantine"
  | "isolation"
  | "monitored";

// Potřeba veterinární péče při příjmu (migrace 0013)
export type AnimalVetCareNeed =
  | "none"
  | "required"
  | "scheduled"
  | "deferred";

// ---- Tables -------------------------------------------------------------
export interface InstitutionRow {
  id: string;
  slug: string;
  type: InstitutionType;
  name: string;
  legal_name: string | null;
  ico: string | null;
  description: string | null;
  logo_url: string | null;
  hero_url: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  region: string | null;
  city: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  facebook_url: string | null;
  instagram_url: string | null;
  is_published: boolean;
  is_verified: boolean;
  verification_status: VerificationStatus;
  verified_at: string | null;
  rejection_reason: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  // Příjem & právní stav (migrace 0008)
  protection_period_months: number;
  show_protected_in_catalog: boolean;
  staff_can_manage_legal: boolean;
  adoption_fee_default: number | null;
  foster_fee_enabled: boolean;
  // Pěstounská péče (migrace 0029)
  housing_mode: "physical" | "foster_network" | "hybrid";
  foster_enabled: boolean;
  task_digest_enabled: boolean;
  // Evidence & exporty (migrace 0040)
  plan: string;
  export_kvs_monthly: boolean;
  export_accounting_monthly: boolean;
  // Nastavení útulku (migrace 0041)
  opening_hours: string | null;
  /** Rok založení útulku — veřejný profil („od roku …"); null = skryto. */
  founded_year: number | null;
  record_number_format: string;
  registration_number: string | null;
  kvs_region: string | null;
  legal_form: string | null;
  accept_web_applications: boolean;
  screening_form_enabled: boolean;
  trial_period_days: number;
  contract_template_url: string | null;
  widget_enabled: boolean;
  custom_domain: string | null;
  darujme_org_id: string | null;
  bank_account: string | null;
  email_from: string | null;
  email_reply_to: string | null;
  auto_emails_enabled: boolean;
  custom_ads_enabled: boolean;
  locale: string;
  timezone: string;
  // Web & obsah (migrace 0045)
  widget_config: {
    scope: "adoptable" | "with_found";
    species: "all" | "dog" | "cat";
    layout: "grid" | "list";
    count: 3 | 6 | 9;
    theme: "light" | "dark";
  } | null;
  created_at: string;
  updated_at: string;
}

export interface ExportLogRow {
  id: string;
  institution_id: string;
  kind: string;
  format: string;
  label: string;
  period_from: string | null;
  period_to: string | null;
  submitted_to_kvs: boolean;
  submitted_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ExportColumnTemplateRow {
  id: string;
  institution_id: string;
  report_key: string;
  name: string;
  columns: string[];
  created_by: string | null;
  created_at: string;
}

export interface InstitutionInvitationRow {
  id: string;
  institution_id: string;
  email: string;
  role: MemberRole;
  token: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface AnimalProfileViewRow {
  animal_id: string;
  institution_id: string;
  day: string;
  count: number;
}

export type ContentType = "article" | "story" | "event";
export type ContentStatus = "draft" | "published" | "scheduled";

export interface ContentItemRow {
  id: string;
  institution_id: string;
  type: ContentType;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  body: string | null;
  cover_url: string | null;
  status: ContentStatus;
  published_at: string | null;
  scheduled_at: string | null;
  view_count: number;
  animal_id: string | null;
  event_date: string | null;
  event_location: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type NewsletterSegment = "donor" | "adopter" | "supporter";

export interface NewsletterSubscriberRow {
  id: string;
  institution_id: string;
  email: string;
  segment: NewsletterSegment;
  consent_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
}

export type CampaignStatus = "draft" | "scheduled" | "sent";

export interface NewsletterCampaignRow {
  id: string;
  institution_id: string;
  subject: string;
  body: string | null;
  segment: string;
  status: CampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  recipients: number;
  opens: number;
  created_by: string | null;
  created_at: string;
}

export type ApplicationQuestionType = "text" | "textarea" | "select" | "boolean";

/** Vlastní otázka útulku k žádosti o adopci (Nastavení → Adopce). */
export interface ApplicationQuestionRow {
  id: string;
  institution_id: string;
  label: string;
  field_type: ApplicationQuestionType;
  options: string[];
  required: boolean;
  species: string[];
  sort_order: number;
  active: boolean;
  created_at: string;
}

/** Cache AI formulací „Ideální domov" pro veřejný detail zvířete. */
export interface AnimalIdealHomeRow {
  animal_id: string;
  fits: string[];
  not_fits: string[];
  attr_hash: string;
  generated_at: string;
}

/** Uložené odpovědi kvízu AI matchingu (návštěvnický účet). */
export interface AdopterPreferenceRow {
  user_id: string;
  answers: Record<string, unknown>;
  freetext: string | null;
  ai_summary: string | null;
  ai_weights: Record<string, number> | null;
  updated_at: string;
}

export type MagazinePostStatus = "draft" | "published";

/** Celostátní „od Zozio" magazín — platform-level, bez institution_id (superadmin). */
export interface MagazinePostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  cover_url: string | null;
  author: string;
  category: string;
  status: MagazinePostStatus;
  featured: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CommentStatus = "pending" | "approved" | "spam" | "hidden";

/** Líbí u článku (content_items i magazine_posts) — přihlášený nebo host (token). */
export interface ArticleLikeRow {
  id: string;
  content_item_id: string | null;
  magazine_post_id: string | null;
  user_id: string | null;
  anon_token: string | null;
  created_at: string;
}

/** Komentář u článku — vlákna (parent_id) + moderace (status). */
export interface ArticleCommentRow {
  id: string;
  content_item_id: string | null;
  magazine_post_id: string | null;
  parent_id: string | null;
  user_id: string | null;
  guest_name: string | null;
  body: string;
  status: CommentStatus;
  like_count: number;
  created_at: string;
  updated_at: string;
}

export interface CommentLikeRow {
  id: string;
  comment_id: string;
  user_id: string | null;
  anon_token: string | null;
  created_at: string;
}

/** Spádová oblast útulku — přiřazení obce (RÚIAN kód) útulku. */
export interface ShelterMunicipalityRow {
  id: string;
  institution_id: string;
  obec_kod: number;
  obec_nazev: string;
  okres_kod: number | null;
  created_at: string;
}

/** Globální konfigurace platformy (key/value). */
export interface PlatformSettingRow {
  key: string;
  value: unknown;
  updated_at: string;
}

/** Vazba článek ↔ zvíře (M:N); právě jeden z content_item_id / magazine_post_id. */
export interface ArticleAnimalRow {
  id: string;
  content_item_id: string | null;
  magazine_post_id: string | null;
  animal_id: string;
  created_at: string;
}

export interface InstitutionMemberRow {
  id: string;
  institution_id: string;
  user_id: string;
  role: MemberRole;
  invited_by: string | null;
  joined_at: string;
}

export type KennelKind =
  | "standard"
  | "quarantine"
  | "isolation"
  | "intake"
  | "outdoor"
  | "cattery"
  | "maternity";

export type KennelStatus = "active" | "cleaning" | "out_of_service" | "reserved";

export interface KennelRow {
  id: string;
  institution_id: string;
  name: string;
  capacity: number;
  is_quarantine: boolean;
  notes: string | null;
  zone: string | null;
  kind: KennelKind;
  status: KennelStatus;
  species_allowed: Species[];
  is_heated: boolean;
  is_accessible: boolean;
  is_maternity: boolean;
  photo_url: string | null;
  out_of_service_reason: string | null;
  out_of_service_until: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AnimalRow {
  id: string;
  institution_id: string;
  kennel_id: string | null;
  name: string;
  species: Species;
  breed: string | null;
  is_crossbreed: boolean;
  breed_secondary: string | null;
  primary_photo_url: string | null;
  gallery: string[];
  description: string | null;
  description_ai_draft: string | null;
  age_years: number | null;
  age_months: number | null;
  birth_date: string | null;
  birth_date_is_estimate: boolean;
  sex: Sex;
  size: AnimalSize | null;
  color: string | null;
  weight_kg: number | null;
  is_neutered: boolean | null;
  is_vaccinated: boolean;
  is_chipped: boolean | null;
  chip_number: string | null;
  health_status: HealthStatus;
  health_notes: string | null;
  // Handicap je samostatný příznak — zvíře může být zdravé i handicapované.
  is_handicapped: boolean;
  handicap_note: string | null;
  good_with_children: Compatibility;
  good_with_dogs: Compatibility;
  good_with_cats: Compatibility;
  energy_level: EnergyLevel | null;
  personality_tags: string[];
  adopter_experience: AdopterExperience;
  care_difficulty: CareDifficulty | null;
  suitable_housing: SuitableHousing | null;
  needs_garden: boolean | null;
  story_title: string | null;
  story_text: string | null;
  rescue_date: string | null;
  rescue_source: string | null;
  intake_date: string | null;
  video_url: string | null;
  adoption_status: AdoptionStatus;
  // Příjem & právní stav (migrace 0008)
  legal_status: AnimalLegalStatus;
  intake_type: AnimalIntakeType | null;
  found_location: string | null;
  found_date: string | null;
  announced_at: string | null;
  protection_until: string | null;
  // Katalog nalezenců „Hledají svého páníčka" (migrace 0023)
  found_listing_published: boolean;
  original_owner: string | null;
  surrender_waiver_at: string | null;
  surrender_waiver_url: string | null;
  handed_over_by: string | null;
  intake_condition: string | null;
  intake_documents: string[];
  tattoo: string | null;
  ear_tag: string | null;
  record_number: string | null;
  // Karanténa & veterinární dohled (migrace 0009)
  supervision_status: AnimalSupervisionStatus;
  // Plný příjmový protokol (migrace 0013)
  intake_time: string | null;
  found_lat: number | null;
  found_lng: number | null;
  handed_over_phone: string | null;
  handed_over_email: string | null;
  identification_none: boolean;
  vet_care_need: AnimalVetCareNeed | null;
  intake_quarantine_days: number | null;
  intake_staff: string | null;
  intake_notes: string | null;
  municipality_ref: string | null;
  registry_name: string | null;
  // Rozšíření příjmu (migrace 0026)
  intake_staff_role: string | null;
  source_institution: string | null;
  confiscation_authority: string | null;
  confiscation_ref: string | null;
  chip_checked_at: string | null;
  chip_check_result: ChipCheckResult | null;
  kvs_reported_at: string | null;
  auto_publish: boolean;
  is_urgent: boolean;
  long_stay_boost: boolean;
  /** Per-zvíře adopční poplatek (Kč); null = výchozí z nastavení útulku. */
  adoption_fee: number | null;
  search_vector: unknown;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnimalBreedRow {
  id: string;
  species: Species;
  name: string;
  /** null = globální katalog; jinak vlastní plemeno útulku */
  institution_id: string | null;
  created_at: string;
}

export interface VaccinationRow {
  id: string;
  animal_id: string;
  vaccine: string;
  administered_at: string;
  valid_until: string | null;
  vet_name: string | null;
  notes: string | null;
  // Rozšíření zdraví (migrace 0027)
  batch: string | null;
  cost_id: string | null;
  created_at: string;
}

export interface VetRecordRow {
  id: string;
  animal_id: string;
  recorded_at: string;
  category: string;
  title: string;
  notes: string | null;
  attachments: string[];
  vet_name: string | null;
  // Rozšíření zdraví (migrace 0027)
  photos: string[];
  cost_id: string | null;
  created_at: string;
}

export interface MedicationDoseRow {
  id: string;
  animal_id: string;
  treatment_id: string;
  slot: string | null;
  due_on: string;
  given_at: string | null;
  given_by: string | null;
  created_at: string;
}

export interface AnimalConditionRow {
  id: string;
  animal_id: string;
  institution_id: string;
  label: string;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
}

// ---- Dokumenty zvířete (migrace 0018) -----------------------------------
export type AnimalDocumentCategory =
  | "medical"
  | "vaccination"
  | "lab"
  | "contract"
  | "intake"
  | "registration"
  | "other";

export interface AnimalDocumentRow {
  id: string;
  animal_id: string;
  institution_id: string;
  category: AnimalDocumentCategory;
  title: string;
  /** Veřejná URL (jen u starších dokumentů); privátní se otevírají přes signed URL z file_path. */
  file_url: string | null;
  file_path: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  document_date: string | null;
  notes: string | null;
  /** Volitelné propojení se zdrojovým záznamem (např. 'vaccinations', 'vet_records'). */
  related_table: string | null;
  related_id: string | null;
  source: AnimalDocumentSource;
  expires_on: string | null;
  version: number;
  supersedes_id: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export type AnimalDocumentSource = "generated" | "upload" | "scan";

// ---- Karanténa & veterinární dohled (migrace 0009) ----------------------
export interface QuarantineRecordRow {
  id: string;
  animal_id: string;
  institution_id: string;
  kind: AnimalSupervisionStatus;
  started_on: string;
  planned_until: string | null;
  ended_on: string | null;
  reason: string | null;
  exam_results: string | null;
  vet_decision: string | null;
  notes: string | null;
  // Protokol ukončení (migrace 0028)
  vet_consent: boolean;
  created_by: string | null;
  created_at: string;
}

export interface QuarantineObservationRow {
  id: string;
  animal_id: string;
  quarantine_id: string | null;
  observed_at: string;
  created_by: string | null;
  note: string | null;
  temperature: number | null;
  tags: string[] | null;
  flag: "ok" | "watch";
  created_at: string;
}

export interface QuarantineContactRow {
  id: string;
  animal_id: string;
  contact_animal_id: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

// ---- Pěstouni & dočasná péče (migrace 0010) -----------------------------
export interface FosterCarerRow {
  id: string;
  institution_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  capacity: number | null;
  species_note: string | null;
  notes: string | null;
  is_active: boolean;
  tags: string[] | null;
  unavailable_until: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FosterPlacementRow {
  id: string;
  animal_id: string;
  institution_id: string;
  carer_id: string;
  started_on: string;
  planned_until: string | null;
  ended_on: string | null;
  end_reason: string | null;
  fee: number | null;
  contract_url: string | null;
  contract_signed_at: string | null;
  notes: string | null;
  care_type: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FosterCheckinRow {
  id: string;
  animal_id: string;
  placement_id: string | null;
  checked_on: string;
  method: "phone" | "visit" | "message" | null;
  note: string | null;
  photos: string[] | null;
  created_by: string | null;
  created_at: string;
}

export interface FosterCommunicationRow {
  id: string;
  animal_id: string;
  placement_id: string | null;
  kind: "call" | "message" | "email" | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export type AdoptionStage = "trial" | "finalized" | "cancelled";
export type AnimalExitType = "return" | "death" | "euthanasia";

export interface AdoptionRow {
  id: string;
  animal_id: string;
  institution_id: string;
  application_id: string | null;
  adopter_name: string;
  adopter_email: string | null;
  adopter_phone: string | null;
  adopter_address: string | null;
  adopter_id_number: string | null;
  stage: AdoptionStage;
  started_on: string;
  trial_until: string | null;
  finalized_on: string | null;
  cancelled_on: string | null;
  cancel_reason: string | null;
  fee: number | null;
  fee_paid_at: string | null;
  contract_url: string | null;
  contract_signed_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdoptionCheckinRow {
  id: string;
  adoption_id: string;
  animal_id: string;
  kind: "trial" | "post_adoption";
  checked_on: string;
  method: "phone" | "visit" | "message" | null;
  note: string | null;
  photos: string[] | null;
  created_by: string | null;
  created_at: string;
}

export interface AdoptionCommunicationRow {
  id: string;
  adoption_id: string;
  animal_id: string;
  kind: "call" | "message" | "email" | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AnimalExitRecordRow {
  id: string;
  animal_id: string;
  institution_id: string;
  kind: AnimalExitType;
  occurred_on: string;
  reason: string | null;
  details: string | null;
  vet: string | null;
  adoption_id: string | null;
  created_by: string | null;
  created_at: string;
}

export type AnimalCostCategory =
  | "vet"
  | "food"
  | "medication"
  | "castration"
  | "vaccination"
  | "transport"
  | "other";
export type AnimalIncidentType =
  | "escape"
  | "injury"
  | "bite"
  | "conflict"
  | "other";

export type AnimalCostSource = "manual" | "health" | "foster" | "darujme" | "adoption" | "intake";

export interface AnimalCostRow {
  id: string;
  animal_id: string;
  institution_id: string;
  category: AnimalCostCategory;
  amount: number;
  spent_on: string;
  description: string | null;
  invoice_url: string | null;
  placement_id: string | null;
  source: AnimalCostSource;
  created_by: string | null;
  created_at: string;
}

export type AnimalDonationKind = "money" | "in_kind";
export type AnimalDonationSource = "manual" | "darujme" | "sponsoring";

export interface AnimalDonationRow {
  id: string;
  animal_id: string;
  institution_id: string;
  kind: AnimalDonationKind;
  amount: number | null;
  item: string | null;
  donor: string | null;
  source: AnimalDonationSource;
  occurred_on: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AnimalIncidentRow {
  id: string;
  animal_id: string;
  institution_id: string;
  kind: AnimalIncidentType;
  occurred_on: string;
  resolved_on: string | null;
  location: string | null;
  description: string | null;
  resolution: string | null;
  reported_to: string | null;
  created_by: string | null;
  created_at: string;
}

// ---- Správa zvířat — nové tabulky (migrace 0006) ------------------------
export interface AnimalStatusEventRow {
  id: string;
  animal_id: string;
  from_status: AdoptionStatus | null;
  to_status: AdoptionStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface AnimalFieldHistoryRow {
  id: string;
  animal_id: string;
  institution_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface WeightLogRow {
  id: string;
  animal_id: string;
  weight_kg: number;
  measured_at: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TreatmentRow {
  id: string;
  animal_id: string;
  type: TreatmentType;
  name: string;
  dosage: string | null;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  next_due: string | null;
  notes: string | null;
  vet_name: string | null;
  // Rozšíření zdraví (migrace 0027)
  schedule_times: string[] | null;
  cost_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface KennelAssignmentRow {
  id: string;
  animal_id: string;
  kennel_id: string;
  moved_in_at: string;
  moved_out_at: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CareLogEntryRow {
  id: string;
  animal_id: string;
  institution_id: string;
  type: CareLogType;
  note: string | null;
  photo_urls: string[];
  logged_by: string | null;
  logged_at: string;
  created_at: string;
}

export interface AnimalTaskRow {
  id: string;
  institution_id: string;
  animal_id: string | null;
  type: AnimalTaskType;
  title: string;
  description: string | null;
  due_date: string | null;
  status: AnimalTaskStatus;
  priority: AnimalTaskPriority;
  assigned_to: string | null;
  completed_at: string | null;
  completed_by: string | null;
  source: AnimalTaskSource;
  source_ref: string | null;
  schedule_id: string | null;
  schedule_date: string | null;
  snoozed_until: string | null;
  snooze_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskScheduleRow {
  id: string;
  institution_id: string;
  animal_id: string | null;
  type: AnimalTaskType;
  title: string;
  description: string | null;
  priority: AnimalTaskPriority;
  assigned_to: string | null;
  freq: TaskScheduleFreq;
  interval: number;
  start_date: string;
  end_date: string | null;
  lead_days: number;
  next_run: string;
  active: boolean;
  last_generated_at: string | null;
  source_table: string | null;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicantProfileRow {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  housing_type: string | null;
  has_garden: boolean | null;
  has_children: boolean | null;
  has_pets: boolean | null;
  experience: string | null;
  about_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationRow {
  id: string;
  animal_id: string;
  institution_id: string;
  applicant_user_id: string | null;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  applicant_city: string | null;
  applicant_message: string | null;
  applicant_data: Json;
  status: ApplicationStatus;
  rejection_reason: string | null;
  internal_notes: string | null;
  /** Domluvený termín osobní schůzky (datum + čas). */
  meeting_at: string | null;
  meeting_location: string | null;
  /** Stopa odeslané připomínky den předem (proti duplicitě). */
  meeting_reminder_sent_at: string | null;
  /** Kdy žádost rezervovala zvíře (úspěšný telefonický kontakt). */
  reserved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationEventRow {
  id: string;
  application_id: string;
  actor_user_id: string | null;
  event_type: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus | null;
  note: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  institution_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Json;
  read_at: string | null;
  email_sent_at: string | null;
  created_at: string;
}

// ---- Database interface (Supabase shape) --------------------------------
// Mapped types získávají implicitní index signaturu, takže splňují
// supabase `GenericTable` (Record<string, unknown>). `interface ...Row`
// definice samy o sobě tuto podmínku nesplňují → bez wrapperu by se celý
// Database generic resolvoval na `never`.
type Columns<Row> = { [K in keyof Row]: Row[K] };

interface TableDef<Row> {
  Row: Columns<Row>;
  Insert: Partial<Columns<Row>>;
  Update: Partial<Columns<Row>>;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      institutions: TableDef<InstitutionRow>;
      institution_members: TableDef<InstitutionMemberRow>;
      kennels: TableDef<KennelRow>;
      animals: TableDef<AnimalRow>;
      animal_breeds: TableDef<AnimalBreedRow>;
      vaccinations: TableDef<VaccinationRow>;
      vet_records: TableDef<VetRecordRow>;
      medication_doses: TableDef<MedicationDoseRow>;
      animal_conditions: TableDef<AnimalConditionRow>;
      quarantine_records: TableDef<QuarantineRecordRow>;
      quarantine_observations: TableDef<QuarantineObservationRow>;
      quarantine_contacts: TableDef<QuarantineContactRow>;
      foster_carers: TableDef<FosterCarerRow>;
      foster_placements: TableDef<FosterPlacementRow>;
      foster_checkins: TableDef<FosterCheckinRow>;
      foster_communications: TableDef<FosterCommunicationRow>;
      adoptions: TableDef<AdoptionRow>;
      adoption_checkins: TableDef<AdoptionCheckinRow>;
      adoption_communications: TableDef<AdoptionCommunicationRow>;
      animal_exit_records: TableDef<AnimalExitRecordRow>;
      animal_costs: TableDef<AnimalCostRow>;
      animal_donations: TableDef<AnimalDonationRow>;
      animal_incidents: TableDef<AnimalIncidentRow>;
      animal_status_events: TableDef<AnimalStatusEventRow>;
      animal_field_history: TableDef<AnimalFieldHistoryRow>;
      weight_logs: TableDef<WeightLogRow>;
      treatments: TableDef<TreatmentRow>;
      kennel_assignments: TableDef<KennelAssignmentRow>;
      care_log_entries: TableDef<CareLogEntryRow>;
      animal_tasks: TableDef<AnimalTaskRow>;
      task_schedules: TableDef<TaskScheduleRow>;
      applicant_profiles: TableDef<ApplicantProfileRow>;
      applications: TableDef<ApplicationRow>;
      application_events: TableDef<ApplicationEventRow>;
      notifications: TableDef<NotificationRow>;
      animal_documents: TableDef<AnimalDocumentRow>;
      export_log: TableDef<ExportLogRow>;
      export_column_templates: TableDef<ExportColumnTemplateRow>;
      institution_invitations: TableDef<InstitutionInvitationRow>;
      animal_profile_views: TableDef<AnimalProfileViewRow>;
      content_items: TableDef<ContentItemRow>;
      newsletter_subscribers: TableDef<NewsletterSubscriberRow>;
      newsletter_campaigns: TableDef<NewsletterCampaignRow>;
      magazine_posts: TableDef<MagazinePostRow>;
      adopter_preferences: TableDef<AdopterPreferenceRow>;
      animal_ideal_home: TableDef<AnimalIdealHomeRow>;
      application_questions: TableDef<ApplicationQuestionRow>;
      article_likes: TableDef<ArticleLikeRow>;
      article_comments: TableDef<ArticleCommentRow>;
      comment_likes: TableDef<CommentLikeRow>;
      article_animals: TableDef<ArticleAnimalRow>;
      shelter_municipalities: TableDef<ShelterMunicipalityRow>;
      platform_settings: TableDef<PlatformSettingRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      institution_type: InstitutionType;
      member_role: MemberRole;
      species: Species;
      sex: Sex;
      animal_size: AnimalSize;
      adoption_status: AdoptionStatus;
      health_status: HealthStatus;
      energy_level: EnergyLevel;
      compatibility: Compatibility;
      adopter_experience: AdopterExperience;
      care_difficulty: CareDifficulty;
      suitable_housing: SuitableHousing;
      application_status: ApplicationStatus;
      notification_type: NotificationType;
      treatment_type: TreatmentType;
      care_log_type: CareLogType;
      animal_task_type: AnimalTaskType;
      animal_task_status: AnimalTaskStatus;
      animal_task_source: AnimalTaskSource;
      animal_task_priority: AnimalTaskPriority;
      task_schedule_freq: TaskScheduleFreq;
      kennel_kind: KennelKind;
      kennel_status: KennelStatus;
      animal_legal_status: AnimalLegalStatus;
      animal_intake_type: AnimalIntakeType;
      animal_supervision_status: AnimalSupervisionStatus;
      adoption_stage: AdoptionStage;
      animal_exit_type: AnimalExitType;
      animal_cost_category: AnimalCostCategory;
      animal_incident_type: AnimalIncidentType;
      animal_document_category: AnimalDocumentCategory;
    };
    CompositeTypes: Record<string, never>;
  };
}
