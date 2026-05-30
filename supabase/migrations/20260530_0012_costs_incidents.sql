-- ===========================================================================
-- Fáze 11 — Náklady, úniky & exporty
-- animal_costs: evidence nákladů na zvíře (veterina, krmivo, kastrace, …).
-- animal_incidents: úniky/útěky a jiné mimořádné události.
-- ===========================================================================

do $$ begin
  create type animal_cost_category as enum
    ('vet', 'food', 'medication', 'castration', 'vaccination', 'transport', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type animal_incident_type as enum
    ('escape', 'injury', 'bite', 'conflict', 'other');
exception when duplicate_object then null; end $$;

-- ---- animal_costs ----------------------------------------------------------
create table animal_costs (
  id             uuid primary key default uuid_generate_v4(),
  animal_id      uuid not null references animals(id) on delete cascade,
  institution_id uuid not null references institutions(id) on delete cascade,
  category       animal_cost_category not null default 'other',
  amount         numeric(10,2) not null,
  spent_on       date not null default current_date,
  description    text,
  invoice_url    text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on animal_costs (animal_id, spent_on desc);
create index on animal_costs (institution_id, spent_on desc);

-- ---- animal_incidents ------------------------------------------------------
create table animal_incidents (
  id             uuid primary key default uuid_generate_v4(),
  animal_id      uuid not null references animals(id) on delete cascade,
  institution_id uuid not null references institutions(id) on delete cascade,
  kind           animal_incident_type not null default 'escape',
  occurred_on    date not null default current_date,
  resolved_on    date,              -- u úniku datum odchycení / návratu
  location       text,
  description    text,
  resolution     text,              -- jak byla událost vyřešena
  reported_to    text,              -- nahlášeno (policie, KVS, …)
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on animal_incidents (animal_id, occurred_on desc);
create index on animal_incidents (institution_id, kind, occurred_on desc);

-- ---- RLS -------------------------------------------------------------------
alter table animal_costs enable row level security;
create policy "animal_costs_member_all"
  on animal_costs for all
  using (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  )
  with check (
    exists (select 1 from animals a
      where a.id = animal_id
        and institution_role(a.institution_id) in ('owner','admin','staff'))
  );

alter table animal_incidents enable row level security;
create policy "animal_incidents_member_all"
  on animal_incidents for all
  using (
    exists (select 1 from animals a
      where a.id = animal_id and is_institution_member(a.institution_id))
  )
  with check (
    exists (select 1 from animals a
      where a.id = animal_id
        and institution_role(a.institution_id) in ('owner','admin','staff'))
  );
