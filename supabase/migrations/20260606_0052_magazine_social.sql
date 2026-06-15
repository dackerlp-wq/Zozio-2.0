-- Krok 31: Magazín — líbí, komentáře (vlákna + moderace) a vazba článek↔zvířata (M:N).
-- Články jsou ve dvou tabulkách: content_items (útulky) a magazine_posts (od Zozio).
-- Vazby proto míří na právě jednu z nich (dva nullable FK + CHECK).

-- 1) Líbí u článku (přihlášený přes user_id, host přes anon_token) — idempotentní.
create table if not exists article_likes (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid references content_items(id) on delete cascade,
  magazine_post_id uuid references magazine_posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  anon_token text,
  created_at timestamptz not null default now(),
  constraint article_likes_one_target check (
    (content_item_id is not null)::int + (magazine_post_id is not null)::int = 1
  ),
  constraint article_likes_one_identity check (
    user_id is not null or anon_token is not null
  )
);
create unique index if not exists article_likes_ci_user
  on article_likes (content_item_id, user_id)
  where content_item_id is not null and user_id is not null;
create unique index if not exists article_likes_ci_anon
  on article_likes (content_item_id, anon_token)
  where content_item_id is not null and anon_token is not null;
create unique index if not exists article_likes_mp_user
  on article_likes (magazine_post_id, user_id)
  where magazine_post_id is not null and user_id is not null;
create unique index if not exists article_likes_mp_anon
  on article_likes (magazine_post_id, anon_token)
  where magazine_post_id is not null and anon_token is not null;

-- 2) Komentáře (vlákna přes parent_id, moderace přes status).
create table if not exists article_comments (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid references content_items(id) on delete cascade,
  magazine_post_id uuid references magazine_posts(id) on delete cascade,
  parent_id uuid references article_comments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  guest_name text,
  body text not null,
  status text not null default 'pending' check (status in ('pending','approved','spam','hidden')),
  like_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_comments_one_target check (
    (content_item_id is not null)::int + (magazine_post_id is not null)::int = 1
  )
);
create index if not exists article_comments_ci_idx
  on article_comments (content_item_id, status, created_at);
create index if not exists article_comments_mp_idx
  on article_comments (magazine_post_id, status, created_at);

-- 3) Líbí u komentářů.
create table if not exists comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references article_comments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  anon_token text,
  created_at timestamptz not null default now(),
  constraint comment_likes_one_identity check (
    user_id is not null or anon_token is not null
  )
);
create unique index if not exists comment_likes_user
  on comment_likes (comment_id, user_id) where user_id is not null;
create unique index if not exists comment_likes_anon
  on comment_likes (comment_id, anon_token) where anon_token is not null;

-- 4) Článek ↔ zvířata (M:N). U příběhu předvyplněno z content_items.animal_id.
create table if not exists article_animals (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid references content_items(id) on delete cascade,
  magazine_post_id uuid references magazine_posts(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint article_animals_one_target check (
    (content_item_id is not null)::int + (magazine_post_id is not null)::int = 1
  )
);
create unique index if not exists article_animals_ci_animal
  on article_animals (content_item_id, animal_id) where content_item_id is not null;
create unique index if not exists article_animals_mp_animal
  on article_animals (magazine_post_id, animal_id) where magazine_post_id is not null;
create index if not exists article_animals_animal_idx on article_animals (animal_id);

-- Předvyplnění M:N vazby z existujících příběhů (content_items.animal_id).
insert into article_animals (content_item_id, animal_id)
select id, animal_id from content_items
where animal_id is not null
on conflict do nothing;

-- RLS: čtení veřejné (jen schválené komentáře), zápisy přes service client v server akcích.
alter table article_likes enable row level security;
alter table article_comments enable row level security;
alter table comment_likes enable row level security;
alter table article_animals enable row level security;

drop policy if exists article_likes_read on article_likes;
create policy article_likes_read on article_likes for select using (true);

drop policy if exists comment_likes_read on comment_likes;
create policy comment_likes_read on comment_likes for select using (true);

drop policy if exists article_animals_read on article_animals;
create policy article_animals_read on article_animals for select using (true);

drop policy if exists article_comments_read on article_comments;
create policy article_comments_read on article_comments
  for select using (status = 'approved');
