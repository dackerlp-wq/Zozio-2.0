-- ---------------------------------------------------------------------------
-- Propojení šablony opakovaných úkolů se zdrojovým záznamem (např. léčbou).
-- Umožní automaticky vytvořit denní úkoly z léku a při smazání léku je uklidit.
-- ---------------------------------------------------------------------------

alter table task_schedules
  add column if not exists source_table text,
  add column if not exists source_id    uuid;

create index if not exists task_schedules_source_idx
  on task_schedules (source_table, source_id);
