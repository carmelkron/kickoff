create table if not exists public.lobby_messages (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references public.lobbies (id) on delete cascade,
  profile_id text not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  check (char_length(trim(body)) between 1 and 500)
);

create index if not exists lobby_messages_lobby_id_created_at_idx on public.lobby_messages (lobby_id, created_at desc);

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lobby_messages'
  ) then
    alter publication supabase_realtime add table public.lobby_messages;
  end if;
end $$;

alter table public.lobby_messages enable row level security;

drop policy if exists "lobby messages readable by participants" on public.lobby_messages;
create policy "lobby messages readable by participants"
on public.lobby_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles viewer
    where viewer.auth_user_id = auth.uid()
      and (
        exists (
          select 1
          from public.lobby_memberships lm
          where lm.lobby_id = lobby_id
            and lm.profile_id = viewer.id
            and lm.status in ('joined', 'waitlisted', 'pending_confirm', 'waitlisted_passed')
        )
        or exists (
          select 1
          from public.lobbies l
          where l.id = lobby_id
            and l.created_by = viewer.id
        )
      )
  )
);

drop policy if exists "participants can create lobby messages" on public.lobby_messages;
create policy "participants can create lobby messages"
on public.lobby_messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles sender
    where sender.id = profile_id
      and sender.auth_user_id = auth.uid()
      and (
        exists (
          select 1
          from public.lobby_memberships lm
          where lm.lobby_id = lobby_id
            and lm.profile_id = sender.id
            and lm.status in ('joined', 'waitlisted', 'pending_confirm', 'waitlisted_passed')
        )
        or exists (
          select 1
          from public.lobbies l
          where l.id = lobby_id
            and l.created_by = sender.id
        )
      )
  )
);
