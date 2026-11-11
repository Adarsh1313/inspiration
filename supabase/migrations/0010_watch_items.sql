-- Watch notes: YouTube and X items with the notes Adarsh took while watching. Owner only (RLS); no worker grants.

create table if not exists public.watch_items (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  canonical_key text not null unique,
  source_type text not null check (source_type in ('youtube', 'x-post')),
  title text not null default '',
  author text,
  thumb_url text,   -- remote image (YouTube's own thumbnail)
  thumb_path text,  -- object in the private "media" bucket (X images, whose links expire)
  duration_s int check (duration_s is null or duration_s > 0),
  notes text not null default '',
  rev int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists watch_items_created_idx on public.watch_items (created_at desc);

alter table public.watch_items enable row level security;
drop policy if exists owner_all on public.watch_items;
create policy owner_all on public.watch_items for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- Compare-and-set save for an item's notes: succeeds only if the caller's base rev is still current.
create or replace function public.save_watch_notes(p_id uuid, p_text text, p_base_rev int)
returns table (ok boolean, new_text text, new_rev int)
language plpgsql security invoker as $$
declare r public.watch_items;
begin
  update public.watch_items w
     set notes = p_text, rev = w.rev + 1, updated_at = now()
   where w.id = p_id and w.rev = p_base_rev
   returning * into r;
  if found then
    return query select true, r.notes, r.rev;
  else
    select * into r from public.watch_items w where w.id = p_id;
    if found then
      return query select false, r.notes, r.rev;
    end if;
  end if;
end $$;

alter publication supabase_realtime add table public.watch_items;
