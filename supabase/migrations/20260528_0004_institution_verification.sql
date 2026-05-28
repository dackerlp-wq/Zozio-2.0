-- Ověřování institucí: pending → approved / rejected.
-- Útulek po průchodu onboardingem čeká na schválení superadminem.

create type verification_status as enum ('pending', 'approved', 'rejected');

alter table institutions
  add column verification_status verification_status not null default 'pending',
  add column verified_at  timestamptz,
  add column rejection_reason text;

-- Existující útulky (seed) ber jako schválené, ať se nezneviditelní.
update institutions
  set verification_status = 'approved',
      verified_at = now()
  where is_verified = true;

create index on institutions (verification_status);

-- Veřejně viditelné jen schválené a zveřejněné instituce.
drop policy if exists "institutions_public_read" on institutions;
create policy "institutions_public_read"
  on institutions for select
  using (is_published = true and verification_status = 'approved');
