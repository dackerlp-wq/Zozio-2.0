-- Web & obsah: obsah (články/příběhy/akce), newsletter, widget config.

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  type text not null check (type in ('article', 'story', 'event')),
  title text not null,
  slug text not null,
  category text,
  excerpt text,
  body text,
  cover_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'scheduled')),
  published_at timestamptz,
  scheduled_at timestamptz,
  view_count int not null default 0,
  animal_id uuid references animals(id) on delete set null,
  event_date date,
  event_location text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, slug)
);
create index if not exists content_inst_type_idx on content_items (institution_id, type, status);
comment on table content_items is 'Veřejný obsah útulku — články, příběhy, akce.';

create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  email text not null,
  segment text not null default 'supporter' check (segment in ('donor', 'adopter', 'supporter')),
  consent_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (institution_id, email)
);
create index if not exists nl_subs_inst_idx on newsletter_subscribers (institution_id, segment);

create table if not exists newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  subject text not null,
  body text,
  segment text not null default 'all',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipients int not null default 0,
  opens int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists nl_camp_inst_idx on newsletter_campaigns (institution_id, created_at desc);

alter table institutions add column if not exists widget_config jsonb;

-- RLS: publikovaný obsah je veřejně čitelný.
alter table content_items enable row level security;
create policy "content_public_read" on content_items for select
  using (status = 'published');
create policy "content_member_read" on content_items for select
  using (is_institution_member(institution_id));

alter table newsletter_subscribers enable row level security;
alter table newsletter_campaigns enable row level security;
create policy "nl_camp_member_read" on newsletter_campaigns for select
  using (is_institution_member(institution_id));
create policy "nl_subs_member_read" on newsletter_subscribers for select
  using (is_institution_member(institution_id));

-- Atomický inkrement zobrazení obsahu.
create or replace function increment_content_view(_id uuid)
returns void language sql security definer as $$
  update content_items set view_count = view_count + 1 where id = _id;
$$;
