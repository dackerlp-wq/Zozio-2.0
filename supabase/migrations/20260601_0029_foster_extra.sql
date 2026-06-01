-- Rozšíření pěstounské péče: režim ustájení útulku, štítky a typ péče,
-- kontroly, komunikace s pěstounem a proplacení nákladů s vazbou na umístění.

-- Režim ustájení + vypnutí pěstounů na úrovni instituce.
alter table institutions
  add column if not exists housing_mode text not null default 'physical',
  add column if not exists foster_enabled boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'institutions_housing_mode_chk') then
    alter table institutions
      add constraint institutions_housing_mode_chk
      check (housing_mode in ('physical', 'foster_network', 'hybrid'));
  end if;
end $$;

-- Štítky/dovednosti pěstouna + typ péče u umístění.
alter table foster_carers add column if not exists tags text[];
alter table foster_placements add column if not exists care_type text;

-- Proplacení nákladů s vazbou na konkrétní umístění.
alter table animal_costs
  add column if not exists placement_id uuid references foster_placements (id) on delete set null;

-- Kontroly péče (check-iny).
create table if not exists foster_checkins (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animals (id) on delete cascade,
  placement_id uuid references foster_placements (id) on delete cascade,
  checked_on date not null default current_date,
  method text check (method in ('phone', 'visit', 'message')),
  note text,
  photos text[],
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists foster_checkins_animal_idx on foster_checkins (animal_id, checked_on desc);

alter table foster_checkins enable row level security;
create policy "foster_checkins_member_all"
  on foster_checkins for all
  using (exists (select 1 from animals a where a.id = animal_id and is_institution_member(a.institution_id)))
  with check (exists (select 1 from animals a where a.id = animal_id and is_institution_member(a.institution_id)));

-- Komunikace s pěstounem.
create table if not exists foster_communications (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animals (id) on delete cascade,
  placement_id uuid references foster_placements (id) on delete cascade,
  kind text check (kind in ('call', 'message', 'email')),
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists foster_communications_animal_idx on foster_communications (animal_id, created_at desc);

alter table foster_communications enable row level security;
create policy "foster_communications_member_all"
  on foster_communications for all
  using (exists (select 1 from animals a where a.id = animal_id and is_institution_member(a.institution_id)))
  with check (exists (select 1 from animals a where a.id = animal_id and is_institution_member(a.institution_id)));

comment on column institutions.housing_mode is 'physical = kamenný útulek, foster_network = pěstounská síť, hybrid = obojí.';
comment on column institutions.foster_enabled is 'Zapnutí pěstounské péče v útulku.';
comment on column foster_carers.tags is 'Dovednosti/preference pěstouna (umí léky, zahrada, velcí psi…).';
comment on column foster_placements.care_type is 'Typ péče (rekonvalescence, krátkodobá, dlouhodobá, paliativní, socializace, odchov).';
