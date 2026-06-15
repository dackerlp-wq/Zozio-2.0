-- Handicap jako samostatný příznak (nezávislý na zdravotním stavu).
-- Zvíře může být zdravé, ale handicapované — proto checkbox + volný popis,
-- nikoli položka v číselníku zdravotního stavu.
alter table animals
  add column if not exists is_handicapped boolean not null default false,
  add column if not exists handicap_note text;

comment on column animals.is_handicapped is
  'Zvíře je handicapované (nezávisle na health_status).';
comment on column animals.handicap_note is
  'Popis handicapu — zobrazuje se v adminu i na veřejném profilu.';
