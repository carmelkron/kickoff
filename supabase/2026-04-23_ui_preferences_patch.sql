create table if not exists public.user_preferences (
  profile_id text primary key references public.profiles (id) on delete cascade,
  theme_mode text not null default 'system' check (theme_mode in ('system', 'light', 'dark')),
  language text not null default 'he' check (language in ('he', 'en')),
  notification_preferences jsonb not null default '{"friendRequests": true, "lobbyInvites": true, "joinRequests": true, "waitlist": true, "competitiveResults": true, "organizerReminders": true}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.recent_search_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('query', 'profile', 'lobby')),
  query_text text,
  target_id text,
  label text not null,
  acted_at timestamptz not null default timezone('utc', now())
);

create index if not exists recent_search_entries_profile_id_acted_at_idx
on public.recent_search_entries (profile_id, acted_at desc);

alter table public.user_preferences enable row level security;
alter table public.recent_search_entries enable row level security;

drop policy if exists "users can read their own preferences" on public.user_preferences;
create policy "users can read their own preferences"
on public.user_preferences
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

drop policy if exists "users can upsert their own preferences" on public.user_preferences;
create policy "users can upsert their own preferences"
on public.user_preferences
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

drop policy if exists "users can manage their own recent searches" on public.recent_search_entries;
create policy "users can manage their own recent searches"
on public.recent_search_entries
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
