-- Rozšíření adopce: sledování zkušební doby a kontrola po adopci (check-iny
-- s fotkami), komunikační log s adoptantem a označení zaplaceného poplatku.

-- Označení zaplacení adopčního poplatku (chip „zaplaceno ✓").
alter table adoptions add column if not exists fee_paid_at timestamptz;

-- Kontroly adopce: zkušební doba (trial) i kontrola po adopci (post_adoption).
create table if not exists adoption_checkins (
  id uuid primary key default gen_random_uuid(),
  adoption_id uuid not null references adoptions (id) on delete cascade,
  animal_id uuid not null references animals (id) on delete cascade,
  kind text not null default 'trial' check (kind in ('trial', 'post_adoption')),
  checked_on date not null default current_date,
  method text check (method in ('phone', 'visit', 'message')),
  note text,
  photos text[],
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists adoption_checkins_animal_idx on adoption_checkins (animal_id, checked_on desc);
create index if not exists adoption_checkins_adoption_idx on adoption_checkins (adoption_id);

alter table adoption_checkins enable row level security;
create policy "adoption_checkins_member_all"
  on adoption_checkins for all
  using (exists (select 1 from animals a where a.id = animal_id and is_institution_member(a.institution_id)))
  with check (exists (select 1 from animals a where a.id = animal_id and is_institution_member(a.institution_id)));

-- Komunikace s adoptantem.
create table if not exists adoption_communications (
  id uuid primary key default gen_random_uuid(),
  adoption_id uuid not null references adoptions (id) on delete cascade,
  animal_id uuid not null references animals (id) on delete cascade,
  kind text check (kind in ('call', 'message', 'email')),
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists adoption_communications_animal_idx on adoption_communications (animal_id, created_at desc);
create index if not exists adoption_communications_adoption_idx on adoption_communications (adoption_id);

alter table adoption_communications enable row level security;
create policy "adoption_communications_member_all"
  on adoption_communications for all
  using (exists (select 1 from animals a where a.id = animal_id and is_institution_member(a.institution_id)))
  with check (exists (select 1 from animals a where a.id = animal_id and is_institution_member(a.institution_id)));

comment on column adoptions.fee_paid_at is 'Kdy byl adopční poplatek zaplacen (null = nezaplaceno).';
comment on table adoption_checkins is 'Kontroly během zkušební doby (trial) a kontrola po adopci (post_adoption), volitelně s fotkami.';
comment on table adoption_communications is 'Log komunikace s adoptantem (hovor / zpráva / e-mail).';
