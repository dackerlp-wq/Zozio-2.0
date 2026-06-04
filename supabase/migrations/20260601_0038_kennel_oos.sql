-- Kotec „mimo provoz": důvod + do kdy (zobrazí se na šrafované kartě).
alter table kennels
  add column if not exists out_of_service_reason text,
  add column if not exists out_of_service_until date;

comment on column kennels.out_of_service_reason is 'Důvod vyřazení z provozu (dezinfekce, rekonstrukce…).';
comment on column kennels.out_of_service_until is 'Do kdy je kotec mimo provoz.';
