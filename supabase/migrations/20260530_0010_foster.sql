-- ===========================================================================
-- Fáze 9 — Pěstouni & dočasná péče
-- foster_carers: evidence pěstounů (kontakty, kapacita, smlouvy, historie).
-- foster_placements: jednotlivá umístění zvířete do dočasné péče (epizody).
-- ===========================================================================

-- Nový typ úkolu pro připomínku konce / kontroly dočasné péče.
alter type animal_task_type add value if not exists 'foster_followup';

-- ---- foster_carers ---------------------------------------------------------
create table foster_carers (
  id             uuid primary key default uuid_generate_v4(),
  institution_id uuid not null references institutions(id) on delete cascade,
  name           text not null,
  email          text,
  phone          text,
  address        text,
  city           text,
  region         text,
  capacity       smallint,          -- kolik zvířat zvládne najednou
  species_note   text,              -- jaké druhy/velikosti zvládne
  notes          text,
  is_active      boolean not null default true,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on foster_carers (institution_id, is_active);

create trigger _foster_carers_updated_at before update on foster_carers
  for each row execute function set_updated_at();

-- ---- foster_placements -----------------------------------------------------
create table foster_placements (
  id               uuid primary key default uuid_generate_v4(),
  animal_id        uuid not null references animals(id) on delete cascade,
  institution_id   uuid not null references institutions(id) on delete cascade,
  carer_id         uuid not null references foster_carers(id) on delete restrict,
  started_on       date not null default current_date,
  planned_until    date,
  ended_on         date,
  end_reason       text,            -- vráceno do útulku / přešlo do adopce / …
  fee              numeric(10,2),   -- poplatek za dočasnou péči (volitelně)
  contract_url     text,
  contract_signed_at date,
  notes            text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index on foster_placements (animal_id, started_on desc);
create index on foster_placements (carer_id, started_on desc);
create index on foster_placements (institution_id);
-- Aktivní umístění (právě běží) — bez ended_on.
create index on foster_placements (animal_id) where ended_on is null;
create index on foster_placements (planned_until)
  where ended_on is null and planned_until is not null;

-- ---- RLS -------------------------------------------------------------------
alter table foster_carers enable row level security;
create policy "foster_carers_member_read"
  on foster_carers for select
  using (is_institution_member(institution_id));
create policy "foster_carers_member_write"
  on foster_carers for all
  using (institution_role(institution_id) in ('owner','admin','staff'))
  with check (institution_role(institution_id) in ('owner','admin','staff'));

alter table foster_placements enable row level security;
create policy "foster_placements_member_all"
  on foster_placements for all
  using (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  )
  with check (
    exists (select 1 from animals a
      where a.id = animal_id
        and institution_role(a.institution_id) in ('owner','admin','staff'))
  );
