-- Dostupnost pěstouna: nedostupný do data (jinak k dispozici).
alter table foster_carers
  add column if not exists unavailable_until date;

comment on column foster_carers.unavailable_until is
  'Pěstoun nedostupný do tohoto data (jinak k dispozici).';
