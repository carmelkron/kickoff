create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create table if not exists public.profiles (
  id text primary key,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  email text unique,
  name text not null,
  initials text not null,
  avatar_color text not null,
  rating numeric(3, 1) not null default 5.0,
  games_played integer not null default 0,
  competitive_points integer not null default 0,
  position text,
  bio text,
  photo_url text,
  rating_history jsonb not null default '[]'::jsonb,
  lobby_history jsonb not null default '[]'::jsonb,
  is_mock boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists gender text check (gender in ('male', 'female', 'other'));
alter table public.profiles add column if not exists home_latitude double precision;
alter table public.profiles add column if not exists home_longitude double precision;
alter table public.profiles add column if not exists home_address text;
alter table public.profiles add column if not exists competitive_points integer not null default 0;

create table if not exists public.lobbies (
  id text primary key,
  title text not null,
  address text not null,
  city text not null,
  datetime timestamptz not null,
  max_players integer not null,
  num_teams integer,
  players_per_team integer,
  min_rating numeric(3, 1),
  is_private boolean not null default false,
  price integer,
  description text,
  created_by text not null references public.profiles (id) on delete restrict,
  distance_km numeric(5, 1) not null default 0,
  game_type text not null default 'friendly' check (game_type in ('friendly', 'competitive')),
  access_type text not null default 'open' check (access_type in ('open', 'locked')),
  field_type text check (field_type in ('grass', 'asphalt', 'indoor')),
  gender_restriction text not null default 'none' check (gender_restriction in ('none', 'male', 'female')),
  latitude double precision,
  longitude double precision,
  status text not null default 'active' check (status in ('active', 'deleted')),
  created_at timestamptz not null default now()
);

create table if not exists public.lobby_memberships (
  lobby_id text not null references public.lobbies (id) on delete cascade,
  profile_id text not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('joined', 'waitlisted', 'pending_confirm', 'left')),
  created_at timestamptz not null default now(),
  primary key (lobby_id, profile_id)
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_profile_id text not null references public.profiles (id) on delete cascade,
  to_profile_id text not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (from_profile_id, to_profile_id),
  check (from_profile_id <> to_profile_id)
);

alter table public.profiles drop constraint if exists profiles_email_lowercase_check;
alter table public.profiles add constraint profiles_email_lowercase_check check (email is null or email = lower(email));
alter table public.profiles drop constraint if exists profiles_name_length_check;
alter table public.profiles add constraint profiles_name_length_check check (char_length(trim(name)) between 2 and 80);
alter table public.profiles drop constraint if exists profiles_initials_length_check;
alter table public.profiles add constraint profiles_initials_length_check check (char_length(trim(initials)) between 1 and 4);
alter table public.profiles drop constraint if exists profiles_rating_range_check;
alter table public.profiles add constraint profiles_rating_range_check check (rating between 1.0 and 10.0);
alter table public.profiles drop constraint if exists profiles_games_played_non_negative_check;
alter table public.profiles add constraint profiles_games_played_non_negative_check check (games_played >= 0);
alter table public.profiles drop constraint if exists profiles_competitive_points_non_negative_check;
alter table public.profiles add constraint profiles_competitive_points_non_negative_check check (competitive_points >= 0);
alter table public.profiles drop constraint if exists profiles_bio_length_check;
alter table public.profiles add constraint profiles_bio_length_check check (bio is null or char_length(bio) <= 280);

alter table public.lobbies drop constraint if exists lobbies_title_length_check;
alter table public.lobbies add constraint lobbies_title_length_check check (char_length(trim(title)) between 3 and 80);
alter table public.lobbies drop constraint if exists lobbies_address_length_check;
alter table public.lobbies add constraint lobbies_address_length_check check (char_length(trim(address)) between 2 and 160);
alter table public.lobbies drop constraint if exists lobbies_city_length_check;
alter table public.lobbies add constraint lobbies_city_length_check check (char_length(trim(city)) between 2 and 60);
alter table public.lobbies drop constraint if exists lobbies_max_players_range_check;
alter table public.lobbies add constraint lobbies_max_players_range_check check (max_players between 6 and 44);
alter table public.lobbies drop constraint if exists lobbies_num_teams_range_check;
alter table public.lobbies add constraint lobbies_num_teams_range_check check (num_teams is null or num_teams between 2 and 4);
alter table public.lobbies drop constraint if exists lobbies_players_per_team_range_check;
alter table public.lobbies add constraint lobbies_players_per_team_range_check check (players_per_team is null or players_per_team between 3 and 11);
alter table public.lobbies drop constraint if exists lobbies_min_rating_range_check;
alter table public.lobbies add constraint lobbies_min_rating_range_check check (min_rating is null or min_rating between 1.0 and 10.0);
alter table public.lobbies drop constraint if exists lobbies_price_range_check;
alter table public.lobbies add constraint lobbies_price_range_check check (price is null or price between 0 and 999);
alter table public.lobbies drop constraint if exists lobbies_description_length_check;
alter table public.lobbies add constraint lobbies_description_length_check check (description is null or char_length(description) <= 500);
alter table public.lobbies drop constraint if exists lobbies_team_math_check;
alter table public.lobbies add constraint lobbies_team_math_check check (
  (num_teams is null and players_per_team is null)
  or (num_teams is not null and players_per_team is not null and max_players = num_teams * players_per_team)
);

create table if not exists public.lobby_ratings (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references public.lobbies (id) on delete cascade,
  rater_profile_id text not null references public.profiles (id) on delete cascade,
  rated_profile_id text not null references public.profiles (id) on delete cascade,
  rating numeric(3, 1) not null check (rating between 1.0 and 10.0),
  field_rating integer check (field_rating between 1 and 5),
  game_level text check (game_level in ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz not null default now(),
  unique (lobby_id, rater_profile_id, rated_profile_id),
  check (rater_profile_id <> rated_profile_id)
);

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

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.profiles (id) on delete cascade,
  actor_profile_id text references public.profiles (id) on delete cascade,
  lobby_id text references public.lobbies (id) on delete cascade,
  kind text not null check (kind in ('friend_request', 'friend_request_accepted', 'friend_request_declined', 'friend_joined_lobby', 'lobby_invite', 'competitive_result', 'team_assigned', 'organizer_summary')),
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

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

create index if not exists profiles_auth_user_id_idx on public.profiles (auth_user_id);
create index if not exists lobbies_datetime_idx on public.lobbies (datetime);
create index if not exists lobby_memberships_profile_id_idx on public.lobby_memberships (profile_id);
create index if not exists lobby_invites_lobby_id_idx on public.lobby_invites (lobby_id);
create index if not exists lobby_invites_invited_profile_id_idx on public.lobby_invites (invited_profile_id);
create index if not exists friend_requests_to_profile_status_idx on public.friend_requests (to_profile_id, status);
create index if not exists lobby_ratings_lobby_id_idx on public.lobby_ratings (lobby_id);
create index if not exists lobby_ratings_rated_profile_id_idx on public.lobby_ratings (rated_profile_id);
create index if not exists notifications_profile_id_created_at_idx on public.notifications (profile_id, created_at desc);
create index if not exists notifications_profile_id_is_read_idx on public.notifications (profile_id, is_read);
create index if not exists lobby_teams_lobby_id_idx on public.lobby_teams (lobby_id);
create index if not exists lobby_team_members_lobby_id_idx on public.lobby_team_members (lobby_id);
create index if not exists lobby_team_members_profile_id_idx on public.lobby_team_members (profile_id);
create index if not exists lobby_team_results_lobby_id_idx on public.lobby_team_results (lobby_id);
create index if not exists competitive_point_events_profile_id_created_at_idx on public.competitive_point_events (profile_id, created_at desc);
create index if not exists competitive_point_events_lobby_id_idx on public.competitive_point_events (lobby_id);

alter table public.profiles enable row level security;
alter table public.lobbies enable row level security;
alter table public.lobby_memberships enable row level security;
alter table public.lobby_invites enable row level security;
alter table public.friend_requests enable row level security;
alter table public.lobby_ratings enable row level security;
alter table public.notifications enable row level security;
alter table public.lobby_teams enable row level security;
alter table public.lobby_team_members enable row level security;
alter table public.lobby_results enable row level security;
alter table public.lobby_team_results enable row level security;
alter table public.competitive_point_events enable row level security;

drop policy if exists "profiles are readable by everyone" on public.profiles;
create policy "profiles are readable by everyone"
on public.profiles
for select
using (true);

drop policy if exists "lobbies are readable by everyone" on public.lobbies;
create policy "lobbies are readable by everyone"
on public.lobbies
for select
using (true);

drop policy if exists "memberships are readable by everyone" on public.lobby_memberships;
create policy "memberships are readable by everyone"
on public.lobby_memberships
for select
using (true);

drop policy if exists "friend requests readable by involved users" on public.friend_requests;
create policy "friend requests readable by involved users"
on public.friend_requests
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.id in (from_profile_id, to_profile_id)
  )
);

drop policy if exists "authenticated users can insert their own profile" on public.profiles;
create policy "authenticated users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth_user_id = auth.uid());

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
on public.profiles
for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists "authenticated users can create lobbies they own" on public.lobbies;
create policy "authenticated users can create lobbies they own"
on public.lobbies
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = created_by
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "authenticated users can update their own lobbies" on public.lobbies;
create policy "authenticated users can update their own lobbies"
on public.lobbies
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = created_by
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = created_by
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
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "authenticated users can send friend requests" on public.friend_requests;
create policy "authenticated users can send friend requests"
on public.friend_requests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = from_profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "involved users can update friend requests" on public.friend_requests;
create policy "involved users can update friend requests"
on public.friend_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.id in (from_profile_id, to_profile_id)
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.id in (from_profile_id, to_profile_id)
  )
);

drop policy if exists "avatar images are publicly readable" on storage.objects;
create policy "avatar images are publicly readable"
on storage.objects
for select
using (bucket_id = 'avatars');

drop policy if exists "authenticated users can upload their own avatar" on storage.objects;
create policy "authenticated users can upload their own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can update their own avatar" on storage.objects;
create policy "authenticated users can update their own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can delete their own avatar" on storage.objects;
create policy "authenticated users can delete their own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Ensure newer location/profile columns exist on older databases too
alter table public.profiles add column if not exists home_latitude double precision;
alter table public.profiles add column if not exists home_longitude double precision;
alter table public.profiles add column if not exists home_address text;
alter table public.lobbies add column if not exists field_type text check (field_type in ('grass', 'asphalt', 'indoor'));
alter table public.lobbies add column if not exists access_type text not null default 'open';
alter table public.lobbies drop constraint if exists lobbies_access_type_check;
alter table public.lobbies add constraint lobbies_access_type_check check (access_type in ('open', 'locked'));
alter table public.lobbies add column if not exists gender_restriction text not null default 'none' check (gender_restriction in ('none', 'male', 'female'));
alter table public.lobbies add column if not exists latitude double precision;
alter table public.lobbies add column if not exists longitude double precision;
alter table public.lobbies add column if not exists status text not null default 'active';
alter table public.lobbies drop constraint if exists lobbies_status_check;
alter table public.lobbies add constraint lobbies_status_check check (status in ('active', 'deleted'));
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('friend_request', 'friend_request_accepted', 'friend_request_declined', 'friend_joined_lobby', 'lobby_invite', 'competitive_result', 'team_assigned', 'organizer_summary')
);

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

-- Contribution icons (ball/speaker) per lobby
create table if not exists public.lobby_contributions (
  lobby_id text not null references public.lobbies (id) on delete cascade,
  profile_id text not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('ball', 'speaker')),
  created_at timestamptz not null default now(),
  primary key (lobby_id, profile_id, type)
);

alter table public.lobby_contributions enable row level security;

create index if not exists lobby_contributions_lobby_id_idx on public.lobby_contributions (lobby_id);

drop policy if exists "contributions readable by everyone" on public.lobby_contributions;
create policy "contributions readable by everyone"
on public.lobby_contributions
for select
using (true);

drop policy if exists "authenticated users can manage their own contributions" on public.lobby_contributions;
create policy "authenticated users can manage their own contributions"
on public.lobby_contributions
for all
to authenticated
using (
  exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid())
)
with check (
  exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid())
);

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

drop policy if exists "authenticated users can submit lobby ratings" on public.lobby_ratings;
create policy "authenticated users can submit lobby ratings"
on public.lobby_ratings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = rater_profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "lobby ratings readable by participants" on public.lobby_ratings;
create policy "lobby ratings readable by participants"
on public.lobby_ratings
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.id in (rater_profile_id, rated_profile_id)
  )
);

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
