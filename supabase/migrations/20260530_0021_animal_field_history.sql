-- ---------------------------------------------------------------------------
-- Auditní historie změn jednotlivých polí zvířete.
-- Ukládá každou změněnou hodnotu (z čeho → na co), kdo a kdy ji provedl.
-- Doplňuje animal_status_events (změny životního stavu) o profil/příjem/atd.
-- ---------------------------------------------------------------------------

create table if not exists animal_field_history (
  id              uuid primary key default uuid_generate_v4(),
  animal_id       uuid not null references animals(id) on delete cascade,
  institution_id  uuid not null references institutions(id) on delete cascade,
  field           text not null,
  old_value       text,
  new_value       text,
  changed_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists animal_field_history_animal_idx
  on animal_field_history (animal_id, created_at desc);
create index if not exists animal_field_history_institution_idx
  on animal_field_history (institution_id, created_at desc);

alter table animal_field_history enable row level security;

drop policy if exists "animal_field_history_member_all" on animal_field_history;
create policy "animal_field_history_member_all"
  on animal_field_history for all
  using (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  )
  with check (
    exists (select 1 from animals a
      where a.id = animal_id
        and institution_role(a.institution_id) in ('owner','admin','staff'))
  );
