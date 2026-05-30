-- Datum narození pro automatický výpočet aktuálního věku.
--
-- birth_date            — kotva pro živý výpočet věku (z přesného data narození
--                         nebo dopočtené z věku uvedeného při příjmu).
-- birth_date_is_estimate — true = odhad dopočtený z věku + data příjmu,
--                          false = přesné datum narození zadané ručně.
--
-- Sloupce age_years/age_months zůstávají pro ruční zadání „věku při příjmu"
-- a jako fallback, když birth_date není k dispozici.

alter table animals
  add column if not exists birth_date date,
  add column if not exists birth_date_is_estimate boolean not null default true;

-- Backfill: dopočti birth_date stávajícím zvířatům z věku při příjmu
-- (kotva = datum příjmu, jinak datum vytvoření záznamu).
update animals
set
  birth_date = (
    coalesce(intake_date, created_at::date)
    - make_interval(
        years => coalesce(age_years, 0),
        months => coalesce(age_months, 0)
      )
  )::date,
  birth_date_is_estimate = true
where (age_years is not null or age_months is not null)
  and birth_date is null;
