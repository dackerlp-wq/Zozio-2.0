-- Odložení úkolu (snooze): úkol zůstává otevřený, ale do dne snoozed_until
-- se skrývá z přehledů. Vrátí se v cílový den.
alter table animal_tasks add column if not exists snoozed_until date;

comment on column animal_tasks.snoozed_until is 'Úkol skryt z přehledů, dokud snoozed_until > dnes (snooze). null = nezobrazovat skrytě.';
