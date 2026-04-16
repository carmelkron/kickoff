alter table public.lobbies add column if not exists access_type text not null default 'open';
alter table public.lobbies drop constraint if exists lobbies_access_type_check;
alter table public.lobbies add constraint lobbies_access_type_check check (access_type in ('open', 'locked'));

create table if not exists public.lobby_invites (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references public.lobbies (id) on delete cascade,
  invited_profile_id text not null references public.profiles (id) on delete cascade,
  invited_by_profile_id text not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  unique (lobby_id, invited_profile_id),
  check (invited_profile_id <> invited_by_profile_id)
);

create index if not exists lobby_invites_lobby_id_idx on public.lobby_invites (lobby_id);
create index if not exists lobby_invites_invited_profile_id_idx on public.lobby_invites (invited_profile_id);

alter table public.lobby_invites enable row level security;

drop policy if exists "lobby invites readable by involved users" on public.lobby_invites;
create policy "lobby invites readable by involved users"
on public.lobby_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and (
        p.id = invited_profile_id
        or p.id = invited_by_profile_id
        or exists (
          select 1
          from public.lobbies l
          where l.id = lobby_id
            and l.created_by = p.id
        )
      )
  )
);

drop policy if exists "lobby creators can create invites" on public.lobby_invites;
create policy "lobby creators can create invites"
on public.lobby_invites
for insert
to authenticated
with check (
  exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and l.created_by = invited_by_profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "lobby invite participants can update invites" on public.lobby_invites;
create policy "lobby invite participants can update invites"
on public.lobby_invites
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and (
        p.id = invited_profile_id
        or exists (
          select 1
          from public.lobbies l
          where l.id = lobby_id
            and l.created_by = p.id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and (
        p.id = invited_profile_id
        or exists (
          select 1
          from public.lobbies l
          where l.id = lobby_id
            and l.created_by = p.id
        )
      )
  )
);

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('friend_request', 'friend_request_accepted', 'friend_request_declined', 'friend_joined_lobby', 'lobby_invite', 'competitive_result', 'team_assigned', 'organizer_summary')
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
