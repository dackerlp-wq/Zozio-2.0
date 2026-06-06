-- Krok 28 — Veřejný detail zvířete: cache AI „Ideální domov".
-- Deterministická verze se počítá vždy; tady jen ukládáme hezčí AI formulace,
-- aby se AI nevolalo při každém načtení. Invalidace přes attr_hash.

create table if not exists animal_ideal_home (
  animal_id uuid primary key references animals(id) on delete cascade,
  fits text[] not null default '{}',
  not_fits text[] not null default '{}',
  attr_hash text not null,
  generated_at timestamptz not null default now()
);

-- Veřejné čtení (anon) — text je neutrální, žádná citlivá data.
alter table animal_ideal_home enable row level security;
create policy "ideal_home_public_read" on animal_ideal_home for select using (true);
