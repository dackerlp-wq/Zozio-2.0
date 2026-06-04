-- Úkoly: počítadlo odložení + přepínač ranního souhrnu e-mailem.
alter table animal_tasks add column if not exists snooze_count int not null default 0;
alter table institutions add column if not exists task_digest_enabled boolean not null default true;

comment on column animal_tasks.snooze_count is 'Kolikrát byl úkol odložen (snooze).';
comment on column institutions.task_digest_enabled is 'Posílat ranní e-mailový souhrn úkolů.';
