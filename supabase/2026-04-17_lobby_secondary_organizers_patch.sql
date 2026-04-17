create table if not exists public.lobby_organizers (
  lobby_id text not null references public.lobbies (id) on delete cascade,
  profile_id text not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lobby_id, profile_id)
);

create index if not exists lobby_organizers_lobby_id_idx on public.lobby_organizers (lobby_id);
create index if not exists lobby_organizers_profile_id_idx on public.lobby_organizers (profile_id);

create or replace function public.is_lobby_manager(target_lobby_id text, target_profile_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.lobbies l
    where l.id = target_lobby_id
      and l.created_by = target_profile_id
  ) or exists (
    select 1
    from public.lobby_organizers lo
    join public.lobby_memberships lm
      on lm.lobby_id = lo.lobby_id
     and lm.profile_id = lo.profile_id
     and lm.status = 'joined'
    where lo.lobby_id = target_lobby_id
      and lo.profile_id = target_profile_id
  );
$$;

alter table public.lobby_organizers enable row level security;

drop policy if exists "lobby organizers readable by everyone" on public.lobby_organizers;
create policy "lobby organizers readable by everyone"
on public.lobby_organizers
for select
using (true);

drop policy if exists "lobby creators can assign secondary organizers" on public.lobby_organizers;
create policy "lobby creators can assign secondary organizers"
on public.lobby_organizers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and l.created_by <> profile_id
      and p.auth_user_id = auth.uid()
  )
  and exists (
    select 1
    from public.lobby_memberships lm
    where lm.lobby_id = lobby_id
      and lm.profile_id = profile_id
      and lm.status = 'joined'
  )
);

drop policy if exists "lobby creators can remove secondary organizers" on public.lobby_organizers;
create policy "lobby creators can remove secondary organizers"
on public.lobby_organizers
for delete
to authenticated
using (
  exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and l.created_by <> profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "authenticated users can manage their memberships" on public.lobby_memberships;
create policy "authenticated users can manage their memberships"
on public.lobby_memberships
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and p.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and public.is_lobby_manager(lobby_id, p.id)
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and p.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and public.is_lobby_manager(lobby_id, p.id)
  )
);

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
        or public.is_lobby_manager(lobby_id, p.id)
      )
  )
);

drop policy if exists "lobby creators can manage join requests" on public.lobby_join_requests;
drop policy if exists "lobby organizers can manage join requests" on public.lobby_join_requests;
create policy "lobby organizers can manage join requests"
on public.lobby_join_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.id <> requester_profile_id
      and public.is_lobby_manager(lobby_id, p.id)
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.id <> requester_profile_id
      and public.is_lobby_manager(lobby_id, p.id)
  )
);

drop policy if exists "lobby creators can manage teams" on public.lobby_teams;
drop policy if exists "lobby organizers can manage teams" on public.lobby_teams;
create policy "lobby organizers can manage teams"
on public.lobby_teams
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and public.is_lobby_manager(lobby_id, p.id)
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and public.is_lobby_manager(lobby_id, p.id)
  )
);

drop policy if exists "lobby creators can manage team members" on public.lobby_team_members;
drop policy if exists "lobby organizers can manage team members" on public.lobby_team_members;
create policy "lobby organizers can manage team members"
on public.lobby_team_members
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and public.is_lobby_manager(lobby_id, p.id)
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and public.is_lobby_manager(lobby_id, p.id)
  )
);

drop policy if exists "lobby creators can manage results" on public.lobby_results;
drop policy if exists "lobby organizers can manage results" on public.lobby_results;
create policy "lobby organizers can manage results"
on public.lobby_results
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and public.is_lobby_manager(lobby_id, p.id)
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.id = submitted_by_profile_id
      and public.is_lobby_manager(lobby_id, p.id)
  )
);

drop policy if exists "lobby creators can manage team results" on public.lobby_team_results;
drop policy if exists "lobby organizers can manage team results" on public.lobby_team_results;
create policy "lobby organizers can manage team results"
on public.lobby_team_results
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and public.is_lobby_manager(lobby_id, p.id)
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and public.is_lobby_manager(lobby_id, p.id)
  )
);

drop policy if exists "lobby creators can manage competitive point events" on public.competitive_point_events;
drop policy if exists "lobby organizers can manage competitive point events" on public.competitive_point_events;
create policy "lobby organizers can manage competitive point events"
on public.competitive_point_events
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.id = awarded_by_profile_id
      and public.is_lobby_manager(lobby_id, p.id)
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.id = awarded_by_profile_id
      and public.is_lobby_manager(lobby_id, p.id)
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
      and public.is_lobby_manager(lobby_id, actor_profile_id)
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
      and public.is_lobby_manager(lobby_id, actor_profile_id)
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
