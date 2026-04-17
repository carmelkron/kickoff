import type { Language, Lobby, TeamColor } from '../types';
import { requireSupabase } from './supabase';
import { getTeamColorLabel } from './teamAssignment';

type NotificationKind =
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
  | 'organizer_summary';

type NotificationRow = {
  id: string;
  profile_id: string;
  actor_profile_id: string | null;
  lobby_id: string | null;
  kind: NotificationKind;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  lobbyId?: string;
  profileId?: string;
  requesterId?: string;
};

function getErrorText(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const maybeMessage = 'message' in error && typeof error.message === 'string' ? error.message : '';
    const maybeDetails = 'details' in error && typeof error.details === 'string' ? error.details : '';
    const maybeHint = 'hint' in error && typeof error.hint === 'string' ? error.hint : '';
    return [maybeMessage, maybeDetails, maybeHint].filter(Boolean).join(' ');
  }

  return '';
}

function isMissingNotificationsTableError(error: unknown) {
  const text = getErrorText(error).toLowerCase();
  return text.includes('notifications') && (
    text.includes('does not exist')
    || text.includes('schema cache')
    || text.includes('could not find')
    || text.includes('relation')
  );
}

function readString(data: Record<string, unknown> | null, key: string) {
  const value = data?.[key];
  return typeof value === 'string' ? value : '';
}

function readNumber(data: Record<string, unknown> | null, key: string) {
  const value = data?.[key];
  return typeof value === 'number' ? value : 0;
}

function mapNotification(row: NotificationRow, lang: Language): AppNotification {
  const isHebrew = lang === 'he';

  if (row.kind === 'friend_request') {
    const requesterName = readString(row.data, 'requesterName');
    return {
      id: row.id,
      kind: row.kind,
      title: isHebrew ? 'בקשת חברות חדשה' : 'New friend request',
      message: requesterName
        ? (isHebrew ? `${requesterName} שלח לך בקשת חברות.` : `${requesterName} sent you a friend request.`)
        : (isHebrew ? 'קיבלת בקשת חברות חדשה.' : 'You received a new friend request.'),
      isRead: row.is_read,
      createdAt: row.created_at,
      profileId: row.actor_profile_id ?? undefined,
      requesterId: row.actor_profile_id ?? undefined,
    };
  }

  if (row.kind === 'friend_request_accepted' || row.kind === 'friend_request_declined') {
    const actorName = readString(row.data, 'actorName');
    const accepted = row.kind === 'friend_request_accepted';
    return {
      id: row.id,
      kind: row.kind,
      title: accepted
        ? (isHebrew ? '\u05d1\u05e7\u05e9\u05ea \u05d4\u05d7\u05d1\u05e8\u05d5\u05ea \u05d0\u05d5\u05e9\u05e8\u05d4' : 'Friend request accepted')
        : (isHebrew ? '\u05d1\u05e7\u05e9\u05ea \u05d4\u05d7\u05d1\u05e8\u05d5\u05ea \u05e0\u05d3\u05d7\u05ea\u05d4' : 'Friend request declined'),
      message: actorName
        ? (
          accepted
            ? (isHebrew ? `${actorName} \u05d0\u05d9\u05e9\u05e8/\u05d4 \u05d0\u05ea \u05d1\u05e7\u05e9\u05ea \u05d4\u05d7\u05d1\u05e8\u05d5\u05ea \u05e9\u05dc\u05da.` : `${actorName} accepted your friend request.`)
            : (isHebrew ? `${actorName} \u05d3\u05d7\u05d4/\u05ea\u05d4 \u05d0\u05ea \u05d1\u05e7\u05e9\u05ea \u05d4\u05d7\u05d1\u05e8\u05d5\u05ea \u05e9\u05dc\u05da.` : `${actorName} declined your friend request.`)
        )
        : (
          accepted
            ? (isHebrew ? '\u05d1\u05e7\u05e9\u05ea \u05d4\u05d7\u05d1\u05e8\u05d5\u05ea \u05e9\u05dc\u05da \u05d0\u05d5\u05e9\u05e8\u05d4.' : 'Your friend request was accepted.')
            : (isHebrew ? '\u05d1\u05e7\u05e9\u05ea \u05d4\u05d7\u05d1\u05e8\u05d5\u05ea \u05e9\u05dc\u05da \u05e0\u05d3\u05d7\u05ea\u05d4.' : 'Your friend request was declined.')
        ),
      isRead: row.is_read,
      createdAt: row.created_at,
      profileId: row.actor_profile_id ?? undefined,
    };
  }

  if (row.kind === 'friend_joined_lobby') {
    const actorName = readString(row.data, 'actorName');
    const lobbyTitle = readString(row.data, 'lobbyTitle');
    return {
      id: row.id,
      kind: row.kind,
      title: isHebrew ? 'חבר שלך הצטרף ללובי' : 'Your friend joined a lobby',
      message: actorName && lobbyTitle
        ? (isHebrew ? `${actorName} הצטרף ל-${lobbyTitle}.` : `${actorName} joined ${lobbyTitle}.`)
        : (isHebrew ? 'חבר שלך הצטרף ללובי.' : 'Your friend joined a lobby.'),
      isRead: row.is_read,
      createdAt: row.created_at,
      lobbyId: row.lobby_id ?? undefined,
      profileId: row.actor_profile_id ?? undefined,
    };
  }

  if (row.kind === 'lobby_join_request') {
    const requesterName = readString(row.data, 'requesterName');
    const lobbyTitle = readString(row.data, 'lobbyTitle');
    return {
      id: row.id,
      kind: row.kind,
      title: isHebrew ? 'בקשת כניסה חדשה ללובי' : 'New lobby access request',
      message: requesterName && lobbyTitle
        ? (isHebrew
            ? `${requesterName} ביקש/ה להיכנס ל-${lobbyTitle}.`
            : `${requesterName} requested access to ${lobbyTitle}.`)
        : (isHebrew
            ? 'יש בקשת כניסה חדשה ללובי שלך.'
            : 'There is a new access request for your lobby.'),
      isRead: row.is_read,
      createdAt: row.created_at,
      lobbyId: row.lobby_id ?? undefined,
      profileId: row.actor_profile_id ?? undefined,
      requesterId: row.actor_profile_id ?? undefined,
    };
  }

  if (row.kind === 'lobby_join_request_approved' || row.kind === 'lobby_join_request_declined') {
    const lobbyTitle = readString(row.data, 'lobbyTitle');
    const approved = row.kind === 'lobby_join_request_approved';
    const membershipStatus = readString(row.data, 'membershipStatus');
    return {
      id: row.id,
      kind: row.kind,
      title: approved
        ? (isHebrew ? 'בקשת הכניסה אושרה' : 'Lobby access approved')
        : (isHebrew ? 'בקשת הכניסה נדחתה' : 'Lobby access declined'),
      message: lobbyTitle
        ? (approved
            ? (
                membershipStatus === 'waitlisted'
                  ? (isHebrew ? `הבקשה שלך ל-${lobbyTitle} אושרה, ונוספת לרשימת ההמתנה כי הלובי מלא כרגע.` : `Your request for ${lobbyTitle} was approved, and you were added to the waitlist because the lobby is currently full.`)
                  : (isHebrew ? `הבקשה שלך ל-${lobbyTitle} אושרה, ונוספת ישירות ללובי.` : `Your request for ${lobbyTitle} was approved, and you were added directly to the lobby.`)
              )
            : (isHebrew ? `הבקשה שלך ל-${lobbyTitle} נדחתה.` : `Your request for ${lobbyTitle} was declined.`))
        : (approved
            ? (
                membershipStatus === 'waitlisted'
                  ? (isHebrew ? 'בקשת הכניסה שלך אושרה ונוספת לרשימת ההמתנה.' : 'Your access request was approved and you were added to the waitlist.')
                  : (isHebrew ? 'בקשת הכניסה שלך אושרה ונוספת ללובי.' : 'Your access request was approved and you were added to the lobby.')
              )
            : (isHebrew ? 'בקשת הכניסה שלך נדחתה.' : 'Your access request was declined.')),
      isRead: row.is_read,
      createdAt: row.created_at,
      lobbyId: row.lobby_id ?? undefined,
    };
  }

  if (row.kind === 'waitlist_spot_opened') {
    const lobbyTitle = readString(row.data, 'lobbyTitle');
    return {
      id: row.id,
      kind: row.kind,
      title: isHebrew ? 'התפנה לך מקום בלובי' : 'A lobby spot opened for you',
      message: lobbyTitle
        ? (isHebrew
            ? `יש לך כרגע אפשרות להיכנס ל-${lobbyTitle}. אפשר לאשר או להעביר זמנית לבא בתור בלי לאבד עדיפות.`
            : `You can now join ${lobbyTitle}. You may confirm or temporarily pass it to the next player without losing priority.`)
        : (isHebrew
            ? 'יש לך כרגע אפשרות להיכנס ללובי. אפשר לאשר או להעביר זמנית לבא בתור בלי לאבד עדיפות.'
            : 'You can now join the lobby. You may confirm or temporarily pass it to the next player without losing priority.'),
      isRead: row.is_read,
      createdAt: row.created_at,
      lobbyId: row.lobby_id ?? undefined,
    };
  }

  if (row.kind === 'lobby_invite') {
    const actorName = readString(row.data, 'actorName');
    const lobbyTitle = readString(row.data, 'lobbyTitle');
    return {
      id: row.id,
      kind: row.kind,
      title: isHebrew ? 'הוזמנתם ללובי נעול' : 'You were invited to a locked lobby',
      message: actorName && lobbyTitle
        ? (isHebrew ? `${actorName} הזמין אתכם ל-${lobbyTitle}. לחצו כדי לצפות בלובי.` : `${actorName} invited you to ${lobbyTitle}. Tap to open the lobby.`)
        : (isHebrew ? 'קיבלתם הזמנה ללובי נעול. לחצו כדי לפתוח אותו.' : 'You received an invitation to a locked lobby. Tap to open it.'),
      isRead: row.is_read,
      createdAt: row.created_at,
      lobbyId: row.lobby_id ?? undefined,
    };
  }

  if (row.kind === 'team_assigned') {
    const teamColor = readString(row.data, 'teamColor') as TeamColor;
    const lobbyTitle = readString(row.data, 'lobbyTitle');
    const colorLabel = getTeamColorLabel(teamColor, lang);
    return {
      id: row.id,
      kind: row.kind,
      title: isHebrew ? `שובצתם לקבוצה ה${colorLabel}` : `You were assigned to the ${colorLabel} team`,
      message: lobbyTitle
        ? (isHebrew ? `ההרכבים ל-${lobbyTitle} נקבעו. לחצו כדי לראות את הקבוצות.` : `The lineups for ${lobbyTitle} are ready. Tap to view the teams.`)
        : (isHebrew ? 'ההרכבים נקבעו. לחצו כדי לראות את הקבוצות.' : 'The lineups are ready. Tap to view the teams.'),
      isRead: row.is_read,
      createdAt: row.created_at,
      lobbyId: row.lobby_id ?? undefined,
    };
  }

  if (row.kind === 'competitive_result') {
    const teamColor = readString(row.data, 'teamColor') as TeamColor;
    const lobbyTitle = readString(row.data, 'lobbyTitle');
    const wins = readNumber(row.data, 'wins');
    const rank = readNumber(row.data, 'rank');
    const points = readNumber(row.data, 'points');
    const colorLabel = getTeamColorLabel(teamColor, lang);
    const rankLabel =
      rank === Math.trunc(rank)
        ? (isHebrew ? `מקום ${rank}` : `place ${rank}`)
        : (isHebrew ? `מקום ${rank.toFixed(1)}` : `place ${rank.toFixed(1)}`);

    return {
      id: row.id,
      kind: row.kind,
      title: isHebrew ? 'תוצאות הלובי פורסמו' : 'Lobby result was published',
      message: lobbyTitle
        ? (
          isHebrew
            ? `${lobbyTitle}: הקבוצה ה${colorLabel} סיימה ב${rankLabel}, עם ${wins} ניצחונות, וקיבלתם ${points} נקודות.`
            : `${lobbyTitle}: the ${colorLabel} team finished in ${rankLabel}, with ${wins} wins, and you earned ${points} points.`
        )
        : (
          isHebrew
            ? `תוצאות הלובי פורסמו. קיבלתם ${points} נקודות.`
            : `The lobby result was published. You earned ${points} points.`
        ),
      isRead: row.is_read,
      createdAt: row.created_at,
      lobbyId: row.lobby_id ?? undefined,
    };
  }

  const lobbyTitle = readString(row.data, 'lobbyTitle');
  const playerCount = readNumber(row.data, 'playerCount');
  const maxPlayers = readNumber(row.data, 'maxPlayers');
  const waitlistCount = readNumber(row.data, 'waitlistCount');

  return {
    id: row.id,
    kind: row.kind,
    title: isHebrew ? 'עדכון ללובי שלך' : 'Update for your lobby',
    message: lobbyTitle
      ? (isHebrew
          ? `${lobbyTitle}: ${playerCount}/${maxPlayers} שחקנים${waitlistCount > 0 ? `, ${waitlistCount} בהמתנה` : ''}.`
          : `${lobbyTitle}: ${playerCount}/${maxPlayers} players${waitlistCount > 0 ? `, ${waitlistCount} waiting` : ''}.`)
      : (isHebrew ? 'יש עדכון חדש ללובי שלך.' : 'There is a new update for your lobby.'),
    isRead: row.is_read,
    createdAt: row.created_at,
    lobbyId: row.lobby_id ?? undefined,
  };
}

async function insertNotifications(rows: Array<Omit<NotificationRow, 'id' | 'is_read' | 'created_at'>>) {
  if (rows.length === 0) {
    return;
  }

  const supabase = requireSupabase();
  const payload = rows.map((row) => ({
    profile_id: row.profile_id,
    actor_profile_id: row.actor_profile_id,
    lobby_id: row.lobby_id,
    kind: row.kind,
    data: row.data ?? {},
  }));

  const { error } = await supabase.from('notifications').insert(payload);
  if (error && !isMissingNotificationsTableError(error)) {
    throw error;
  }
}

export async function fetchNotifications(profileId: string, lang: Language): Promise<AppNotification[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .select('id, profile_id, actor_profile_id, lobby_id, kind, data, is_read, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    if (isMissingNotificationsTableError(error)) {
      return [];
    }
    throw error;
  }

  return ((data ?? []) as NotificationRow[]).map((row) => mapNotification(row, lang));
}

export async function markNotificationRead(notificationId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error && !isMissingNotificationsTableError(error)) {
    throw error;
  }
}

export async function markAllNotificationsRead(profileId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('profile_id', profileId)
    .eq('is_read', false);

  if (error && !isMissingNotificationsTableError(error)) {
    throw error;
  }
}

export async function deleteNotification(notificationId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error && !isMissingNotificationsTableError(error)) {
    throw error;
  }
}

export async function deleteAllNotifications(profileId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('profile_id', profileId);

  if (error && !isMissingNotificationsTableError(error)) {
    throw error;
  }
}

export async function markFriendRequestNotificationsHandled(requesterId: string, recipientId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('profile_id', recipientId)
    .eq('actor_profile_id', requesterId)
    .eq('kind', 'friend_request');

  if (error && !isMissingNotificationsTableError(error)) {
    throw error;
  }
}

export async function createFriendRequestNotification(requesterId: string, requesterName: string, recipientId: string) {
  await insertNotifications([
    {
      profile_id: recipientId,
      actor_profile_id: requesterId,
      lobby_id: null,
      kind: 'friend_request',
      data: {
        requesterName,
      },
    },
  ]);
}

export async function createFriendRequestResolutionNotification(
  actorId: string,
  actorName: string,
  recipientId: string,
  outcome: 'accepted' | 'declined',
) {
  await insertNotifications([
    {
      profile_id: recipientId,
      actor_profile_id: actorId,
      lobby_id: null,
      kind: outcome === 'accepted' ? 'friend_request_accepted' : 'friend_request_declined',
      data: {
        actorName,
      },
    },
  ]);
}

export async function fetchAcceptedFriendIds(profileId: string): Promise<string[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('friend_requests')
    .select('from_profile_id, to_profile_id')
    .eq('status', 'accepted')
    .or(`from_profile_id.eq.${profileId},to_profile_id.eq.${profileId}`);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row: { from_profile_id: string; to_profile_id: string }) =>
    row.from_profile_id === profileId ? row.to_profile_id : row.from_profile_id,
  );
}

export async function createFriendJoinedLobbyNotifications(actorId: string, actorName: string, recipientIds: string[], lobby: Lobby) {
  const rows = recipientIds
    .filter((recipientId) => recipientId !== actorId)
    .map((recipientId) => ({
      profile_id: recipientId,
      actor_profile_id: actorId,
      lobby_id: lobby.id,
      kind: 'friend_joined_lobby' as const,
      data: {
        actorName,
        lobbyTitle: lobby.title,
      },
    }));

  await insertNotifications(rows);
}

export async function createLobbyJoinRequestNotification(
  actorId: string,
  actorName: string,
  recipientId: string,
  lobby: Lobby,
) {
  await insertNotifications([
    {
      profile_id: recipientId,
      actor_profile_id: actorId,
      lobby_id: lobby.id,
      kind: 'lobby_join_request',
      data: {
        requesterName: actorName,
        lobbyTitle: lobby.title,
      },
    },
  ]);
}

export async function createLobbyJoinRequestResolutionNotification(
  actorId: string,
  recipientId: string,
  lobby: Lobby,
  outcome: 'approved' | 'declined',
  membershipStatus?: 'joined' | 'waitlisted',
) {
  await insertNotifications([
    {
      profile_id: recipientId,
      actor_profile_id: actorId,
      lobby_id: lobby.id,
      kind: outcome === 'approved' ? 'lobby_join_request_approved' : 'lobby_join_request_declined',
      data: {
        lobbyTitle: lobby.title,
        ...(membershipStatus ? { membershipStatus } : {}),
      },
    },
  ]);
}

export async function markLobbyJoinRequestNotificationsHandled(requesterId: string, lobbyId: string, recipientId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('profile_id', recipientId)
    .eq('actor_profile_id', requesterId)
    .eq('lobby_id', lobbyId)
    .eq('kind', 'lobby_join_request');

  if (error && !isMissingNotificationsTableError(error)) {
    throw error;
  }
}

export async function createWaitlistSpotOpenedNotifications(
  actorId: string,
  lobby: Lobby,
  recipientIds: string[],
) {
  await insertNotifications(
    recipientIds.map((recipientId) => ({
      profile_id: recipientId,
      actor_profile_id: actorId,
      lobby_id: lobby.id,
      kind: 'waitlist_spot_opened' as const,
      data: {
        lobbyTitle: lobby.title,
      },
    })),
  );
}

export async function markWaitlistSpotNotificationsHandled(profileId: string, lobbyId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('profile_id', profileId)
    .eq('lobby_id', lobbyId)
    .eq('kind', 'waitlist_spot_opened')
    .eq('is_read', false);

  if (error && !isMissingNotificationsTableError(error)) {
    throw error;
  }
}

export async function createLobbyInviteNotification(actorId: string, actorName: string, recipientId: string, lobby: Lobby) {
  await insertNotifications([
    {
      profile_id: recipientId,
      actor_profile_id: actorId,
      lobby_id: lobby.id,
      kind: 'lobby_invite',
      data: {
        actorName,
        lobbyTitle: lobby.title,
      },
    },
  ]);
}

export async function createOrganizerSummaryNotification(actorId: string, lobby: Lobby) {
  if (lobby.status !== 'active') {
    return;
  }

  await insertNotifications([
    {
      profile_id: lobby.createdBy,
      actor_profile_id: actorId,
      lobby_id: lobby.id,
      kind: 'organizer_summary',
      data: {
        lobbyTitle: lobby.title,
        playerCount: lobby.players.length,
        maxPlayers: lobby.maxPlayers,
        waitlistCount: lobby.waitlist.length,
      },
    },
  ]);
}

export async function createTeamAssignedNotifications(
  actorId: string,
  lobby: Lobby,
  assignments: Array<{ profileId: string; teamColor: TeamColor }>,
) {
  await insertNotifications(
    assignments.map((assignment) => ({
      profile_id: assignment.profileId,
      actor_profile_id: actorId,
      lobby_id: lobby.id,
      kind: 'team_assigned' as const,
      data: {
        lobbyTitle: lobby.title,
        teamColor: assignment.teamColor,
      },
    })),
  );
}

export async function createCompetitiveResultNotifications(
  actorId: string,
  lobby: Lobby,
  assignments: Array<{
    profileId: string;
    teamColor: TeamColor;
    wins: number;
    rank: number;
    points: number;
  }>,
) {
  await insertNotifications(
    assignments.map((assignment) => ({
      profile_id: assignment.profileId,
      actor_profile_id: actorId,
      lobby_id: lobby.id,
      kind: 'competitive_result' as const,
      data: {
        lobbyTitle: lobby.title,
        teamColor: assignment.teamColor,
        wins: assignment.wins,
        rank: assignment.rank,
        points: assignment.points,
      },
    })),
  );
}
