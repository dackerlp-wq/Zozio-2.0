-- Krok 32: spádové oblasti útulků — přiřazení obcí (granularita = obec, RÚIAN kód).
-- Každá obec patří max jednomu útulku → oblasti navazují bez děr a překryvů.
create table if not exists shelter_municipalities (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  obec_kod integer not null,
  obec_nazev text not null,
  okres_kod integer,
  created_at timestamptz not null default now(),
  -- 1 obec → max 1 útulek (zabrání překryvům spádových oblastí).
  unique (obec_kod)
);
create index if not exists shelter_municipalities_inst_idx
  on shelter_municipalities (institution_id);

-- RLS: čtení veřejné (mapa), zápis přes service client v server akcích (kontrola členství).
alter table shelter_municipalities enable row level security;
drop policy if exists shelter_municipalities_read on shelter_municipalities;
create policy shelter_municipalities_read on shelter_municipalities for select using (true);
