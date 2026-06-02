-- Ekonomika zvířete: zdroj nákladu (chip) + příjmy a věcné dary.

-- Zdroj nákladu pro chip: ruční / auto ze Zdraví / pěstoun / Darujme / adopce / příjem.
alter table animal_costs add column if not exists source text not null default 'manual'
  check (source in ('manual', 'health', 'foster', 'darujme', 'adoption', 'intake'));

-- Příjmy + věcné (nefinanční) dary vázané na zvíře.
create table if not exists animal_donations (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animals (id) on delete cascade,
  institution_id uuid not null references institutions (id) on delete cascade,
  kind text not null check (kind in ('money', 'in_kind')),
  amount numeric, -- peněžní částka / odhadní hodnota věcného daru
  item text, -- název věcného daru (jen in_kind)
  donor text, -- dárce
  source text not null default 'manual' check (source in ('manual', 'darujme', 'sponsoring')),
  occurred_on date not null default current_date,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists animal_donations_animal_idx on animal_donations (animal_id, occurred_on desc);

alter table animal_donations enable row level security;
create policy "animal_donations_member_all"
  on animal_donations for all
  using (exists (select 1 from animals a where a.id = animal_id and is_institution_member(a.institution_id)))
  with check (exists (select 1 from animals a where a.id = animal_id and is_institution_member(a.institution_id)));

comment on column animal_costs.source is 'Původ nákladu: manual / health / foster / darujme / adoption / intake.';
comment on table animal_donations is 'Peněžní příjmy a věcné (nefinanční) dary vázané na zvíře. Věcné dary se nepočítají do cash bilance.';
