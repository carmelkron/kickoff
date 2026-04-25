alter table public.profiles
add column if not exists onboarding_status text not null default 'complete';

update public.profiles
set onboarding_status = 'complete'
where onboarding_status is distinct from 'complete'
  and onboarding_status not in ('pending_required', 'pending_optional', 'complete');

alter table public.profiles
drop constraint if exists profiles_onboarding_status_check;

alter table public.profiles
add constraint profiles_onboarding_status_check
check (onboarding_status in ('pending_required', 'pending_optional', 'complete'));
