-- The hub_worker role also drives `/add-ref`, the seed script and `/enrich-cards`.
-- It can add draft cards and queue tasks, and fill enrichment fields, but still cannot delete anything.

grant insert (slug, canonical_key, source_url, source_type, title, author, description, kind, shelf, status, media_status, media_error, needs_review, notes, poster_sm, poster_lg)
  on public.cards to hub_worker;
drop policy if exists worker_insert on public.cards;
create policy worker_insert on public.cards for insert to hub_worker with check (status = 'draft');

grant insert (card_id, step) on public.capture_tasks to hub_worker;
drop policy if exists worker_insert on public.capture_tasks;
create policy worker_insert on public.capture_tasks for insert to hub_worker with check (true);

-- Enrichment written from a Claude Code session: summary, tags, mood, reuse notes and the review flag.
grant update (title, description, summary, tags, mood, fits, stack, reuse, notes, video_description, kind, shelf, related, item_count, browse_notes, needs_review, status, enriched_at)
  on public.cards to hub_worker;
