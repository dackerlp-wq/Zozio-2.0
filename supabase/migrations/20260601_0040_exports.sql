-- Evidence & exporty: log odevzdání, šablony sloupců, tarif + naplánované exporty.

-- Historie odevzdání (co/kdy/kdo + příznak „odevzdáno KVS").
create table if not exists export_log (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  kind text not null,                       -- kvs | annual | accounting | zip | dossier | gdpr | <report key>
  format text not null,                     -- pdf | csv | xlsx | zip
  label text not null,
  period_from date,
  period_to date,
  submitted_to_kvs boolean not null default false,
  submitted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists export_log_inst_idx
  on export_log (institution_id, created_at desc);

comment on table export_log is 'Historie vygenerovaných exportů + příznak odevzdání KVS.';

-- Uložené šablony sloupců pro datové přehledy.
create table if not exists export_column_templates (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  report_key text not null,                 -- klíč přehledu (intake, output…)
  name text not null,
  columns text[] not null,                  -- vybrané sloupce (názvy hlaviček) v pořadí
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists export_tpl_inst_idx
  on export_column_templates (institution_id, report_key);

comment on table export_column_templates is 'Uložené výběry sloupců pro datové exporty.';

-- Tarif + naplánované exporty na úrovni instituce.
alter table institutions
  add column if not exists plan text not null default 'free',
  add column if not exists export_kvs_monthly boolean not null default false,
  add column if not exists export_accounting_monthly boolean not null default false;

comment on column institutions.plan is 'Tarif: free | standard | pro (gating dávkových exportů).';
comment on column institutions.export_kvs_monthly is 'Naplánovaný měsíční KVS export e-mailem.';
comment on column institutions.export_accounting_monthly is 'Naplánovaný měsíční účetní export e-mailem.';
