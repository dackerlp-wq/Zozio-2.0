-- ===========================================================================
-- Úkoly — priorita
-- Přidává prioritu (nízká/normální/vysoká) k animal_tasks pro řazení a filtraci.
-- ===========================================================================

create type animal_task_priority as enum ('low', 'normal', 'high');

alter table animal_tasks
  add column priority animal_task_priority not null default 'normal';

-- Řazení v inboxu: nejdřív vysoká priorita, pak podle termínu.
create index on animal_tasks (institution_id, status, priority, due_date);
