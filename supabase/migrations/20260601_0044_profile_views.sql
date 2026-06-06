-- Lehké počítadlo zobrazení veřejného profilu zvířete (denní agregace).
create table if not exists animal_profile_views (
  animal_id uuid not null references animals(id) on delete cascade,
  institution_id uuid not null references institutions(id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (animal_id, day)
);
create index if not exists profile_views_inst_day_idx
  on animal_profile_views (institution_id, day);

comment on table animal_profile_views is 'Denní počet zobrazení veřejného profilu zvířete.';

-- Atomický inkrement (upsert) — volá veřejný profil.
create or replace function increment_profile_view(_animal_id uuid, _institution_id uuid)
returns void language sql security definer as $$
  insert into animal_profile_views (animal_id, institution_id, day, count)
  values (_animal_id, _institution_id, current_date, 1)
  on conflict (animal_id, day)
  do update set count = animal_profile_views.count + 1;
$$;
