-- Active projects: one sticky card per project, with a day-by-day brain dump per card.
-- Owner: full access via RLS. hub_worker (the CLI role) can read, register projects, set a repo and mark entries
-- ticketed. It has no grant on entry text and no delete, so a bad agent run cannot destroy notes.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  repo text check (repo is null or repo ~ '^[^/\s]+/[^/\s]+$'), -- owner/name
  colour text not null default 'yellow',
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.project_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  day date not null,               -- IST date the text was written
  seq int not null default 1 check (seq >= 1),
  text text not null default '',
  rev int not null default 0,
  ticketed_at timestamptz,
  issues jsonb not null default '[]'::jsonb, -- [{ number, title, url }]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, day, seq)
);

alter table public.projects enable row level security;
alter table public.project_entries enable row level security;
drop policy if exists owner_all on public.projects;
create policy owner_all on public.projects for all to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists owner_all on public.project_entries;
create policy owner_all on public.project_entries for all to authenticated using (public.is_owner()) with check (public.is_owner());

insert into public.projects (slug, name, repo, colour, position) values
  ('portfolio',     'Portfolio',     null,                          'yellow',  0),
  ('agentkanban',   'AgentKanban',   'Adarsh1313/agent-kanban',     'pink',    1),
  ('resurface',     'Resurface',     'Adarsh1313/resurface',        'green',   2),
  ('tabdesk',       'TabDesk',       null,                          'blue',    3),
  ('localflow',     'LocalFlow',     'Adarsh1313/local-flow',       'apricot', 4),
  ('familyatlas',   'FamilyAtlas',   null,                          'yellow',  5),
  ('email-tracker', 'Email Tracker', 'Adarsh1313/email-tracker',    'pink',    6),
  ('inspiration',   'Inspiration',   'Adarsh1313/inspiration',      'green',   7)
on conflict (slug) do nothing;

-- Compare-and-set save for a project's open entry.
--   p_id null  -> create today's next entry (does nothing for blank text)
--   p_id given -> update it if p_base_rev is current and it is not ticketed; blank text deletes it
-- ok = false means nothing was written: `ticketed`/`gone` say why, otherwise the rev moved (new_text/new_rev are the server's).
create or replace function public.save_project_entry(p_id uuid, p_project uuid, p_day date, p_text text, p_base_rev int)
returns table (ok boolean, entry_id uuid, new_seq int, new_text text, new_rev int, ticketed boolean, gone boolean)
language plpgsql security invoker as $$
declare r public.project_entries;
begin
  if p_id is null then
    if btrim(p_text) = '' then
      return query select true, null::uuid, 0, ''::text, 0, false, true;
      return;
    end if;
    insert into public.project_entries (project_id, day, seq, text, rev)
    values (p_project, p_day, coalesce((select max(e.seq) from public.project_entries e where e.project_id = p_project and e.day = p_day), 0) + 1, p_text, 1)
    returning * into r;
    return query select true, r.id, r.seq, r.text, r.rev, false, false;
    return;
  end if;

  if btrim(p_text) = '' then
    delete from public.project_entries e where e.id = p_id and e.rev = p_base_rev and e.ticketed_at is null returning * into r;
    if found then
      return query select true, null::uuid, 0, ''::text, 0, false, true;
      return;
    end if;
  else
    update public.project_entries e
       set text = p_text, rev = e.rev + 1, updated_at = now()
     where e.id = p_id and e.rev = p_base_rev and e.ticketed_at is null
     returning * into r;
    if found then
      return query select true, r.id, r.seq, r.text, r.rev, false, false;
      return;
    end if;
  end if;

  select * into r from public.project_entries e where e.id = p_id;
  if not found then
    return query select false, p_id, 0, ''::text, 0, false, true;
  else
    return query select false, r.id, r.seq, r.text, r.rev, r.ticketed_at is not null, false;
  end if;
end $$;

alter table public.project_entries replica identity full;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.project_entries;

-- hub_worker (hub CLI): read both tables, register projects, set a repo, mark entries ticketed. Nothing else.
grant select on public.projects, public.project_entries to hub_worker;
grant insert (slug, name, repo, colour, position) on public.projects to hub_worker;
grant update (repo) on public.projects to hub_worker;
grant update (ticketed_at, issues) on public.project_entries to hub_worker;

drop policy if exists worker_read on public.projects;
create policy worker_read on public.projects for select to hub_worker using (true);
drop policy if exists worker_insert on public.projects;
create policy worker_insert on public.projects for insert to hub_worker with check (true);
drop policy if exists worker_update on public.projects;
create policy worker_update on public.projects for update to hub_worker using (true) with check (true);
drop policy if exists worker_read on public.project_entries;
create policy worker_read on public.project_entries for select to hub_worker using (true);
drop policy if exists worker_update on public.project_entries;
create policy worker_update on public.project_entries for update to hub_worker using (true) with check (true);
