-- The agent records which project used a card, and saves directory picks, through the worker role.
grant update (used_in, picks, last_checked) on public.cards to hub_worker;
