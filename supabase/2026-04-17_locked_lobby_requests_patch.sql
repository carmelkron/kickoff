create table if not exists public.lobby_join_requests (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references public.lobbies (id) on delete cascade,
  requester_profile_id text not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  responded_by_profile_id text references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (lobby_id, requester_profile_id)
);

create index if not exists lobby_join_requests_lobby_id_idx on public.lobby_join_requests (lobby_id);
create index if not exists lobby_join_requests_requester_profile_id_idx on public.lobby_join_requests (requester_profile_id);

alter table public.lobby_join_requests enable row level security;

drop policy if exists "lobby join requests readable by involved users" on public.lobby_join_requests;
create policy "lobby join requests readable by involved users"
on public.lobby_join_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and (
        p.id = requester_profile_id
        or exists (
          select 1
          from public.lobbies l
          where l.id = lobby_id
            and l.created_by = p.id
        )
      )
  )
);

drop policy if exists "users can create their own lobby join requests" on public.lobby_join_requests;
create policy "users can create their own lobby join requests"
on public.lobby_join_requests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    join public.lobbies l on l.id = lobby_id
    where p.id = requester_profile_id
      and p.auth_user_id = auth.uid()
      and l.access_type = 'locked'
      and l.created_by <> requester_profile_id
  )
);

drop policy if exists "lobby creators can manage join requests" on public.lobby_join_requests;
create policy "lobby creators can manage join requests"
on public.lobby_join_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and l.created_by <> requester_profile_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and l.created_by <> requester_profile_id
      and p.auth_user_id = auth.uid()
  )
);

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in (
    'friend_request',
    'friend_request_accepted',
    'friend_request_declined',
    'friend_joined_lobby',
    'lobby_join_request',
    'lobby_join_request_approved',
    'lobby_join_request_declined',
    'waitlist_spot_opened',
    'lobby_invite',
    'competitive_result',
    'team_assigned',
    'organizer_summary'
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
      kind = 'lobby_join_request'
      and lobby_id is not null
      and profile_id <> actor_profile_id
      and exists (
        select 1
        from public.lobbies l
        where l.id = lobby_id
          and l.created_by = profile_id
          and l.access_type = 'locked'
      )
      and exists (
        select 1
        from public.lobby_join_requests ljr
        where ljr.lobby_id = lobby_id
          and ljr.requester_profile_id = actor_profile_id
          and ljr.status = 'pending'
      )
    )
    or (
      kind = 'lobby_join_request_approved'
      and lobby_id is not null
      and profile_id <> actor_profile_id
      and exists (
        select 1
        from public.lobby_join_requests ljr
        where ljr.lobby_id = lobby_id
          and ljr.requester_profile_id = profile_id
          and ljr.responded_by_profile_id = actor_profile_id
          and ljr.status = 'approved'
      )
    )
    or (
      kind = 'lobby_join_request_declined'
      and lobby_id is not null
      and profile_id <> actor_profile_id
      and exists (
        select 1
        from public.lobby_join_requests ljr
        where ljr.lobby_id = lobby_id
          and ljr.requester_profile_id = profile_id
          and ljr.responded_by_profile_id = actor_profile_id
          and ljr.status = 'declined'
      )
    )
    or (
      kind = 'lobby_invite'
      and lobby_id is not null
      and profile_id <> actor_profile_id
      and exists (
        select 1
        from public.lobbies l
        where l.id = lobby_id
          and l.created_by = actor_profile_id
          and l.access_type = 'locked'
      )
      and exists (
        select 1
        from public.lobby_invites li
        where li.lobby_id = lobby_id
          and li.invited_profile_id = profile_id
          and li.invited_by_profile_id = actor_profile_id
          and li.status in ('pending', 'accepted')
      )
    )
    or (
      kind = 'competitive_result'
      and lobby_id is not null
      and exists (
        select 1
        from public.lobbies l
        where l.id = lobby_id
          and l.created_by = actor_profile_id
      )
      and exists (
        select 1
        from public.lobby_memberships lm
        where lm.lobby_id = lobby_id
          and lm.profile_id = profile_id
          and lm.status = 'joined'
      )
    )
    or (
      kind = 'team_assigned'
      and lobby_id is not null
      and exists (
        select 1
        from public.lobbies l
        where l.id = lobby_id
          and l.created_by = actor_profile_id
      )
      and exists (
        select 1
        from public.lobby_memberships lm
        where lm.lobby_id = lobby_id
          and lm.profile_id = profile_id
          and lm.status = 'joined'
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
