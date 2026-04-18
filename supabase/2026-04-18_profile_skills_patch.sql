create table if not exists public.profile_skills (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.profiles (id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  check (char_length(trim(label)) between 2 and 32)
);

create table if not exists public.profile_skill_endorsements (
  profile_skill_id uuid not null references public.profile_skills (id) on delete cascade,
  endorsed_by_profile_id text not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_skill_id, endorsed_by_profile_id)
);

create index if not exists profile_skills_profile_id_idx on public.profile_skills (profile_id);
create unique index if not exists profile_skills_profile_id_label_lower_idx on public.profile_skills (profile_id, lower(label));
create index if not exists profile_skill_endorsements_endorsed_by_profile_id_idx on public.profile_skill_endorsements (endorsed_by_profile_id);

alter table public.profile_skills enable row level security;
alter table public.profile_skill_endorsements enable row level security;

drop policy if exists "profile skills are readable by everyone" on public.profile_skills;
create policy "profile skills are readable by everyone"
on public.profile_skills
for select
using (true);

drop policy if exists "profile skill endorsements are readable by everyone" on public.profile_skill_endorsements;
create policy "profile skill endorsements are readable by everyone"
on public.profile_skill_endorsements
for select
using (true);

drop policy if exists "users can manage their own profile skills" on public.profile_skills;
create policy "users can manage their own profile skills"
on public.profile_skills
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

drop policy if exists "users can manage their own skill endorsements" on public.profile_skill_endorsements;
create policy "users can manage their own skill endorsements"
on public.profile_skill_endorsements
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = endorsed_by_profile_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = endorsed_by_profile_id
      and p.auth_user_id = auth.uid()
  )
  and exists (
    select 1
    from public.profile_skills s
    where s.id = profile_skill_id
      and s.profile_id <> endorsed_by_profile_id
  )
);
