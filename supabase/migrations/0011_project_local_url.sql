-- Each project card can link to its local dev server, so it can be opened for review in one click.
alter table public.projects add column if not exists local_url text
  check (local_url is null or local_url ~* '^https?://(localhost|127\.0\.0\.1)(:\d{2,5})?(/\S*)?$');

-- Best guesses from each project's dev scripts; change any of them from the card menu (Edit links).
update public.projects set local_url = v.url
from (values
  ('portfolio', 'http://localhost:3000'),
  ('agentkanban', 'http://localhost:3007'),
  ('resurface', 'http://localhost:3000'),
  ('localflow', 'http://localhost:8765'),
  ('familyatlas', 'http://localhost:3000'),
  ('email-tracker', 'http://localhost:4173'),
  ('inspiration', 'http://localhost:3000')
) as v(slug, url)
where projects.slug = v.slug and projects.local_url is null;

grant update (local_url) on public.projects to hub_worker;
