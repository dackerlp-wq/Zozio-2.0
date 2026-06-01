-- Adopční workflow: termín osobní schůzky, rezervace zvířete a stopa
-- odeslané připomínky den předem.

alter table applications
  add column if not exists meeting_at timestamptz,
  add column if not exists meeting_location text,
  add column if not exists meeting_reminder_sent_at timestamptz,
  add column if not exists reserved_at timestamptz;

comment on column applications.meeting_at is
  'Domluvený termín osobní schůzky (datum + čas).';
comment on column applications.meeting_location is
  'Místo osobní schůzky (volitelné).';
comment on column applications.meeting_reminder_sent_at is
  'Kdy byla odeslána připomínka den předem (proti duplicitě v cronu).';
comment on column applications.reserved_at is
  'Kdy žádost rezervovala zvíře (úspěšný telefonický kontakt).';

-- Rychlé dohledání nadcházejících schůzek pro cron připomínek.
create index if not exists applications_meeting_at_idx
  on applications (meeting_at)
  where meeting_at is not null;
