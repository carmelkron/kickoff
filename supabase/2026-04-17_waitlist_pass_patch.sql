alter table public.lobby_memberships drop constraint if exists lobby_memberships_status_check;
alter table public.lobby_memberships add constraint lobby_memberships_status_check check (
  status in ('joined', 'waitlisted', 'pending_confirm', 'waitlisted_passed', 'left')
);

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in (
    'friend_request',
    'friend_request_accepted',
    'friend_request_declined',
    'friend_joined_lobby',
    'waitlist_spot_opened',
    'lobby_invite',
    'competitive_result',
    'team_assigned',
    'organizer_summary'
  )
);
