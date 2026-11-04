-- /cluster-thoughts runs as the limited hub_worker role: it reads notes, creates groups and assigns notes to them.
-- It cannot edit note text, delete notes or delete groups.

grant select on public.notes to hub_worker;
grant update (group_id) on public.notes to hub_worker;
drop policy if exists worker_read on public.notes;
create policy worker_read on public.notes for select to hub_worker using (true);
drop policy if exists worker_update on public.notes;
create policy worker_update on public.notes for update to hub_worker using (true) with check (true);

grant select on public.note_groups to hub_worker;
grant insert (name, x, y, w, h) on public.note_groups to hub_worker;
drop policy if exists worker_read on public.note_groups;
create policy worker_read on public.note_groups for select to hub_worker using (true);
drop policy if exists worker_insert on public.note_groups;
create policy worker_insert on public.note_groups for insert to hub_worker with check (true);
