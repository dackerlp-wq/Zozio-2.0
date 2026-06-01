-- Katalog plemen pro našeptávač v profilu zvířete.
-- Globální plemena (institution_id null) + vlastní per útulek. Do tabulky
-- animals se i nadále ukládá NÁZEV plemene jako text (breed/breed_secondary),
-- aby fungoval search_vector i veřejný web — tahle tabulka je jen číselník.

create table if not exists animal_breeds (
  id uuid primary key default gen_random_uuid(),
  species text not null check (species in ('dog', 'cat', 'rabbit', 'other')),
  name text not null,
  -- null = globální katalog; jinak vlastní plemeno útulku
  institution_id uuid references institutions (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table animal_breeds is
  'Číselník plemen pro našeptávač (globální + vlastní per útulek). Do animals se ukládá název.';

-- Jedinečnost zvlášť pro globální a pro institucí vlastněná plemena.
create unique index if not exists animal_breeds_global_uq
  on animal_breeds (species, lower(name))
  where institution_id is null;
create unique index if not exists animal_breeds_inst_uq
  on animal_breeds (institution_id, species, lower(name))
  where institution_id is not null;

create index if not exists animal_breeds_species_idx
  on animal_breeds (species, institution_id);

alter table animal_breeds enable row level security;

-- Číst smí kdokoli globální plemena + člen útulku ta svoje.
create policy "animal_breeds_read"
  on animal_breeds for select
  using (institution_id is null or is_institution_member(institution_id));

-- Zakládat/mazat vlastní plemena smí jen člen daného útulku.
create policy "animal_breeds_write"
  on animal_breeds for all
  using (
    institution_id is not null
    and institution_role(institution_id) in ('owner', 'admin', 'staff')
  )
  with check (
    institution_id is not null
    and institution_role(institution_id) in ('owner', 'admin', 'staff')
  );

-- --- Seed globálního katalogu ---------------------------------------------
insert into animal_breeds (species, name) values
  -- Psi
  ('dog', 'Labrador'),
  ('dog', 'Zlatý retrívr'),
  ('dog', 'Německý ovčák'),
  ('dog', 'Belgický ovčák'),
  ('dog', 'Border kolie'),
  ('dog', 'Kolie'),
  ('dog', 'Jack Russell teriér'),
  ('dog', 'Yorkshire teriér'),
  ('dog', 'Jezevčík'),
  ('dog', 'Čivava'),
  ('dog', 'Pudl'),
  ('dog', 'Boxer'),
  ('dog', 'Rotvajler'),
  ('dog', 'Dobrman'),
  ('dog', 'Stafordšírský bulteriér'),
  ('dog', 'Americký stafordšírský teriér'),
  ('dog', 'Pitbull'),
  ('dog', 'Francouzský buldoček'),
  ('dog', 'Anglický buldok'),
  ('dog', 'Bígl'),
  ('dog', 'Kokršpaněl'),
  ('dog', 'Špic'),
  ('dog', 'Sibiřský husky'),
  ('dog', 'Aljašský malamut'),
  ('dog', 'Knírač'),
  ('dog', 'Pinč'),
  ('dog', 'Bernský salašnický pes'),
  ('dog', 'Akita inu'),
  ('dog', 'Šarpej'),
  ('dog', 'Maltézský psík'),
  ('dog', 'Bišonek'),
  ('dog', 'Dalmatin'),
  ('dog', 'Setr'),
  ('dog', 'Pointr'),
  ('dog', 'Foxteriér'),
  ('dog', 'Český teriér'),
  ('dog', 'Československý vlčák'),
  ('dog', 'Briard'),
  ('dog', 'Výmarský ohař'),
  ('dog', 'Vizsla'),
  -- Kočky
  ('cat', 'Evropská krátkosrstá'),
  ('cat', 'Britská krátkosrstá'),
  ('cat', 'Perská'),
  ('cat', 'Mainská mývalí'),
  ('cat', 'Ragdoll'),
  ('cat', 'Sphynx'),
  ('cat', 'Sibiřská'),
  ('cat', 'Norská lesní'),
  ('cat', 'Bengálská'),
  ('cat', 'Habešská'),
  ('cat', 'Barmská'),
  ('cat', 'Siamská'),
  ('cat', 'Ruská modrá'),
  ('cat', 'Skotská klapouchá'),
  ('cat', 'Kartouzská'),
  ('cat', 'Mourovatá'),
  -- Králíci
  ('rabbit', 'Zakrslý beránek'),
  ('rabbit', 'Zakrslý králík'),
  ('rabbit', 'Holandský zakrslý'),
  ('rabbit', 'Lví hlava'),
  ('rabbit', 'Rex'),
  ('rabbit', 'Český strakáč'),
  ('rabbit', 'Kalifornský'),
  ('rabbit', 'Novozélandský'),
  ('rabbit', 'Belgický obr'),
  ('rabbit', 'Angorský')
on conflict do nothing;
