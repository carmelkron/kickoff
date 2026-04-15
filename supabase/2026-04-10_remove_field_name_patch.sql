alter table public.lobbies
  drop constraint if exists lobbies_field_name_length_check;

alter table public.lobbies
  drop column if exists field_name;
