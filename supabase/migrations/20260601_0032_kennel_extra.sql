-- Rozšíření kotců: vlastnosti pro vhodnost umístění + foto.
-- (Stav „mimo provoz" už řeší sloupec status = out_of_service / cleaning.)
alter table kennels
  add column if not exists is_heated boolean not null default false,
  add column if not exists is_accessible boolean not null default false,
  add column if not exists is_maternity boolean not null default false,
  add column if not exists photo_url text;

comment on column kennels.is_heated is 'Vytápěný kotec.';
comment on column kennels.is_accessible is 'Bezbariérový přístup.';
comment on column kennels.is_maternity is 'Vhodný pro matku s mláďaty.';
comment on column kennels.photo_url is 'Foto kotce (veřejná URL / storage).';
