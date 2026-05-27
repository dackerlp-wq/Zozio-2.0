-- ===========================================================================
-- Zozio 2.0 — Initial schema (v1)
-- Tables: institutions, institution_members, kennels, animals, vet_records,
--         vaccinations, applications, application_events, notifications,
--         applicant_profiles
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "unaccent";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type institution_type        as enum ('shelter', 'rescue_station');
create type member_role             as enum ('owner', 'admin', 'staff');
create type species                 as enum ('dog', 'cat', 'rabbit', 'other');
create type sex                     as enum ('male', 'female', 'unknown');
create type animal_size             as enum ('small', 'medium', 'large', 'xlarge');
create type adoption_status         as enum ('available', 'reserved', 'adopted', 'on_hold', 'unpublished');
create type health_status           as enum ('healthy', 'treated', 'special_needs');
create type energy_level            as enum ('low', 'medium', 'high');
create type compatibility           as enum ('yes', 'no', 'unknown');
create type adopter_experience      as enum ('beginner_ok', 'experienced_only');
create type application_status      as enum (
  'new', 'review', 'phone_contact', 'in_person_meeting',
  'approved', 'contract_signed', 'completed', 'rejected'
);
create type notification_type       as enum (
  'new_application', 'application_status_change', 'long_stay_alert',
  'vaccination_due', 'newsletter_sent', 'system'
);

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- institutions
-- ---------------------------------------------------------------------------
create table institutions (
  id              uuid primary key default uuid_generate_v4(),
  slug            text not null unique check (slug ~ '^[a-z0-9-]+$' and length(slug) between 3 and 64),
  type            institution_type not null default 'shelter',
  name            text not null,
  legal_name      text,
  ico             text,
  description     text,
  logo_url        text,
  hero_url        text,
  email           text,
  phone           text,
  website         text,
  region          text,
  city            text,
  address         text,
  lat             double precision,
  lng             double precision,
  facebook_url    text,
  instagram_url   text,
  is_published    boolean not null default false,
  is_verified     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on institutions (region);
create index on institutions (is_published) where is_published = true;
create trigger _institutions_updated_at before update on institutions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- institution_members
-- ---------------------------------------------------------------------------
create table institution_members (
  id              uuid primary key default uuid_generate_v4(),
  institution_id  uuid not null references institutions(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            member_role not null default 'staff',
  invited_by      uuid references auth.users(id),
  joined_at       timestamptz not null default now(),
  unique (institution_id, user_id)
);
create index on institution_members (user_id);
create index on institution_members (institution_id, role);

-- ---------------------------------------------------------------------------
-- kennels (kotce / výběhy)
-- ---------------------------------------------------------------------------
create table kennels (
  id              uuid primary key default uuid_generate_v4(),
  institution_id  uuid not null references institutions(id) on delete cascade,
  name            text not null,
  capacity        smallint not null default 1 check (capacity > 0),
  is_quarantine   boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on kennels (institution_id);
create trigger _kennels_updated_at before update on kennels
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- animals
-- ---------------------------------------------------------------------------
create table animals (
  id                    uuid primary key default uuid_generate_v4(),
  institution_id        uuid not null references institutions(id) on delete cascade,
  kennel_id             uuid references kennels(id) on delete set null,

  -- Basic
  name                  text not null,
  species               species not null,
  breed                 text,
  is_crossbreed         boolean not null default false,
  breed_secondary       text,
  primary_photo_url     text,
  gallery               text[] not null default '{}',
  description           text,
  description_ai_draft  text,

  -- Demographics
  age_years             smallint check (age_years between 0 and 30),
  age_months            smallint check (age_months between 0 and 11),
  sex                   sex not null default 'unknown',
  size                  animal_size,
  color                 text,
  weight_kg             numeric(5,2),

  -- Health
  is_neutered           boolean,
  is_chipped            boolean,
  chip_number           text,
  health_status         health_status not null default 'healthy',
  health_notes          text,

  -- Behavior
  good_with_children    compatibility not null default 'unknown',
  good_with_dogs        compatibility not null default 'unknown',
  good_with_cats        compatibility not null default 'unknown',
  energy_level          energy_level,
  personality_tags      text[] not null default '{}',
  adopter_experience    adopter_experience not null default 'beginner_ok',
  needs_garden          boolean,

  -- Story
  story_title           text,
  story_text            text,
  rescue_date           date,
  rescue_source         text,
  intake_date           date,
  video_url             text,

  -- Status
  adoption_status       adoption_status not null default 'available',
  is_urgent             boolean not null default false,
  long_stay_boost       boolean not null default false,

  -- Search (populated by trigger — unaccent is STABLE so cannot use generated)
  search_vector         tsvector,

  published_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index on animals (institution_id);
create index on animals (adoption_status);
create index on animals (species);
create index on animals (is_urgent) where is_urgent = true;
create index on animals using gin (search_vector);
create index on animals using gin (personality_tags);
create trigger _animals_updated_at before update on animals
  for each row execute function set_updated_at();

-- Trigger maintains search_vector (allows STABLE unaccent)
create or replace function animals_update_search_vector()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', unaccent(coalesce(new.name, ''))), 'A') ||
    setweight(to_tsvector('simple', unaccent(coalesce(new.breed, ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(coalesce(new.breed_secondary, ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(coalesce(new.description, ''))), 'C') ||
    setweight(to_tsvector('simple', unaccent(coalesce(new.story_text, ''))), 'D') ||
    setweight(to_tsvector('simple', unaccent(coalesce(array_to_string(new.personality_tags, ' '), ''))), 'B');
  return new;
end $$;

create trigger _animals_search_vector
  before insert or update of name, breed, breed_secondary, description, story_text, personality_tags
  on animals
  for each row execute function animals_update_search_vector();

-- ---------------------------------------------------------------------------
-- vaccinations
-- ---------------------------------------------------------------------------
create table vaccinations (
  id              uuid primary key default uuid_generate_v4(),
  animal_id       uuid not null references animals(id) on delete cascade,
  vaccine         text not null,
  administered_at date not null,
  valid_until     date,
  vet_name        text,
  notes           text,
  created_at      timestamptz not null default now()
);
create index on vaccinations (animal_id);
create index on vaccinations (valid_until) where valid_until is not null;

-- ---------------------------------------------------------------------------
-- vet_records (general medical records)
-- ---------------------------------------------------------------------------
create table vet_records (
  id              uuid primary key default uuid_generate_v4(),
  animal_id       uuid not null references animals(id) on delete cascade,
  recorded_at     date not null default current_date,
  category        text not null,
  title           text not null,
  notes           text,
  attachments     text[] not null default '{}',
  vet_name        text,
  created_at      timestamptz not null default now()
);
create index on vet_records (animal_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- applicant_profiles (optional registered adopters)
-- ---------------------------------------------------------------------------
create table applicant_profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  phone           text,
  city            text,
  housing_type    text,
  has_garden      boolean,
  has_children    boolean,
  has_pets        boolean,
  experience      text,
  about_text      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger _applicant_profiles_updated_at before update on applicant_profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- applications (žádosti o adopci)
-- ---------------------------------------------------------------------------
create table applications (
  id              uuid primary key default uuid_generate_v4(),
  animal_id       uuid not null references animals(id) on delete cascade,
  institution_id  uuid not null references institutions(id) on delete cascade,

  -- Applicant (anonymous or registered)
  applicant_user_id uuid references auth.users(id) on delete set null,
  applicant_name    text not null,
  applicant_email   text not null,
  applicant_phone   text,
  applicant_city    text,
  applicant_message text,
  applicant_data    jsonb not null default '{}', -- form fields

  status            application_status not null default 'new',
  rejection_reason  text,
  internal_notes    text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on applications (institution_id, status);
create index on applications (animal_id);
create index on applications (applicant_user_id) where applicant_user_id is not null;
create index on applications (applicant_email);
create trigger _applications_updated_at before update on applications
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- application_events (audit log + workflow history)
-- ---------------------------------------------------------------------------
create table application_events (
  id              uuid primary key default uuid_generate_v4(),
  application_id  uuid not null references applications(id) on delete cascade,
  actor_user_id   uuid references auth.users(id) on delete set null,
  event_type      text not null,
  from_status     application_status,
  to_status       application_status,
  note            text,
  created_at      timestamptz not null default now()
);
create index on application_events (application_id, created_at desc);

-- ---------------------------------------------------------------------------
-- notifications (in-app + email queue)
-- ---------------------------------------------------------------------------
create table notifications (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  institution_id  uuid references institutions(id) on delete cascade,
  type            notification_type not null,
  title           text not null,
  body            text,
  link            text,
  metadata        jsonb not null default '{}',
  read_at         timestamptz,
  email_sent_at   timestamptz,
  created_at      timestamptz not null default now()
);
create index on notifications (user_id, read_at, created_at desc);

-- ===========================================================================
-- RLS — Row Level Security
-- ===========================================================================

-- Helper: is current user a member of given institution?
create or replace function is_institution_member(_institution_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from institution_members
    where institution_id = _institution_id
      and user_id = auth.uid()
  );
$$;

create or replace function institution_role(_institution_id uuid)
returns member_role language sql stable security definer as $$
  select role from institution_members
  where institution_id = _institution_id
    and user_id = auth.uid()
  limit 1;
$$;

-- institutions
alter table institutions enable row level security;
create policy "institutions_public_read"
  on institutions for select
  using (is_published = true);
create policy "institutions_member_read"
  on institutions for select
  using (is_institution_member(id));
create policy "institutions_owner_update"
  on institutions for update
  using (institution_role(id) in ('owner', 'admin'))
  with check (institution_role(id) in ('owner', 'admin'));
create policy "institutions_owner_delete"
  on institutions for delete
  using (institution_role(id) = 'owner');
-- INSERT: pouze přes service role (registrace přes API route)

-- institution_members
alter table institution_members enable row level security;
create policy "members_self_read"
  on institution_members for select
  using (user_id = auth.uid() or is_institution_member(institution_id));
-- mutace přes service role (zvanie/odebrání řízeno API)

-- kennels
alter table kennels enable row level security;
create policy "kennels_member_read"
  on kennels for select
  using (is_institution_member(institution_id));
create policy "kennels_member_write"
  on kennels for all
  using (institution_role(institution_id) in ('owner', 'admin', 'staff'))
  with check (institution_role(institution_id) in ('owner', 'admin', 'staff'));

-- animals
alter table animals enable row level security;
create policy "animals_public_read"
  on animals for select
  using (
    adoption_status in ('available', 'reserved')
    and exists (select 1 from institutions i where i.id = institution_id and i.is_published)
  );
create policy "animals_member_read"
  on animals for select
  using (is_institution_member(institution_id));
create policy "animals_member_write"
  on animals for all
  using (institution_role(institution_id) in ('owner', 'admin', 'staff'))
  with check (institution_role(institution_id) in ('owner', 'admin', 'staff'));

-- vaccinations + vet_records (member-only, never public)
alter table vaccinations enable row level security;
create policy "vaccinations_member_all"
  on vaccinations for all
  using (
    exists (
      select 1 from animals a
      where a.id = animal_id
        and is_institution_member(a.institution_id)
    )
  )
  with check (
    exists (
      select 1 from animals a
      where a.id = animal_id
        and institution_role(a.institution_id) in ('owner', 'admin', 'staff')
    )
  );

alter table vet_records enable row level security;
create policy "vet_records_member_all"
  on vet_records for all
  using (
    exists (
      select 1 from animals a
      where a.id = animal_id
        and is_institution_member(a.institution_id)
    )
  )
  with check (
    exists (
      select 1 from animals a
      where a.id = animal_id
        and institution_role(a.institution_id) in ('owner', 'admin', 'staff')
    )
  );

-- applicant_profiles
alter table applicant_profiles enable row level security;
create policy "applicant_profiles_self_all"
  on applicant_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- applications
alter table applications enable row level security;
create policy "applications_applicant_read"
  on applications for select
  using (applicant_user_id = auth.uid());
create policy "applications_member_read"
  on applications for select
  using (is_institution_member(institution_id));
create policy "applications_member_write"
  on applications for update
  using (institution_role(institution_id) in ('owner', 'admin', 'staff'))
  with check (institution_role(institution_id) in ('owner', 'admin', 'staff'));
-- INSERT (nová žádost) přes service role API route (rate-limit, captcha)

-- application_events
alter table application_events enable row level security;
create policy "events_member_read"
  on application_events for select
  using (
    exists (
      select 1 from applications app
      where app.id = application_id
        and is_institution_member(app.institution_id)
    )
  );
-- INSERT přes service role (audit trail)

-- notifications
alter table notifications enable row level security;
create policy "notifications_self_read"
  on notifications for select
  using (user_id = auth.uid());
create policy "notifications_self_update"
  on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
-- INSERT přes service role
commit;
