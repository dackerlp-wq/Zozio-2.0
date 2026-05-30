-- ===========================================================================
-- Fáze 10 — Adopce & výstupy
-- adoptions: dvoufázová adopce (zkušební doba → trvalá adopce), poplatek,
--            smlouva, adoptant. Vázané na zvíře, volitelně na žádost.
-- animal_exit_records: strukturované záznamy o vrácení a úhynu/utracení.
-- ===========================================================================

-- Fáze adopčního procesu.
do $$ begin
  create type adoption_stage as enum ('trial', 'finalized', 'cancelled');
exception when duplicate_object then null; end $$;

-- Typ výstupního záznamu (vrácení / úhyn / utracení).
do $$ begin
  create type animal_exit_type as enum ('return', 'death', 'euthanasia');
exception when duplicate_object then null; end $$;

-- ---- adoptions -------------------------------------------------------------
create table adoptions (
  id                 uuid primary key default uuid_generate_v4(),
  animal_id          uuid not null references animals(id) on delete cascade,
  institution_id     uuid not null references institutions(id) on delete cascade,
  application_id     uuid references applications(id) on delete set null,
  adopter_name       text not null,
  adopter_email      text,
  adopter_phone      text,
  adopter_address    text,
  adopter_id_number  text,            -- číslo OP / dokladu (pro smlouvu)
  stage              adoption_stage not null default 'trial',
  started_on         date not null default current_date,  -- předání do péče
  trial_until        date,            -- konec zkušební doby (posouzení)
  finalized_on       date,            -- trvalá adopce uzavřena
  cancelled_on       date,
  cancel_reason      text,
  fee                numeric(10,2),   -- adopční poplatek (vybírán u trvalé adopce)
  contract_url       text,
  contract_signed_at date,
  notes              text,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on adoptions (animal_id, started_on desc);
create index on adoptions (institution_id);
-- Max. jedna běžící (nezrušená, neuzavřená) adopce na zvíře.
create unique index adoptions_one_active
  on adoptions (animal_id) where stage = 'trial';
create index on adoptions (trial_until)
  where stage = 'trial' and trial_until is not null;

create trigger _adoptions_updated_at before update on adoptions
  for each row execute function set_updated_at();

-- ---- animal_exit_records ---------------------------------------------------
create table animal_exit_records (
  id             uuid primary key default uuid_generate_v4(),
  animal_id      uuid not null references animals(id) on delete cascade,
  institution_id uuid not null references institutions(id) on delete cascade,
  kind           animal_exit_type not null,
  occurred_on    date not null default current_date,
  reason         text,              -- důvod vrácení / příčina úhynu
  details        text,              -- okolnosti, dokumentace
  vet            text,              -- veterinář (u úhynu/utracení)
  adoption_id    uuid references adoptions(id) on delete set null,  -- u vrácení z adopce
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on animal_exit_records (animal_id, occurred_on desc);
create index on animal_exit_records (institution_id, kind);

-- ---- RLS -------------------------------------------------------------------
alter table adoptions enable row level security;
create policy "adoptions_member_all"
  on adoptions for all
  using (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  )
  with check (
    exists (select 1 from animals a
      where a.id = animal_id
        and institution_role(a.institution_id) in ('owner','admin','staff'))
  );

alter table animal_exit_records enable row level security;
create policy "animal_exit_records_member_all"
  on animal_exit_records for all
  using (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  )
  with check (
    exists (select 1 from animals a
      where a.id = animal_id
        and institution_role(a.institution_id) in ('owner','admin','staff'))
  );
