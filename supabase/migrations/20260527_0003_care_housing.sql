begin;

-- Care difficulty enum + column
create type care_difficulty as enum ('easy', 'medium', 'high');

alter table animals
  add column if not exists care_difficulty care_difficulty;

create index if not exists animals_care_difficulty_idx
  on animals (care_difficulty);

-- Suitable housing enum + column
create type suitable_housing as enum ('apartment', 'house', 'both');

alter table animals
  add column if not exists suitable_housing suitable_housing;

create index if not exists animals_suitable_housing_idx
  on animals (suitable_housing);

-- Seed variety into existing rows
update animals set care_difficulty = 'easy',   suitable_housing = 'both'
  where name in ('Bobík', 'Bella', 'Hugo', 'Felix', 'Daisy', 'Mia');
update animals set care_difficulty = 'medium', suitable_housing = 'both'
  where name in ('Luna', 'Charlie', 'Stella', 'Riky', 'Oscar');
update animals set care_difficulty = 'medium', suitable_housing = 'apartment'
  where name in ('Tobík', 'Coco');
update animals set care_difficulty = 'high',   suitable_housing = 'house'
  where name in ('Rocky', 'Max', 'Sára', 'Goliáš', 'Nina');

commit;
