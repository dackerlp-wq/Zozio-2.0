-- Krok 26 — Veřejná homepage: celostátní „od Zozio" magazín (platform-level).
-- Tabulka BEZ institution_id — obsah spravuje superadmin (zatím se plní později).

create table if not exists magazine_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  body text,
  cover_url text,
  author text not null default 'Redakce Zozio',
  category text not null default 'news',
  status text not null default 'draft' check (status in ('draft', 'published')),
  featured boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists magazine_posts_pub_idx
  on magazine_posts (status, featured desc, published_at desc);

-- Veřejné čtení jen publikovaných (anon role). Zápis přes service role (superadmin).
alter table magazine_posts enable row level security;
create policy "magazine_public_read" on magazine_posts for select
  using (status = 'published');
