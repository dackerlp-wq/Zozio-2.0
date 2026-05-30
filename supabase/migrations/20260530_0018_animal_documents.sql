-- ---------------------------------------------------------------------------
-- Dokumenty zvířete — lékařské zprávy, smlouvy, příjmové doklady atp.
-- Soubory se ukládají do storage bucketu „animals" (cesta {institutionId}/documents/…),
-- metadata sem.
-- ---------------------------------------------------------------------------

create type animal_document_category as enum (
  'medical',       -- Lékařská zpráva
  'vaccination',   -- Očkovací průkaz
  'lab',           -- Laboratorní výsledky
  'contract',      -- Smlouva (adopce, převzetí…)
  'intake',        -- Příjmový doklad
  'registration',  -- Čipování / registrace / pas
  'other'          -- Ostatní
);

create table animal_documents (
  id             uuid primary key default uuid_generate_v4(),
  animal_id      uuid not null references animals(id) on delete cascade,
  institution_id uuid not null references institutions(id) on delete cascade,
  category       animal_document_category not null default 'other',
  title          text not null,
  file_url       text not null,
  file_path      text not null,        -- cesta ve storage pro mazání
  file_name      text,                 -- původní název souboru
  file_size      integer,              -- v bajtech
  mime_type      text,
  document_date  date,                 -- datum vystavení dokladu (volitelné)
  notes          text,
  uploaded_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index on animal_documents (animal_id, created_at desc);
create index on animal_documents (institution_id, category);

alter table animal_documents enable row level security;

create policy "animal_documents_member_read"
  on animal_documents for select
  using (is_institution_member(institution_id));

create policy "animal_documents_member_write"
  on animal_documents for all
  using (institution_role(institution_id) in ('owner','admin','staff'))
  with check (institution_role(institution_id) in ('owner','admin','staff'));
