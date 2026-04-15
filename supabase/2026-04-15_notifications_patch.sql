create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.profiles (id) on delete cascade,
  actor_profile_id text references public.profiles (id) on delete cascade,
  lobby_id text references public.lobbies (id) on delete cascade,
  kind text not null check (kind in ('friend_request', 'friend_request_accepted', 'friend_request_declined', 'friend_joined_lobby', 'organizer_summary')),
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('friend_request', 'friend_request_accepted', 'friend_request_declined', 'friend_joined_lobby', 'organizer_summary')
);

create index if not exists notifications_profile_id_created_at_idx on public.notifications (profile_id, created_at desc);
create index if not exists notifications_profile_id_is_read_idx on public.notifications (profile_id, is_read);

alter table public.notifications enable row level security;

drop policy if exists "users can read their own notifications" on public.notifications;
create policy "users can read their own notifications"
on public.notifications
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "users can update their own notifications" on public.notifications;
create policy "users can update their own notifications"
on public.notifications
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "users can delete their own notifications" on public.notifications;
create policy "users can delete their own notifications"
on public.notifications
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "authenticated users can create notifications" on public.notifications;
create policy "authenticated users can create notifications"
on public.notifications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles actor
    where actor.id = actor_profile_id
      and actor.auth_user_id = auth.uid()
  )
  and (
    (
      kind = 'friend_request'
      and exists (
        select 1
        from public.friend_requests fr
        where fr.from_profile_id = actor_profile_id
          and fr.to_profile_id = profile_id
          and fr.status = 'pending'
      )
    )
    or (
      kind = 'friend_request_accepted'
      and exists (
        select 1
        from public.friend_requests fr
        where fr.from_profile_id = profile_id
          and fr.to_profile_id = actor_profile_id
          and fr.status = 'accepted'
      )
    )
    or (
      kind = 'friend_request_declined'
      and exists (
        select 1
        from public.friend_requests fr
        where fr.from_profile_id = profile_id
          and fr.to_profile_id = actor_profile_id
          and fr.status = 'declined'
      )
    )
    or (
      kind = 'friend_joined_lobby'
      and lobby_id is not null
      and profile_id <> actor_profile_id
      and exists (
        select 1
        from public.lobby_memberships lm
        where lm.lobby_id = lobby_id
          and lm.profile_id = actor_profile_id
          and lm.status = 'joined'
      )
      and exists (
        select 1
        from public.friend_requests fr
        where fr.status = 'accepted'
          and (
            (fr.from_profile_id = actor_profile_id and fr.to_profile_id = profile_id)
            or (fr.from_profile_id = profile_id and fr.to_profile_id = actor_profile_id)
          )
      )
    )
    or (
      kind = 'organizer_summary'
      and lobby_id is not null
      and exists (
        select 1
        from public.lobbies l
        where l.id = lobby_id
          and l.created_by = profile_id
      )
      and exists (
        select 1
        from public.lobby_memberships lm
        where lm.lobby_id = lobby_id
          and lm.profile_id = actor_profile_id
      )
    )
  )
);
