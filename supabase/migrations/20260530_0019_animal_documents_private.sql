-- ---------------------------------------------------------------------------
-- Privátní bucket pro dokumenty + propojení dokumentů se zdravotními záznamy.
-- Dokumenty mohou obsahovat osobní údaje (smlouvy), proto privátní úložiště
-- a přístup jen přes dočasné signed URL.
-- ---------------------------------------------------------------------------

-- Privátní bucket (public = false). Přístup výhradně přes service role + signed URL.
insert into storage.buckets (id, name, public)
values ('animal-documents', 'animal-documents', false)
on conflict (id) do nothing;

-- file_url už není povinné — u privátních dokumentů se generuje signed URL z file_path.
alter table animal_documents alter column file_url drop not null;

-- Volitelné propojení dokumentu se zdrojovým záznamem
-- (např. očkování, veterinární záznam, léčba).
alter table animal_documents
  add column if not exists related_table text,
  add column if not exists related_id   uuid;

create index if not exists animal_documents_related_idx
  on animal_documents (related_table, related_id);
