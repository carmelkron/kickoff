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
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
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
  or exists (
    select 1
    from public.lobbies l
    join public.profiles p on p.id = l.created_by
    where l.id = lobby_id
      and p.auth_user_id = auth.uid()
  )
);
