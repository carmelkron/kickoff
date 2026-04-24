import type { NotificationPreferenceKey, NotificationPreferences, ThemeMode } from '../types';

export const LOCAL_PREFERENCES_KEY = 'kickoff:preferences';
export const LOCAL_SEARCH_HISTORY_KEY = 'kickoff:search-history';
export const SEARCH_HISTORY_LIMIT = 8;

export const NOTIFICATION_PREFERENCE_KEYS: NotificationPreferenceKey[] = [
  'lobbyInvites',
  'joinRequests',
  'waitlist',
  'competitiveResults',
  'organizerReminders',
];

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  lobbyInvites: true,
  joinRequests: true,
  waitlist: true,
  competitiveResults: true,
  organizerReminders: true,
};

export function normalizeNotificationPreferences(
  value?: Partial<NotificationPreferences> | null,
): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...value,
  };
}

export function getInitialThemeMode(): ThemeMode {
  return 'system';
}

export function getSystemTheme(): Exclude<ThemeMode, 'system'> {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveThemeMode(themeMode: ThemeMode): Exclude<ThemeMode, 'system'> {
  return themeMode === 'system' ? getSystemTheme() : themeMode;
}

export function mapNotificationKindToPreference(
  kind:
    | 'friend_request'
    | 'friend_request_accepted'
    | 'friend_request_declined'
    | 'friend_joined_lobby'
    | 'lobby_join_request'
    | 'lobby_join_request_approved'
    | 'lobby_join_request_declined'
    | 'waitlist_spot_opened'
    | 'lobby_invite'
    | 'competitive_result'
    | 'team_assigned'
    | 'organizer_summary',
): NotificationPreferenceKey {
  if (kind === 'lobby_invite') {
    return 'lobbyInvites';
  }

  if (kind === 'lobby_join_request' || kind === 'lobby_join_request_approved' || kind === 'lobby_join_request_declined') {
    return 'joinRequests';
  }

  if (kind === 'waitlist_spot_opened') {
    return 'waitlist';
  }

  if (kind === 'competitive_result' || kind === 'team_assigned') {
    return 'competitiveResults';
  }

  return 'organizerReminders';
}
