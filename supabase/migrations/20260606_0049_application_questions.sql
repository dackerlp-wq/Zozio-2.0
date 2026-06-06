-- Krok 29 — Vlastní otázky útulku k žádosti o adopci.
-- Útulek si v Nastavení → Adopce definuje doplňující pole; veřejný formulář
-- je vykreslí a odpovědi uloží do applications.applicant_data.custom.

create table if not exists application_questions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  label text not null,
  field_type text not null default 'text' check (field_type in ('text', 'textarea', 'select', 'boolean')),
  options text[] not null default '{}',
  required boolean not null default false,
  species text[] not null default '{}', -- prázdné = pro všechny druhy
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists application_questions_inst_idx
  on application_questions (institution_id, active, sort_order);

alter table application_questions enable row level security;

-- Veřejné čtení aktivních otázek (pro veřejný formulář).
create policy "appq_public_read" on application_questions for select
  using (active = true);
-- Členové útulku vidí i neaktivní a spravují.
create policy "appq_member_all" on application_questions for all
  using (is_institution_member(institution_id))
  with check (is_institution_member(institution_id));
