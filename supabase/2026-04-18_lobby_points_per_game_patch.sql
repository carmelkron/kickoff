alter table public.lobbies add column if not exists min_points_per_game numeric(5, 2);
alter table public.lobbies drop constraint if exists lobbies_min_points_per_game_range_check;
alter table public.lobbies add constraint lobbies_min_points_per_game_range_check check (min_points_per_game is null or min_points_per_game between 0 and 99.99);
