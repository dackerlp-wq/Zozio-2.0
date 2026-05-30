-- ===========================================================================
-- Fáze 8 — Karanténa & veterinární dohled
-- Třetí osa stavu: supervision_status (veterinární režim umístění).
-- Nezávislá na adoption_status (umístění) i legal_status (vlastnictví).
-- ===========================================================================

-- ---- Enum ------------------------------------------------------------------
create type animal_supervision_status as enum (
  'released',    -- v běžné části útulku (bez zvláštního dohledu)
  'quarantine',  -- karanténa (nově přijatá / podezření na nákazu)
  'isolation',   -- izolace (potvrzená nákaza / agresivita)
  'monitored'    -- zdravotní dohled (sledování bez izolace)
);

-- Nový typ úkolu pro připomínku konce karantény/dohledu.
alter type animal_task_type add value if not exists 'quarantine_end';

-- ---- Animals: aktuální režim dohledu ---------------------------------------
alter table animals
  add column supervision_status animal_supervision_status not null default 'released';

create index on animals (institution_id, supervision_status);

-- ---- quarantine_records — historie epizod karantény / izolace / dohledu ----
create table quarantine_records (
  id             uuid primary key default uuid_generate_v4(),
  animal_id      uuid not null references animals(id) on delete cascade,
  institution_id uuid not null references institutions(id) on delete cascade,
  kind           animal_supervision_status not null default 'quarantine',
  started_on     date not null default current_date,
  planned_until  date,
  ended_on       date,
  reason         text,
  exam_results   text,
  vet_decision   text,
  notes          text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on quarantine_records (animal_id, started_on desc);
create index on quarantine_records (institution_id);
-- Aktivní epizoda (právě probíhá) — bez ended_on.
create index on quarantine_records (animal_id) where ended_on is null;
-- Připomínka konce: plánovaný konec u běžící epizody.
create index on quarantine_records (planned_until)
  where ended_on is null and planned_until is not null;

-- ---- RLS -------------------------------------------------------------------
alter table quarantine_records enable row level security;
create policy "quarantine_records_member_all"
  on quarantine_records for all
  using (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  )
  with check (
    exists (select 1 from animals a
      where a.id = animal_id
        and institution_role(a.institution_id) in ('owner','admin','staff'))
  );
