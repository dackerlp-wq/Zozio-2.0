-- Add is_vaccinated boolean to animals (for /adopt filter)
alter table animals
  add column if not exists is_vaccinated boolean not null default false;

create index if not exists animals_is_vaccinated_idx
  on animals (is_vaccinated)
  where is_vaccinated = true;
