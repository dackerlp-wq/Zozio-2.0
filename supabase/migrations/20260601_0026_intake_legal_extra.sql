-- Rozšíření příjmového protokolu: role přijímajícího, zdroj dle způsobu
-- příjmu (zdrojová instituce / orgán + číslo rozhodnutí), ověření čipu
-- v registru (zákonná povinnost u nalezenců) a hlášení na KVS.

alter table animals
  add column if not exists intake_staff_role text,
  add column if not exists source_institution text,
  add column if not exists confiscation_authority text,
  add column if not exists confiscation_ref text,
  add column if not exists chip_checked_at date,
  add column if not exists chip_check_result text,
  add column if not exists kvs_reported_at date;

-- Výsledek ověření čipu v registru.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'animals_chip_check_result_chk'
  ) then
    alter table animals
      add constraint animals_chip_check_result_chk
      check (chip_check_result in ('owner_not_found', 'owner_found', 'not_checked'));
  end if;
end $$;

comment on column animals.intake_staff_role is 'Role osoby, která zvíře přijala.';
comment on column animals.source_institution is 'Zdrojová instituce u převzetí z jiného útulku.';
comment on column animals.confiscation_authority is 'Orgán u odebrání/zabavení (KVS / policie / soud).';
comment on column animals.confiscation_ref is 'Číslo rozhodnutí u odebrání/zabavení.';
comment on column animals.chip_checked_at is 'Datum ověření čipu v registru.';
comment on column animals.chip_check_result is 'Výsledek ověření čipu: owner_not_found / owner_found / not_checked.';
comment on column animals.kvs_reported_at is 'Datum nahlášení na Krajskou veterinární správu (příznak = not null).';
