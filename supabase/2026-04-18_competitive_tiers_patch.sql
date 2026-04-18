alter table public.lobby_team_results drop constraint if exists lobby_team_results_awarded_points_check;
alter table public.lobby_team_results add constraint lobby_team_results_awarded_points_check check (awarded_points % 5 = 0);

alter table public.competitive_point_events drop constraint if exists competitive_point_events_points_check;
alter table public.competitive_point_events add constraint competitive_point_events_points_check check (points % 5 = 0);
