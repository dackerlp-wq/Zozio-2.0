-- Krok: per-zvíře adopční poplatek. Když je null, použije se výchozí poplatek
-- útulku (institutions.adoption_fee_default).
alter table animals add column if not exists adoption_fee integer;
