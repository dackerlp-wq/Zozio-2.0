-- Rozšíření zdravotní záložky: log podání léků + rozvrh, chronické stavy,
-- napojení záznamů na náklady, fotodokumentace u ošetření, šarže vakcín.

-- 1) Rozvrh dávek na léčbě + log jednotlivých podání.
alter table treatments
  add column if not exists schedule_times text[],
  add column if not exists cost_id uuid references animal_costs (id) on delete set null;

create table if not exists medication_doses (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animals (id) on delete cascade,
  treatment_id uuid not null references treatments (id) on delete cascade,
  slot text,
  due_on date not null default current_date,
  given_at timestamptz,
  given_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists medication_doses_treatment_idx
  on medication_doses (treatment_id, due_on);

alter table medication_doses enable row level security;
create policy "medication_doses_member_all"
  on medication_doses for all
  using (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  )
  with check (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  );

-- 2) Chronické stavy / speciální potřeby.
create table if not exists animal_conditions (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animals (id) on delete cascade,
  institution_id uuid not null references institutions (id) on delete cascade,
  label text not null,
  is_public boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists animal_conditions_animal_idx
  on animal_conditions (animal_id);

alter table animal_conditions enable row level security;
create policy "animal_conditions_member_all"
  on animal_conditions for all
  using (is_institution_member(institution_id))
  with check (is_institution_member(institution_id));
-- Veřejně viditelné jsou jen stavy označené „na webu" u publikovaných zvířat.
create policy "animal_conditions_public_read"
  on animal_conditions for select
  using (
    is_public = true
    and exists (select 1 from animals a where a.id = animal_id and a.published_at is not null)
  );

-- 3) Napojení záznam → náklad + fotodokumentace + šarže vakcíny.
alter table vet_records
  add column if not exists cost_id uuid references animal_costs (id) on delete set null,
  add column if not exists photos text[];

alter table vaccinations
  add column if not exists cost_id uuid references animal_costs (id) on delete set null,
  add column if not exists batch text;

comment on table medication_doses is 'Log podání jednotlivých dávek léků (kdo + kdy) + denní sloty.';
comment on table animal_conditions is 'Chronické stavy / speciální potřeby zvířete (volitelně veřejné).';
comment on column treatments.schedule_times is 'Časy denních dávek, např. {08:00,13:00,20:00}.';
