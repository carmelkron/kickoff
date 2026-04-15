alter table public.profiles
  add column if not exists home_latitude double precision,
  add column if not exists home_longitude double precision,
  add column if not exists home_address text;

alter table public.lobbies
  add column if not exists field_type text check (field_type in ('grass', 'asphalt', 'indoor')),
  add column if not exists gender_restriction text not null default 'none' check (gender_restriction in ('none', 'male', 'female')),
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.lobbies drop constraint if exists lobbies_address_length_check;
alter table public.lobbies
  add constraint lobbies_address_length_check check (char_length(trim(address)) between 2 and 160);
