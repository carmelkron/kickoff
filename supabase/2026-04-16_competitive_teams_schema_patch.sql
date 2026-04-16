alter table public.profiles
  add column if not exists competitive_points integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_competitive_points_non_negative_check;

alter table public.profiles
  add constraint profiles_competitive_points_non_negative_check check (competitive_points >= 0);

create table if not exists public.lobby_teams (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references public.lobbies (id) on delete cascade,
  color text not null check (color in ('blue', 'yellow', 'red', 'green')),
  team_number integer not null check (team_number between 1 and 4),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (lobby_id, color),
  unique (lobby_id, team_number),
  unique (id, lobby_id)
);

create table if not exists public.lobby_team_members (
  lobby_id text not null references public.lobbies (id) on delete cascade,
  lobby_team_id uuid not null,
  profile_id text not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lobby_team_id, profile_id),
  unique (lobby_id, profile_id),
  foreign key (lobby_team_id, lobby_id) references public.lobby_teams (id, lobby_id) on delete cascade
);

create table if not exists public.lobby_results (
  lobby_id text primary key references public.lobbies (id) on delete cascade,
  submitted_by_profile_id text not null references public.profiles (id) on delete restrict,
  submitted_at timestamptz not null default now(),
  notes text,
  check (char_length(coalesce(notes, '')) <= 500)
);

create table if not exists public.lobby_team_results (
  lobby_id text not null,
  lobby_team_id uuid not null,
  wins integer not null default 0 check (wins >= 0),
  rank numeric(4, 2) not null check (rank between 1 and 4),
  awarded_points integer not null check (awarded_points >= 0 and awarded_points % 5 = 0),
  created_at timestamptz not null default now(),
  primary key (lobby_id, lobby_team_id),
  foreign key (lobby_id) references public.lobby_results (lobby_id) on delete cascade,
  foreign key (lobby_team_id, lobby_id) references public.lobby_teams (id, lobby_id) on delete cascade
);

create table if not exists public.competitive_point_events (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references public.lobbies (id) on delete cascade,
  profile_id text not null references public.profiles (id) on delete cascade,
  awarded_by_profile_id text not null references public.profiles (id) on delete restrict,
  team_color text not null check (team_color in ('blue', 'yellow', 'red', 'green')),
  team_number integer not null check (team_number between 1 and 4),
  wins integer not null default 0 check (wins >= 0),
  rank numeric(4, 2) not null check (rank between 1 and 4),
  points integer not null check (points >= 0 and points % 5 = 0),
  reason text not null default 'competitive_lobby_result' check (reason in ('competitive_lobby_result')),
  created_at timestamptz not null default now(),
  unique (lobby_id, profile_id)
);

create index if not exists lobby_teams_lobby_id_idx on public.lobby_teams (lobby_id);
create index if not exists lobby_team_members_lobby_id_idx on public.lobby_team_members (lobby_id);
create index if not exists lobby_team_members_profile_id_idx on public.lobby_team_members (profile_id);
create index if not exists lobby_team_results_lobby_id_idx on public.lobby_team_results (lobby_id);
create index if not exists competitive_point_events_profile_id_created_at_idx on public.competitive_point_events (profile_id, created_at desc);
create index if not exists competitive_point_events_lobby_id_idx on public.competitive_point_events (lobby_id);

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('friend_request', 'friend_request_accepted', 'friend_request_declined', 'friend_joined_lobby', 'team_assigned', 'organizer_summary')
);

alter table public.lobby_teams enable row level security;
alter table public.lobby_team_members enable row level security;
alter table public.lobby_results enable row level security;
alter table public.lobby_team_results enable row level security;
alter table public.competitive_point_events enable row level security;

drop policy if exists "lobby teams readable by everyone" on public.lobby_teams;
create policy "lobby teams readable by everyone"
on public.lobby_teams
for select
using (true);

drop policy if exists "lobby team members readable by everyone" on public.lobby_team_members;
create policy "lobby team members readable by everyone"
on public.lobby_team_members
for select
using (true);

drop policy if exists "lobby results readable by everyone" on public.lobby_results;
create policy "lobby results readable by everyone"
on public.lobby_results
for select
using (true);

drop policy if exists "lobby team results readable by everyone" on public.lobby_team_results;
create policy "lobby team results readable by everyone"
on public.lobby_team_results
for select
using (true);

drop policy if exists "competitive point events readable by everyone" on public.competitive_point_events;
create policy "competitive point events readable by everyone"
on public.competitive_point_events
for select
using (true);

drop policy if exists "lobby creators can manage teams" on public.lobby_teams;
create policy "lobby creators can manage teams"
on public.lobby_teams
for all
to authenticated
using (
  exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "lobby creators can manage team members" on public.lobby_team_members;
create policy "lobby creators can manage team members"
on public.lobby_team_members
for all
to authenticated
using (
  exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "lobby creators can manage results" on public.lobby_results;
create policy "lobby creators can manage results"
on public.lobby_results
for all
to authenticated
using (
  exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and l.created_by = submitted_by_profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "lobby creators can manage team results" on public.lobby_team_results;
create policy "lobby creators can manage team results"
on public.lobby_team_results
for all
to authenticated
using (
  exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "lobby creators can manage competitive point events" on public.competitive_point_events;
create policy "lobby creators can manage competitive point events"
on public.competitive_point_events
for all
to authenticated
using (
  exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and l.created_by = awarded_by_profile_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and l.created_by = awarded_by_profile_id
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
