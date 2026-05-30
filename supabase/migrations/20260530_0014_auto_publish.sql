-- ===========================================================================
-- Fáze 13 — Automatické zveřejnění
-- Zvíře se může automaticky přepnout na „K adopci" a zveřejnit, jakmile to
-- dovolí připravenost (vyplněný příjem + uzavřená karanténa). Útulek může
-- automatiku u jednotlivého zvířete vypnout a řešit zveřejnění ručně.
-- ===========================================================================

alter table animals
  add column auto_publish boolean not null default true;

comment on column animals.auto_publish is
  'Automaticky přepnout na K adopci a zveřejnit, jakmile projde připraveností.';
