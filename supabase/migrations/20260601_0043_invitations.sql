-- Pozvánky do týmu útulku (token + expirace + role).
create table if not exists institution_invitations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  email text not null,
  role member_role not null default 'staff',
  token text not null unique,
  invited_by uuid,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invitations_inst_idx on institution_invitations (institution_id);
create index if not exists invitations_token_idx on institution_invitations (token);
create index if not exists invitations_email_idx on institution_invitations (lower(email));

comment on table institution_invitations is 'Pozvánky nových členů do týmu útulku.';

alter table institution_invitations enable row level security;

-- Členové útulku vidí jeho pozvánky; správa přes service role (server akce).
create policy "invitations_member_read"
  on institution_invitations for select
  using (is_institution_member(institution_id));
