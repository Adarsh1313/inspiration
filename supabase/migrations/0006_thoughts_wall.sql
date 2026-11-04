-- Thoughts wall: notes get a position, tilt and stacking order; groups become labelled frames.

create table public.note_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  x real not null default 0,
  y real not null default 0,
  w real not null default 596,
  h real not null default 368,
  created_at timestamptz not null default now()
);
alter table public.note_groups enable row level security;
create policy owner_all on public.note_groups for all to authenticated using (public.is_owner()) with check (public.is_owner());

alter table public.notes
  add column x real not null default 0,
  add column y real not null default 0,
  add column rotation real not null default 0,
  add column z int not null default 0,
  add column group_id uuid references public.note_groups (id) on delete set null;

-- Existing notes: lay them out on a loose grid with a small seeded tilt.
with ordered as (
  select id, row_number() over (order by created_at) - 1 as n from public.notes
)
update public.notes t
   set x = 40 + (o.n % 5) * 160,
       y = 40 + (o.n / 5) * 160,
       rotation = ((o.n * 37) % 9) - 4
  from ordered o
 where t.id = o.id;
