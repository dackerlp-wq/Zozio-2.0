-- Globální (platformní) nastavení — klíč/hodnota. Slouží např. pro banner
-- „testovací režim" na akviziční stránce /pro-utulky (počet volných míst).
create table if not exists platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table platform_settings is
  'Globální konfigurace platformy (key/value). Zápis jen service role / superadmin.';

-- Veřejná nastavení (např. banner) se čtou i na veřejných stránkách.
alter table platform_settings enable row level security;

drop policy if exists platform_settings_public_read on platform_settings;
create policy platform_settings_public_read
  on platform_settings for select
  using (true);

-- Výchozí stav banneru testovacího režimu pro útulky.
insert into platform_settings (key, value)
values (
  'shelter_testing_mode',
  '{"enabled": true, "total_spots": 5, "used_spots": 0}'::jsonb
)
on conflict (key) do nothing;
