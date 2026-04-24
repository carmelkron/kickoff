alter table public.profiles drop constraint if exists profiles_birthdate_range_check;
alter table public.lobbies drop constraint if exists lobbies_min_age_range_check;
alter table public.lobbies drop constraint if exists lobbies_max_age_range_check;
alter table public.lobbies drop constraint if exists lobbies_age_range_order_check;

alter table public.profiles drop column if exists birthdate;
alter table public.lobbies drop column if exists min_age;
alter table public.lobbies drop column if exists max_age;
