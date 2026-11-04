-- Jobs: saved job postings with a status. Owner only (RLS); the worker does not touch this table.

create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  source_url text,
  canonical_key text not null unique,
  company text,
  role text not null default '',
  location text,
  posted_at date,
  status text not null default 'to-apply' check (status in ('to-apply','applied','interviewing','closed')),
  raw_text text,
  screenshot text, -- object name in the private "media" bucket
  created_at timestamptz not null default now()
);

create index job_postings_status_created_idx on public.job_postings (status, created_at desc);

alter table public.job_postings enable row level security;
create policy owner_all on public.job_postings for all to authenticated using (public.is_owner()) with check (public.is_owner());
