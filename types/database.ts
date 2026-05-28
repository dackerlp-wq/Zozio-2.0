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
  | "unpublished";
export type HealthStatus = "healthy" | "treated" | "special_needs";
export type EnergyLevel = "low" | "medium" | "high";
export type Compatibility = "yes" | "no" | "unknown";
export type AdopterExperience = "beginner_ok" | "experienced_only";
export type CareDifficulty = "easy" | "medium" | "high";
export type SuitableHousing = "apartment" | "house" | "both";
export type VerificationStatus = "pending" | "approved" | "rejected";
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
  | "newsletter_sent"
  | "system";

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

export interface KennelRow {
  id: string;
  institution_id: string;
  name: string;
  capacity: number;
  is_quarantine: boolean;
  notes: string | null;
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
      applicant_profiles: TableDef<ApplicantProfileRow>;
      applications: TableDef<ApplicationRow>;
      application_events: TableDef<ApplicationEventRow>;
      notifications: TableDef<NotificationRow>;
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
    };
    CompositeTypes: Record<string, never>;
  };
}
