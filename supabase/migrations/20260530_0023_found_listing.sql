-- Katalog nalezenců „Hledají svého páníčka".
-- Nalezené zvíře v ochranné lhůtě se NESMÍ nabízet k adopci (původní majitel
-- se může přihlásit). Útulek ho ale může zveřejnit ve veřejném katalogu
-- nalezenců, aby majitele snáz našel. Tento příznak je ručně ovládaný
-- přepínač (s návrhem systému, když zvíře spadá do ochranné lhůty).
alter table animals
  add column if not exists found_listing_published boolean not null default false;

comment on column animals.found_listing_published is
  'Zveřejněno ve veřejném katalogu nalezenců „Hledají svého páníčka". Platí jen pro nalezená/odebraná zvířata v ochranné lhůtě.';
