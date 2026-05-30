-- ===========================================================================
-- Fáze 12 — Plný příjmový protokol
-- Rozšiřuje příjem zvířete o pole potřebná pro řádný příjmový protokol:
-- přesný čas příjmu, GPS nálezu, kontakt předávajícího, stav identifikace,
-- potřeba veterinární péče, trvání karantény, přijímající personál,
-- obecné poznámky a nepovinné registry (obec, evidence nalezenců).
-- ===========================================================================

-- ---- Enum: potřeba veterinární péče při příjmu -----------------------------
create type animal_vet_care_need as enum (
  'none',       -- není potřeba
  'required',   -- nutná (okamžitě)
  'scheduled',  -- plánovaná
  'deferred'    -- odložená
);

-- ---- Animals: nová příjmová pole -------------------------------------------
alter table animals
  add column intake_time          time,                 -- čas příjmu (k intake_date)
  add column found_lat            double precision,     -- GPS šířka místa nálezu
  add column found_lng            double precision,     -- GPS délka místa nálezu
  add column handed_over_phone    text,                 -- telefon předávajícího
  add column handed_over_email    text,                 -- e-mail předávajícího
  add column identification_none  boolean not null default false, -- potvrzeno „bez identifikace"
  add column vet_care_need        animal_vet_care_need, -- potřeba vet. péče při příjmu
  add column intake_quarantine_days smallint check (intake_quarantine_days between 0 and 365),
  add column intake_staff         text,                 -- jméno / role přijímající osoby
  add column intake_notes         text,                 -- obecné poznámky k příjmu
  add column municipality_ref     text,                 -- evidenční číslo obce
  add column registry_name        text;                 -- registr / evidence nalezenců
