drop policy if exists "authenticated users can delete their own lobbies" on public.lobbies;

create policy "authenticated users can delete their own lobbies"
on public.lobbies
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = created_by
      and p.auth_user_id = auth.uid()
  )
);
