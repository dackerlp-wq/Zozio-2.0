-- Pozastavení institucí: superadmin může ověřený útulek dočasně skrýt.
-- 'suspended' = byl schválený, ale teď je pozastavený (skrytý z veřejnosti).

alter type verification_status add value if not exists 'suspended';

alter table institutions
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text;

-- RLS „institutions_public_read" už zveřejňuje jen verification_status = 'approved',
-- takže pozastavené (suspended) instituce jsou automaticky skryté.
