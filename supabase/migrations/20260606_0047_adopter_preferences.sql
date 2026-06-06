-- Krok 27 — AI matching adoptanta: uložení odpovědí kvízu k návštěvnickému účtu.
-- Drží strukturované odpovědi, volný text a (volitelně) AI persona shrnutí.

create table if not exists adopter_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers jsonb not null default '{}',
  freetext text,
  ai_summary text,
  ai_weights jsonb,
  updated_at timestamptz not null default now()
);

-- Jen vlastník čte a zapisuje svoje preference.
alter table adopter_preferences enable row level security;
create policy "adopter_prefs_owner_read" on adopter_preferences for select
  using (auth.uid() = user_id);
create policy "adopter_prefs_owner_insert" on adopter_preferences for insert
  with check (auth.uid() = user_id);
create policy "adopter_prefs_owner_update" on adopter_preferences for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
