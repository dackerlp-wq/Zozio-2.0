-- Rozšíření karantény: denní pozorování, sledování expozice (kontakty)
-- a protokol ukončení (vet. souhlas — povinný u izolace).

create table if not exists quarantine_observations (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animals (id) on delete cascade,
  quarantine_id uuid references quarantine_records (id) on delete cascade,
  observed_at timestamptz not null default now(),
  created_by uuid,
  note text,
  temperature numeric(4, 1),
  tags text[],
  flag text not null default 'ok' check (flag in ('ok', 'watch')),
  created_at timestamptz not null default now()
);
create index if not exists quarantine_observations_animal_idx
  on quarantine_observations (animal_id, observed_at desc);

alter table quarantine_observations enable row level security;
create policy "quarantine_observations_member_all"
  on quarantine_observations for all
  using (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  )
  with check (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  );

create table if not exists quarantine_contacts (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animals (id) on delete cascade,
  contact_animal_id uuid references animals (id) on delete set null,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists quarantine_contacts_animal_idx
  on quarantine_contacts (animal_id);

alter table quarantine_contacts enable row level security;
create policy "quarantine_contacts_member_all"
  on quarantine_contacts for all
  using (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  )
  with check (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  );

alter table quarantine_records
  add column if not exists vet_consent boolean not null default false;

comment on table quarantine_observations is 'Denní pozorování během dohledu (teplota, tagy příznaků, flag sledovat).';
comment on table quarantine_contacts is 'Zvířata v kontaktu (sledování expozice při ohnisku nákazy).';
comment on column quarantine_records.vet_consent is 'Veterinární souhlas s ukončením dohledu (povinný u izolace).';
