-- Výkon seznamu zvířat při škále: rychlé hledání + řazení. Bez nových sloupců.
create index if not exists animals_name_trgm on animals using gin (lower(name) gin_trgm_ops);
create index if not exists animals_record_number_idx on animals (record_number);
create index if not exists animals_chip_idx on animals (chip_number);
create index if not exists animals_tattoo_idx on animals (tattoo);
create index if not exists animals_intake_date_idx on animals (institution_id, intake_date desc);
create index if not exists animals_legal_idx on animals (institution_id, legal_status);
