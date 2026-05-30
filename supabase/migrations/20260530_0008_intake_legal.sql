-- ===========================================================================
-- Fáze 7 — Příjem & právní stav (ochranná lhůta)
-- Druhá osa stavu: legal_status (čí zvíře je / běh ochranné lhůty).
-- adoption_status zůstává jako osa „umístění" (kvůli RLS veřejného katalogu).
-- ===========================================================================

-- ---- Enumy -----------------------------------------------------------------
create type animal_legal_status as enum (
  'in_protection',    -- běží ochranná lhůta (původní majitel se může přihlásit)
  'shelter_owned',    -- útulek může volně nakládat
  'owner_claimed',    -- přihlásil se původní majitel, řeší se návrat
  'transferred_out'   -- vlastnictví převedeno pryč (adopce/návrat/transfer)
);

create type animal_intake_type as enum (
  'found',         -- nález
  'surrender',     -- odevzdal majitel
  'transfer',      -- převzato z jiného útulku
  'confiscation',  -- odebráno / zabaveno
  'born',          -- narozeno v útulku
  'other'
);

-- Nový typ úkolu pro připomínku konce ochranné lhůty.
alter type animal_task_type add value if not exists 'protection_deadline';

-- ---- Animals: právní stav + příjem + identifikace --------------------------
alter table animals
  add column legal_status        animal_legal_status not null default 'shelter_owned',
  add column intake_type         animal_intake_type,
  add column found_location      text,
  add column found_date          date,
  add column announced_at        date,         -- datum vyhlášení nálezu
  add column protection_until    date,         -- konec ochranné lhůty
  add column original_owner      text,         -- jméno původního majitele
  add column surrender_waiver_at date,         -- datum vzdání se práv
  add column surrender_waiver_url text,         -- sken dokladu o vzdání práv
  add column handed_over_by      text,         -- kdo zvíře předal / přinesl
  add column intake_condition    text,         -- stav při příjmu
  add column intake_documents    text[] not null default '{}',
  add column tattoo              text,         -- tetování
  add column ear_tag             text,         -- známka
  add column record_number       text;         -- interní evidenční číslo

create index on animals (institution_id, legal_status);
create index on animals (protection_until) where protection_until is not null;
-- Evidenční číslo unikátní v rámci instituce.
create unique index animals_record_number_unique
  on animals (institution_id, record_number)
  where record_number is not null;

-- ---- Nastavení útulku ------------------------------------------------------
alter table institutions
  add column protection_period_months  smallint not null default 4,
  add column show_protected_in_catalog boolean  not null default false,
  add column staff_can_manage_legal    boolean  not null default false,
  add column adoption_fee_default       numeric(10,2),
  add column foster_fee_enabled         boolean  not null default false;

-- ---- Veřejný katalog: skrýt zvířata v ochranné lhůtě (pokud útulek nechce) --
drop policy if exists "animals_public_read" on animals;
create policy "animals_public_read"
  on animals for select
  using (
    adoption_status in ('available', 'reserved')
    and exists (
      select 1 from institutions i
      where i.id = institution_id
        and i.is_published
        and (legal_status <> 'in_protection' or i.show_protected_in_catalog)
    )
  );
