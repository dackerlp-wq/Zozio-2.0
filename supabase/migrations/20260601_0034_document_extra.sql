-- Rozšíření dokumentů: zdroj (auto/nahráno/sken), expirace, verzování.
alter table animal_documents
  add column if not exists source text not null default 'upload'
    check (source in ('generated', 'upload', 'scan')),
  add column if not exists expires_on date,
  add column if not exists version int not null default 1,
  add column if not exists supersedes_id uuid references animal_documents (id) on delete set null;

create index if not exists animal_documents_expires_idx on animal_documents (expires_on)
  where expires_on is not null;

comment on column animal_documents.source is 'Původ: generated (PDF modul) / upload (nahráno) / scan (📷 sken).';
comment on column animal_documents.expires_on is 'Platnost dokumentu (registrace…) → vlajka + úkol.';
comment on column animal_documents.version is 'Verze dokumentu (nová verze nepřepíše starou).';
comment on column animal_documents.supersedes_id is 'Předchozí verze, kterou tento dokument nahrazuje.';
