alter table public.lobbies
  add column if not exists status text not null default 'active';

alter table public.lobbies
  drop constraint if exists lobbies_status_check;

alter table public.lobbies
  add constraint lobbies_status_check check (status in ('active', 'deleted'));
