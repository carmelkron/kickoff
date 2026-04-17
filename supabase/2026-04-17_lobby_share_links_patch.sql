create table if not exists public.lobby_share_links (
  lobby_id text primary key references public.lobbies (id) on delete cascade,
  share_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

insert into public.lobby_share_links (lobby_id)
select l.id
from public.lobbies l
left join public.lobby_share_links lsl on lsl.lobby_id = l.id
where lsl.lobby_id is null;

create or replace function public.ensure_lobby_share_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lobby_share_links (lobby_id)
  values (new.id)
  on conflict (lobby_id) do nothing;

  return new;
end;
$$;

drop trigger if exists ensure_lobby_share_link_after_lobby_insert on public.lobbies;
create trigger ensure_lobby_share_link_after_lobby_insert
after insert on public.lobbies
for each row
execute function public.ensure_lobby_share_link();

create or replace function public.get_lobby_share_token(target_lobby_id text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select lsl.share_token
  from public.lobby_share_links lsl
  join public.profiles p on p.auth_user_id = auth.uid()
  where lsl.lobby_id = target_lobby_id
    and public.is_lobby_manager(target_lobby_id, p.id)
  limit 1;
$$;

create or replace function public.has_lobby_share_access(target_lobby_id text, provided_share_token text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.lobby_share_links lsl
    where lsl.lobby_id = target_lobby_id
      and lsl.share_token::text = provided_share_token
  );
$$;

alter table public.lobby_share_links enable row level security;

drop policy if exists "lobby share links direct access denied" on public.lobby_share_links;
create policy "lobby share links direct access denied"
on public.lobby_share_links
for all
using (false)
with check (false);

grant execute on function public.get_lobby_share_token(text) to authenticated;
grant execute on function public.has_lobby_share_access(text, text) to anon, authenticated;
