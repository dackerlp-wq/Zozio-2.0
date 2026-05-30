-- ===========================================================================
-- Pravidelné (opakované) úkoly — task_schedules
-- ---------------------------------------------------------------------------
-- Šablona opakovaného úkolu. Denní cron z ní „materializuje" konkrétní
-- záznamy do animal_tasks. animal_id = NULL → všeobecný úkol útulku,
-- jinak úkol vázaný na konkrétní zvíře (stejná logika jako u animal_tasks).
-- ===========================================================================

create type task_schedule_freq as enum ('daily', 'weekly', 'monthly', 'yearly');

create table task_schedules (
  id                uuid primary key default uuid_generate_v4(),
  institution_id    uuid not null references institutions(id) on delete cascade,
  animal_id         uuid references animals(id) on delete cascade,
  type              animal_task_type not null default 'custom',
  title             text not null,
  description       text,
  priority          animal_task_priority not null default 'normal',
  assigned_to       uuid references auth.users(id) on delete set null,
  freq              task_schedule_freq not null,
  interval          integer not null default 1 check (interval >= 1),
  start_date        date not null,
  end_date          date,
  -- Předstih: úkol vznikne o tolik dní dřív, než je jeho termín.
  lead_days         integer not null default 0 check (lead_days >= 0),
  -- Datum příští instance, kterou má cron vytvořit (= due_date úkolu).
  next_run          date not null,
  active            boolean not null default true,
  last_generated_at timestamptz,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on task_schedules (institution_id, active, next_run);
create index on task_schedules (animal_id) where animal_id is not null;

create trigger _task_schedules_updated_at before update on task_schedules
  for each row execute function set_updated_at();

-- Napojení vygenerovaných úkolů na šablonu + deduplikace na jednu instanci
-- na konkrétní datum opakování.
alter table animal_tasks
  add column schedule_id uuid references task_schedules(id) on delete set null,
  add column schedule_date date;

create unique index animal_tasks_schedule_unique
  on animal_tasks (schedule_id, schedule_date)
  where schedule_id is not null;

-- RLS — interní tabulka. Čte každý člen instituce, zapisuje owner/admin/staff.
alter table task_schedules enable row level security;
create policy "task_schedules_member_read"
  on task_schedules for select
  using (is_institution_member(institution_id));
create policy "task_schedules_member_write"
  on task_schedules for all
  using (institution_role(institution_id) in ('owner','admin','staff'))
  with check (institution_role(institution_id) in ('owner','admin','staff'));
