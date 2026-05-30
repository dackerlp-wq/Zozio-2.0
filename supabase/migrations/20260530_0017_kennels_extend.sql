-- Rozšíření systému kotců: zóna/sekce, typ kotce, provozní stav, povolené druhy.
-- Cíl: přehledná „nástěnka kotců" se seskupením a barevným odlišením.

-- Typ kotce (nahrazuje binární is_quarantine bohatší škálou; is_quarantine
-- zůstává a drží se synchronně kvůli zpětné kompatibilitě).
do $$ begin
  create type kennel_kind as enum (
    'standard',   -- běžný kotec / box
    'quarantine', -- karanténa
    'isolation',  -- izolace / marodka (nemocné)
    'intake',     -- příjmový kotec
    'outdoor',    -- venkovní výběh
    'cattery',    -- kočičí pokoj
    'maternity'   -- porodní / pro matky s mláďaty
  );
exception when duplicate_object then null; end $$;

-- Provozní stav kotce.
do $$ begin
  create type kennel_status as enum (
    'active',         -- v provozu
    'cleaning',       -- úklid / dezinfekce
    'out_of_service', -- mimo provoz
    'reserved'        -- rezervováno
  );
exception when duplicate_object then null; end $$;

alter table public.kennels
  add column if not exists zone text,
  add column if not exists kind kennel_kind not null default 'standard',
  add column if not exists status kennel_status not null default 'active',
  add column if not exists species_allowed species[] not null default '{}',
  add column if not exists sort_order integer not null default 0;

-- Backfill: dosavadní karanténní kotce dostanou odpovídající typ.
update public.kennels set kind = 'quarantine'
  where is_quarantine = true and kind = 'standard';

-- Řazení v nástěnce: nejprve zóna, pak ruční pořadí, pak název.
create index if not exists kennels_institution_zone_idx
  on public.kennels (institution_id, zone, sort_order, name);
