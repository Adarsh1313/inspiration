-- Design library: cards, capture task queue, private media bucket, limited worker role.

create table public.cards (
  id uuid primary key default gen_random_uuid(),

  -- identity and source
  slug text not null unique,
  canonical_key text not null unique,
  source_url text,
  source_type text not null check (source_type in ('x-post','github','reddit','youtube','site','video','linkedin')),

  -- content
  title text not null default '',
  author text,
  summary text,
  description text,
  kind text not null default 'site' check (kind in ('layout','animation','micro-interaction','component','asset','typography','skill','directory','person','talk')),
  shelf text not null check (shelf in ('landing-pages-portfolios','motion-interactions','agent-skills','backgrounds-assets','typography','tools-directories','talks-people','anti-slop')),
  tags text[] not null default '{}',
  mood jsonb not null default '{}'::jsonb,
  fits text[] not null default '{}',
  stack text[] not null default '{}',
  reuse text,
  notes text,
  video_description text,
  transcript text,

  -- state
  status text not null default 'draft' check (status in ('draft','active','archived')),
  media_status text not null default 'pending' check (media_status in ('pending','ready','failed')),
  media_error text,
  needs_review boolean not null default false,
  pinned boolean not null default false,

  -- usage and links
  used_in text[] not null default '{}',
  related uuid[] not null default '{}',

  -- directory fields
  browse_notes text,
  last_checked timestamptz,
  picks jsonb not null default '[]'::jsonb,
  item_count int,

  -- media (object names in the private "media" bucket) and dates
  poster_sm text,
  poster_lg text,
  preview text,
  original text,
  added_at timestamptz not null default now(),
  enriched_at timestamptz,

  constraint mood_is_object check (jsonb_typeof(mood) = 'object'),
  constraint picks_is_array check (jsonb_typeof(picks) = 'array')
);

create index cards_shelf_status_idx on public.cards (shelf, status);
create index cards_added_at_idx on public.cards (added_at desc);

-- Worker queue. Not called "jobs" so it never clashes with job postings.
create table public.capture_tasks (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  step text not null check (step in ('download','poster','preview','transcript','screenshot')),
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  attempts int not null default 0,
  locked_at timestamptz,
  last_error text,
  unique (card_id, step)
);
create index capture_tasks_status_idx on public.capture_tasks (status);

alter table public.cards enable row level security;
alter table public.capture_tasks enable row level security;

create policy owner_all on public.cards for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy owner_all on public.capture_tasks for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- Private media bucket: the owner reads and writes; nothing is public.
insert into storage.buckets (id, name, public) values ('media', 'media', false);
create policy owner_media on storage.objects for all to authenticated
  using (bucket_id = 'media' and public.is_owner())
  with check (bucket_id = 'media' and public.is_owner());

-- Limited role for the laptop worker. Set its password in the SQL editor (never in chat or git):
--   alter role hub_worker with login password '<generated>';
create role hub_worker nologin;
grant usage on schema public to hub_worker;

grant select on public.cards to hub_worker;
grant update (media_status, media_error, poster_sm, poster_lg, preview, original, transcript, video_description) on public.cards to hub_worker;
grant select on public.capture_tasks to hub_worker;
grant update (status, attempts, locked_at, last_error) on public.capture_tasks to hub_worker;

create policy worker_read on public.cards for select to hub_worker using (true);
create policy worker_update on public.cards for update to hub_worker using (true) with check (true);
create policy worker_read on public.capture_tasks for select to hub_worker using (true);
create policy worker_update on public.capture_tasks for update to hub_worker using (true) with check (true);
