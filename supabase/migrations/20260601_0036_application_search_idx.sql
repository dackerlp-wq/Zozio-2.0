-- Výkon seznamu žádostí: hledání zájemce/místo + řazení dle data.
create index if not exists applications_name_trgm on applications using gin (lower(applicant_name) gin_trgm_ops);
create index if not exists applications_city_idx on applications (applicant_city);
create index if not exists applications_created_idx on applications (institution_id, created_at desc);
