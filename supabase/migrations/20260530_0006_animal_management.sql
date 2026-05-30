-- ===========================================================================
-- Komplexní správa zvířat — Fáze 0 (základ)
-- Nové tabulky: historie stavů, váha, léčba, přesuny kotců, deník, úkoly.
-- Rozšíření enumů: adoption_status (životní cyklus), notification_type.
-- Stávající tabulky vaccinations / vet_records / kennels zůstávají, jen
-- jim postupně dostavíme UI.
-- ===========================================================================

-- ---- Rozšíření enumů -------------------------------------------------------
-- Plný životní cyklus zvířete. Veřejné RLS i nadále pustí jen
-- 'available' + 'reserved', takže nové stavy jsou automaticky skryté.
alter type adoption_status add value if not exists 'intake';
alter type adoption_status add value if not exists 'foster';
alter type adoption_status add value if not exists 'transferred';
alter type adoption_status add value if not exists 'returned';
alter type adoption_status add value if not exists 'deceased';

alter type notification_type add value if not exists 'task_due';

-- ---- Nové enumy ------------------------------------------------------------
create type treatment_type as enum (
  'medication', 'deworming', 'antiparasitic', 'other'
);

create type care_log_type as enum (
  'feeding', 'walk', 'play', 'grooming', 'behavior',
  'training', 'cleaning', 'note', 'photo', 'medical'
);

create type animal_task_type as enum (
  'vaccination', 'treatment', 'deworming', 'vet_checkup',
  'grooming', 'long_stay', 'adoption_followup', 'custom'
);

create type animal_task_status as enum ('open', 'done', 'dismissed');
create type animal_task_source as enum ('manual', 'auto');

-- ---------------------------------------------------------------------------
-- animal_status_events — auditní historie změn stavu
-- ---------------------------------------------------------------------------
create table animal_status_events (
  id           uuid primary key default uuid_generate_v4(),
  animal_id    uuid not null references animals(id) on delete cascade,
  from_status  adoption_status,
  to_status    adoption_status not null,
  note         text,
  changed_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on animal_status_events (animal_id, created_at desc);

-- ---------------------------------------------------------------------------
-- weight_logs — váha v čase
-- ---------------------------------------------------------------------------
create table weight_logs (
  id           uuid primary key default uuid_generate_v4(),
  animal_id    uuid not null references animals(id) on delete cascade,
  weight_kg    numeric(5,2) not null check (weight_kg > 0),
  measured_at  date not null default current_date,
  note         text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on weight_logs (animal_id, measured_at desc);

-- ---------------------------------------------------------------------------
-- treatments — léky, odčervení, antiparazitika (next_due → připomínky)
-- ---------------------------------------------------------------------------
create table treatments (
  id           uuid primary key default uuid_generate_v4(),
  animal_id    uuid not null references animals(id) on delete cascade,
  type         treatment_type not null default 'medication',
  name         text not null,
  dosage       text,
  frequency    text,
  start_date   date,
  end_date     date,
  next_due     date,
  notes        text,
  vet_name     text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on treatments (animal_id, created_at desc);
create index on treatments (next_due) where next_due is not null;

-- ---------------------------------------------------------------------------
-- kennel_assignments — historie přesunů mezi kotci
-- ---------------------------------------------------------------------------
create table kennel_assignments (
  id           uuid primary key default uuid_generate_v4(),
  animal_id    uuid not null references animals(id) on delete cascade,
  kennel_id    uuid not null references kennels(id) on delete cascade,
  moved_in_at  timestamptz not null default now(),
  moved_out_at timestamptz,
  note         text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on kennel_assignments (animal_id, moved_in_at desc);
-- Aktivní umístění (kde zvíře právě je) — jen jedno bez moved_out_at.
create index on kennel_assignments (kennel_id) where moved_out_at is null;

-- ---------------------------------------------------------------------------
-- care_log_entries — deník denní péče
-- ---------------------------------------------------------------------------
create table care_log_entries (
  id             uuid primary key default uuid_generate_v4(),
  animal_id      uuid not null references animals(id) on delete cascade,
  institution_id uuid not null references institutions(id) on delete cascade,
  type           care_log_type not null default 'note',
  note           text,
  photo_urls     text[] not null default '{}',
  logged_by      uuid references auth.users(id) on delete set null,
  logged_at      timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index on care_log_entries (animal_id, logged_at desc);
create index on care_log_entries (institution_id, logged_at desc);

-- ---------------------------------------------------------------------------
-- animal_tasks — úkoly a automatické připomínky
-- ---------------------------------------------------------------------------
create table animal_tasks (
  id             uuid primary key default uuid_generate_v4(),
  institution_id uuid not null references institutions(id) on delete cascade,
  animal_id      uuid references animals(id) on delete cascade,
  type           animal_task_type not null default 'custom',
  title          text not null,
  description    text,
  due_date       date,
  status         animal_task_status not null default 'open',
  assigned_to    uuid references auth.users(id) on delete set null,
  completed_at   timestamptz,
  completed_by   uuid references auth.users(id) on delete set null,
  source         animal_task_source not null default 'manual',
  source_ref     uuid,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on animal_tasks (institution_id, status, due_date);
create index on animal_tasks (animal_id) where animal_id is not null;
-- Deduplikace automatických úkolů (jeden auto úkol na zdroj+typ).
create unique index animal_tasks_auto_unique
  on animal_tasks (source_ref, type)
  where source = 'auto' and source_ref is not null;

create trigger _animal_tasks_updated_at before update on animal_tasks
  for each row execute function set_updated_at();

-- ===========================================================================
-- RLS — všechny nové tabulky jsou interní (nikdy ne veřejné).
-- Vzor: zápis smí owner/admin/staff, čtení každý člen instituce.
-- ===========================================================================

-- Zvířecí podtabulky (přes vazbu na animals) ---------------------------------
alter table animal_status_events enable row level security;
create policy "animal_status_events_member_all"
  on animal_status_events for all
  using (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  )
  with check (
    exists (select 1 from animals a
      where a.id = animal_id
        and institution_role(a.institution_id) in ('owner','admin','staff'))
  );

alter table weight_logs enable row level security;
create policy "weight_logs_member_all"
  on weight_logs for all
  using (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  )
  with check (
    exists (select 1 from animals a
      where a.id = animal_id
        and institution_role(a.institution_id) in ('owner','admin','staff'))
  );

alter table treatments enable row level security;
create policy "treatments_member_all"
  on treatments for all
  using (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  )
  with check (
    exists (select 1 from animals a
      where a.id = animal_id
        and institution_role(a.institution_id) in ('owner','admin','staff'))
  );

alter table kennel_assignments enable row level security;
create policy "kennel_assignments_member_all"
  on kennel_assignments for all
  using (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  )
  with check (
    exists (select 1 from animals a
      where a.id = animal_id
        and institution_role(a.institution_id) in ('owner','admin','staff'))
  );

-- Tabulky s institution_id ---------------------------------------------------
alter table care_log_entries enable row level security;
create policy "care_log_entries_member_read"
  on care_log_entries for select
  using (is_institution_member(institution_id));
create policy "care_log_entries_member_write"
  on care_log_entries for all
  using (institution_role(institution_id) in ('owner','admin','staff'))
  with check (institution_role(institution_id) in ('owner','admin','staff'));

alter table animal_tasks enable row level security;
create policy "animal_tasks_member_read"
  on animal_tasks for select
  using (is_institution_member(institution_id));
create policy "animal_tasks_member_write"
  on animal_tasks for all
  using (institution_role(institution_id) in ('owner','admin','staff'))
  with check (institution_role(institution_id) in ('owner','admin','staff'));
