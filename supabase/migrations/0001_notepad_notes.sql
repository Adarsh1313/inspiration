-- Notepad (single row), its archive, and Thoughts notes.
-- Access: only the allowed email, via RLS on the authenticated role.

create or replace function public.is_owner() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'adarshbharathwaj13@gmail.com'
$$;

create table public.notepad (
  id int primary key default 1 check (id = 1),
  text text not null default '',
  rev int not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.notepad (id) values (1);

create table public.notepad_archive (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  reason text not null check (reason in ('cleared', 'conflict')),
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  text text not null default '',
  colour text not null default 'yellow',
  tag text,
  pinned boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.notepad enable row level security;
alter table public.notepad_archive enable row level security;
alter table public.notes enable row level security;

create policy owner_all on public.notepad for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy owner_all on public.notepad_archive for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy owner_all on public.notes for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- Compare-and-set save: succeeds only if the caller's base rev is still current.
create or replace function public.save_notepad(p_text text, p_base_rev int)
returns table (ok boolean, new_text text, new_rev int)
language plpgsql security invoker as $$
declare r public.notepad;
begin
  update public.notepad n
     set text = p_text, rev = n.rev + 1, updated_at = now()
   where n.id = 1 and n.rev = p_base_rev
   returning * into r;
  if found then
    return query select true, r.text, r.rev;
  else
    select * into r from public.notepad where id = 1;
    return query select false, r.text, r.rev;
  end if;
end $$;

alter publication supabase_realtime add table public.notepad;
