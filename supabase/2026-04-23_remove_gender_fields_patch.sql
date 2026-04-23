alter table public.profiles
  drop column if exists gender;

alter table public.lobbies
  drop column if exists gender_restriction;
