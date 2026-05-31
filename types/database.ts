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
export type MemberRole = "owner" | "admin" | "staff";
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
  created_at: string;
  updated_at: string;
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
  auto_publish: boolean;
  is_urgent: boolean;
  long_stay_boost: boolean;
  search_vector: unknown;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VaccinationRow {
  id: string;
  animal_id: string;
  vaccine: string;
  administered_at: string;
  valid_until: string | null;
  vet_name: string | null;
  notes: string | null;
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
  uploaded_by: string | null;
  created_at: string;
}

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
  contract_url: string | null;
  contract_signed_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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

export interface AnimalCostRow {
  id: string;
  animal_id: string;
  institution_id: string;
  category: AnimalCostCategory;
  amount: number;
  spent_on: string;
  description: string | null;
  invoice_url: string | null;
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
      vaccinations: TableDef<VaccinationRow>;
      vet_records: TableDef<VetRecordRow>;
      quarantine_records: TableDef<QuarantineRecordRow>;
      foster_carers: TableDef<FosterCarerRow>;
      foster_placements: TableDef<FosterPlacementRow>;
      adoptions: TableDef<AdoptionRow>;
      animal_exit_records: TableDef<AnimalExitRecordRow>;
      animal_costs: TableDef<AnimalCostRow>;
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
