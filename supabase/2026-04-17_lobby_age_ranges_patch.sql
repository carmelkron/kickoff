alter table public.profiles add column if not exists birthdate date;

alter table public.profiles drop constraint if exists profiles_birthdate_range_check;
alter table public.profiles add constraint profiles_birthdate_range_check
check (birthdate is null or birthdate >= date '1900-01-01');

alter table public.lobbies add column if not exists min_age integer;
alter table public.lobbies add column if not exists max_age integer;

alter table public.lobbies drop constraint if exists lobbies_min_age_range_check;
alter table public.lobbies add constraint lobbies_min_age_range_check
check (min_age is null or min_age between 6 and 99);

alter table public.lobbies drop constraint if exists lobbies_max_age_range_check;
alter table public.lobbies add constraint lobbies_max_age_range_check
check (max_age is null or max_age between 6 and 99);

alter table public.lobbies drop constraint if exists lobbies_age_range_order_check;
alter table public.lobbies add constraint lobbies_age_range_order_check
check (min_age is null or max_age is null or min_age <= max_age);
