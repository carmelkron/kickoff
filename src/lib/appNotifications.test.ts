import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCompetitiveResultNotifications,
  createFriendJoinedLobbyNotifications,
  createFriendRequestNotification,
  createFriendRequestResolutionNotification,
  createLobbyInviteNotification,
  createLobbyJoinRequestNotification,
  createLobbyJoinRequestResolutionNotification,
  createOrganizerSummaryNotification,
  createTeamAssignedNotifications,
  createWaitlistSpotOpenedNotifications,
  deleteAllNotifications,
  deleteNotification,
  fetchAcceptedFriendIds,
  fetchNotifications,
  markAllNotificationsRead,
  markFriendRequestNotificationsHandled,
  markLobbyJoinRequestNotificationsHandled,
  markNotificationRead,
  markWaitlistSpotNotificationsHandled,
} from './appNotifications';
import type { Lobby } from '../types';

const requireSupabaseMock = vi.fn();
const fromMock = vi.fn();

let terminalResult: { data?: unknown; error?: unknown } = {};
let chainCalls: Array<{ method: string; args: unknown[] }> = [];

function makeQueryBuilder() {
  const builder = {
    select: (...args: unknown[]) => {
      chainCalls.push({ method: 'select', args });
      return builder;
    },
    eq: (...args: unknown[]) => {
      chainCalls.push({ method: 'eq', args });
      return builder;
    },
    in: (...args: unknown[]) => {
      chainCalls.push({ method: 'in', args });
      return builder;
    },
    order: (...args: unknown[]) => {
      chainCalls.push({ method: 'order', args });
      return builder;
    },
    limit: (...args: unknown[]) => {
      chainCalls.push({ method: 'limit', args });
      return Promise.resolve(terminalResult);
    },
    or: (...args: unknown[]) => {
      chainCalls.push({ method: 'or', args });
      return Promise.resolve(terminalResult);
    },
    update: (...args: unknown[]) => {
      chainCalls.push({ method: 'update', args });
      return builder;
    },
    delete: (...args: unknown[]) => {
      chainCalls.push({ method: 'delete', args });
      return builder;
    },
    insert: (...args: unknown[]) => {
      chainCalls.push({ method: 'insert', args });
      return Promise.resolve(terminalResult);
    },
  };

  return builder;
}

vi.mock('./supabase', () => ({
  requireSupabase: () => requireSupabaseMock(),
}));

function makeLobby(overrides: Partial<Lobby> = {}): Lobby {
  return {
    id: 'lobby-1',
    title: 'Evening Match',
    address: '1 Dizengoff St',
    city: 'Tel Aviv',
    datetime: '2099-06-01T19:30:00.000Z',
    players: [],
    maxPlayers: 10,
    isPrivate: false,
    createdBy: 'host-1',
    organizerIds: [],
    distanceKm: 3,
    waitlist: [],
    gameType: 'competitive',
    accessType: 'open',
    status: 'active',
    viewerHasAccess: true,
    viewerIsInvited: false,
    viewerHasFriendInside: false,
    ...overrides,
  };
}

describe('appNotifications', () => {
  beforeEach(() => {
    terminalResult = { data: null, error: null };
    chainCalls = [];
    fromMock.mockReset().mockImplementation(() => makeQueryBuilder());
    requireSupabaseMock.mockReset().mockReturnValue({
      from: fromMock,
    });
  });

  it('maps fetched notifications into user-facing English messages', async () => {
    terminalResult = {
      data: [
        {
          id: 'notif-1',
          profile_id: 'user-1',
          actor_profile_id: 'friend-1',
          lobby_id: null,
          kind: 'friend_request',
          data: { requesterName: 'Dana' },
          is_read: false,
          created_at: '2026-04-23T10:00:00.000Z',
        },
        {
          id: 'notif-2',
          profile_id: 'user-1',
          actor_profile_id: 'host-1',
          lobby_id: 'lobby-1',
          kind: 'lobby_join_request_approved',
          data: { lobbyTitle: 'Evening Match', membershipStatus: 'waitlisted' },
          is_read: true,
          created_at: '2026-04-23T11:00:00.000Z',
        },
        {
          id: 'notif-3',
          profile_id: 'user-1',
          actor_profile_id: 'host-1',
          lobby_id: 'lobby-1',
          kind: 'competitive_result',
          data: { lobbyTitle: 'Evening Match', teamColor: 'blue', wins: 3, rank: 1, points: -2 },
          is_read: false,
          created_at: '2026-04-23T12:00:00.000Z',
        },
      ],
      error: null,
    };

    const notifications = await fetchNotifications('user-1', 'en');

    expect(fromMock).toHaveBeenCalledWith('notifications');
    expect(chainCalls.some((call) => call.method === 'in')).toBe(true);
    expect(notifications).toEqual([
      expect.objectContaining({
        id: 'notif-1',
        kind: 'friend_request',
        title: 'New friend request',
        message: 'Dana sent you a friend request.',
        requesterId: 'friend-1',
      }),
      expect.objectContaining({
        id: 'notif-2',
        kind: 'lobby_join_request_approved',
        title: 'Lobby access approved',
        message: 'Your request for Evening Match was approved, and you were added to the waitlist because the lobby is currently full.',
        isRead: true,
      }),
      expect.objectContaining({
        id: 'notif-3',
        kind: 'competitive_result',
        title: 'Lobby result was published',
        message: 'Evening Match: the Blue team finished in place 1, with 3 wins, and you lost 2 points.',
      }),
    ]);
  });

  it('returns an empty list when the notifications table is missing', async () => {
    terminalResult = {
      data: null,
      error: { message: 'relation notifications does not exist' },
    };

    await expect(fetchNotifications('user-1', 'en')).resolves.toEqual([]);
  });

  it('maps additional notification kinds and Hebrew fallback text', async () => {
    terminalResult = {
      data: [
        {
          id: 'notif-accepted',
          profile_id: 'user-1',
          actor_profile_id: 'friend-1',
          lobby_id: null,
          kind: 'friend_request_accepted',
          data: {},
          is_read: false,
          created_at: '2026-04-23T10:00:00.000Z',
        },
        {
          id: 'notif-joined',
          profile_id: 'user-1',
          actor_profile_id: 'friend-1',
          lobby_id: 'lobby-1',
          kind: 'friend_joined_lobby',
          data: {},
          is_read: false,
          created_at: '2026-04-23T10:01:00.000Z',
        },
        {
          id: 'notif-request',
          profile_id: 'user-1',
          actor_profile_id: 'friend-1',
          lobby_id: 'lobby-1',
          kind: 'lobby_join_request',
          data: { requesterName: 'Dana', lobbyTitle: 'Night Game' },
          is_read: false,
          created_at: '2026-04-23T10:02:00.000Z',
        },
        {
          id: 'notif-declined',
          profile_id: 'user-1',
          actor_profile_id: 'host-1',
          lobby_id: 'lobby-1',
          kind: 'lobby_join_request_declined',
          data: {},
          is_read: false,
          created_at: '2026-04-23T10:03:00.000Z',
        },
        {
          id: 'notif-waitlist',
          profile_id: 'user-1',
          actor_profile_id: 'host-1',
          lobby_id: 'lobby-1',
          kind: 'waitlist_spot_opened',
          data: {},
          is_read: false,
          created_at: '2026-04-23T10:04:00.000Z',
        },
        {
          id: 'notif-invite',
          profile_id: 'user-1',
          actor_profile_id: 'host-1',
          lobby_id: 'lobby-1',
          kind: 'lobby_invite',
          data: {},
          is_read: false,
          created_at: '2026-04-23T10:05:00.000Z',
        },
        {
          id: 'notif-team',
          profile_id: 'user-1',
          actor_profile_id: 'host-1',
          lobby_id: 'lobby-1',
          kind: 'team_assigned',
          data: { teamColor: 'red' },
          is_read: false,
          created_at: '2026-04-23T10:06:00.000Z',
        },
        {
          id: 'notif-result',
          profile_id: 'user-1',
          actor_profile_id: 'host-1',
          lobby_id: 'lobby-1',
          kind: 'competitive_result',
          data: { teamColor: 'green', wins: 2, rank: 1.5, points: 3 },
          is_read: false,
          created_at: '2026-04-23T10:07:00.000Z',
        },
        {
          id: 'notif-organizer',
          profile_id: 'user-1',
          actor_profile_id: 'host-1',
          lobby_id: 'lobby-1',
          kind: 'organizer_summary',
          data: {},
          is_read: false,
          created_at: '2026-04-23T10:08:00.000Z',
        },
      ],
      error: null,
    };

    const notifications = await fetchNotifications('user-1', 'he');

    expect(notifications[0].title).toContain('בקשת החברות אושרה');
    expect(notifications[0].message).toContain('אושרה');
    expect(notifications[1].message).toContain('הצטרף ללובי');
    expect(notifications[2].message).toContain('Night Game');
    expect(notifications[3].message).toContain('נדחתה');
    expect(notifications[4].message).toContain('אפשרות להיכנס');
    expect(notifications[5].title).toContain('הוזמנתם');
    expect(notifications[6].title).toContain('אדומה');
    expect(notifications[7].message).toContain('קיבלתם 3 נקודות');
    expect(notifications[8].title).toContain('עדכון ללובי שלך');
  });

  it('throws on non-missing notifications fetch errors', async () => {
    terminalResult = {
      data: null,
      error: new Error('boom'),
    };

    await expect(fetchNotifications('user-1', 'en')).rejects.toThrow('boom');
  });

  it('creates friend lobby notifications for recipients except the actor', async () => {
    await createFriendJoinedLobbyNotifications('actor-1', 'Dana', ['actor-1', 'user-2', 'user-3'], makeLobby());

    expect(fromMock).toHaveBeenCalledWith('notifications');
    expect(chainCalls).toContainEqual({
      method: 'insert',
      args: [[
        {
          profile_id: 'user-2',
          actor_profile_id: 'actor-1',
          lobby_id: 'lobby-1',
          kind: 'friend_joined_lobby',
          data: {
            actorName: 'Dana',
            lobbyTitle: 'Evening Match',
          },
        },
        {
          profile_id: 'user-3',
          actor_profile_id: 'actor-1',
          lobby_id: 'lobby-1',
          kind: 'friend_joined_lobby',
          data: {
            actorName: 'Dana',
            lobbyTitle: 'Evening Match',
          },
        },
      ]],
    });
  });

  it('creates the remaining insert-based notification payloads', async () => {
    await createFriendRequestNotification('actor-1', 'Dana', 'user-1');
    await createFriendRequestResolutionNotification('actor-1', 'Dana', 'user-1', 'declined');
    await createLobbyJoinRequestNotification('actor-1', 'Dana', 'host-1', makeLobby());
    await createLobbyJoinRequestResolutionNotification('host-1', 'user-1', makeLobby(), 'approved', 'joined');
    await createWaitlistSpotOpenedNotifications('host-1', makeLobby(), ['user-1', 'user-2']);
    await createLobbyInviteNotification('host-1', 'Dana', 'user-1', makeLobby());
    await createTeamAssignedNotifications('host-1', makeLobby(), [
      { profileId: 'user-1', teamColor: 'blue' },
      { profileId: 'user-2', teamColor: 'yellow' },
    ]);

    const insertCalls = chainCalls.filter((call) => call.method === 'insert');
    expect(insertCalls).toHaveLength(7);
    expect(insertCalls[0].args[0]).toEqual([
      {
        profile_id: 'user-1',
        actor_profile_id: 'actor-1',
        lobby_id: null,
        kind: 'friend_request',
        data: { requesterName: 'Dana' },
      },
    ]);
    expect(insertCalls[1].args[0]).toEqual([
      {
        profile_id: 'user-1',
        actor_profile_id: 'actor-1',
        lobby_id: null,
        kind: 'friend_request_declined',
        data: { actorName: 'Dana' },
      },
    ]);
    expect(insertCalls[2].args[0]).toEqual([
      {
        profile_id: 'host-1',
        actor_profile_id: 'actor-1',
        lobby_id: 'lobby-1',
        kind: 'lobby_join_request',
        data: { requesterName: 'Dana', lobbyTitle: 'Evening Match' },
      },
    ]);
    expect(insertCalls[3].args[0]).toEqual([
      {
        profile_id: 'user-1',
        actor_profile_id: 'host-1',
        lobby_id: 'lobby-1',
        kind: 'lobby_join_request_approved',
        data: { lobbyTitle: 'Evening Match', membershipStatus: 'joined' },
      },
    ]);
    expect(insertCalls[4].args[0]).toEqual([
      {
        profile_id: 'user-1',
        actor_profile_id: 'host-1',
        lobby_id: 'lobby-1',
        kind: 'waitlist_spot_opened',
        data: { lobbyTitle: 'Evening Match' },
      },
      {
        profile_id: 'user-2',
        actor_profile_id: 'host-1',
        lobby_id: 'lobby-1',
        kind: 'waitlist_spot_opened',
        data: { lobbyTitle: 'Evening Match' },
      },
    ]);
    expect(insertCalls[5].args[0]).toEqual([
      {
        profile_id: 'user-1',
        actor_profile_id: 'host-1',
        lobby_id: 'lobby-1',
        kind: 'lobby_invite',
        data: { actorName: 'Dana', lobbyTitle: 'Evening Match' },
      },
    ]);
    expect(insertCalls[6].args[0]).toEqual([
      {
        profile_id: 'user-1',
        actor_profile_id: 'host-1',
        lobby_id: 'lobby-1',
        kind: 'team_assigned',
        data: { lobbyTitle: 'Evening Match', teamColor: 'blue' },
      },
      {
        profile_id: 'user-2',
        actor_profile_id: 'host-1',
        lobby_id: 'lobby-1',
        kind: 'team_assigned',
        data: { lobbyTitle: 'Evening Match', teamColor: 'yellow' },
      },
    ]);
  });

  it('skips organizer summary notifications for inactive lobbies', async () => {
    await createOrganizerSummaryNotification('actor-1', makeLobby({ status: 'expired' }));

    expect(fromMock).not.toHaveBeenCalled();
    expect(chainCalls).toHaveLength(0);
  });

  it('creates organizer summaries and competitive result notifications with the expected payloads', async () => {
    await createOrganizerSummaryNotification('actor-1', makeLobby({
      createdBy: 'host-1',
      players: [{ id: 'player-1' } as never, { id: 'player-2' } as never],
      waitlist: [{ id: 'wait-1' } as never],
      maxPlayers: 12,
    }));

    await createCompetitiveResultNotifications('actor-1', makeLobby(), [
      { profileId: 'user-1', teamColor: 'blue', wins: 3, rank: 1, points: 4 },
      { profileId: 'user-2', teamColor: 'red', wins: 1, rank: 2, points: -1 },
    ]);

    const insertCalls = chainCalls.filter((call) => call.method === 'insert');
    expect(insertCalls[0]).toEqual({
      method: 'insert',
      args: [[
        {
          profile_id: 'host-1',
          actor_profile_id: 'actor-1',
          lobby_id: 'lobby-1',
          kind: 'organizer_summary',
          data: {
            lobbyTitle: 'Evening Match',
            playerCount: 2,
            maxPlayers: 12,
            waitlistCount: 1,
          },
        },
      ]],
    });
    expect(insertCalls[1]).toEqual({
      method: 'insert',
      args: [[
        {
          profile_id: 'user-1',
          actor_profile_id: 'actor-1',
          lobby_id: 'lobby-1',
          kind: 'competitive_result',
          data: {
            lobbyTitle: 'Evening Match',
            teamColor: 'blue',
            wins: 3,
            rank: 1,
            points: 4,
          },
        },
        {
          profile_id: 'user-2',
          actor_profile_id: 'actor-1',
          lobby_id: 'lobby-1',
          kind: 'competitive_result',
          data: {
            lobbyTitle: 'Evening Match',
            teamColor: 'red',
            wins: 1,
            rank: 2,
            points: -1,
          },
        },
      ]],
    });
  });

  it('fetches accepted friend ids and marks all notifications as read', async () => {
    terminalResult = {
      data: [
        { from_profile_id: 'user-1', to_profile_id: 'friend-1' },
        { from_profile_id: 'friend-2', to_profile_id: 'user-1' },
      ],
      error: null,
    };

    await expect(fetchAcceptedFriendIds('user-1')).resolves.toEqual(['friend-1', 'friend-2']);

    chainCalls = [];
    terminalResult = { data: null, error: null };
    await markAllNotificationsRead('user-1');

    expect(fromMock).toHaveBeenLastCalledWith('notifications');
    expect(chainCalls).toEqual([
      { method: 'update', args: [{ is_read: true }] },
      { method: 'eq', args: ['profile_id', 'user-1'] },
      { method: 'eq', args: ['is_read', false] },
    ]);
  });

  it('marks and deletes notification records using the expected filters', async () => {
    await markNotificationRead('notif-1');
    expect(chainCalls).toEqual([
      { method: 'update', args: [{ is_read: true }] },
      { method: 'eq', args: ['id', 'notif-1'] },
    ]);

    chainCalls = [];
    await deleteNotification('notif-2');
    expect(chainCalls).toEqual([
      { method: 'delete', args: [] },
      { method: 'eq', args: ['id', 'notif-2'] },
    ]);

    chainCalls = [];
    await deleteAllNotifications('user-1');
    expect(chainCalls).toEqual([
      { method: 'delete', args: [] },
      { method: 'eq', args: ['profile_id', 'user-1'] },
    ]);

    chainCalls = [];
    await markFriendRequestNotificationsHandled('actor-1', 'user-1');
    expect(chainCalls).toEqual([
      { method: 'update', args: [{ is_read: true }] },
      { method: 'eq', args: ['profile_id', 'user-1'] },
      { method: 'eq', args: ['actor_profile_id', 'actor-1'] },
      { method: 'eq', args: ['kind', 'friend_request'] },
    ]);

    chainCalls = [];
    await markLobbyJoinRequestNotificationsHandled('actor-1', 'lobby-1', 'user-1');
    expect(chainCalls).toEqual([
      { method: 'update', args: [{ is_read: true }] },
      { method: 'eq', args: ['profile_id', 'user-1'] },
      { method: 'eq', args: ['actor_profile_id', 'actor-1'] },
      { method: 'eq', args: ['lobby_id', 'lobby-1'] },
      { method: 'eq', args: ['kind', 'lobby_join_request'] },
    ]);

    chainCalls = [];
    await markWaitlistSpotNotificationsHandled('user-1', 'lobby-1');
    expect(chainCalls).toEqual([
      { method: 'update', args: [{ is_read: true }] },
      { method: 'eq', args: ['profile_id', 'user-1'] },
      { method: 'eq', args: ['lobby_id', 'lobby-1'] },
      { method: 'eq', args: ['kind', 'waitlist_spot_opened'] },
      { method: 'eq', args: ['is_read', false] },
    ]);
  });

  it('ignores missing notifications-table errors in mutation helpers', async () => {
    terminalResult = {
      data: null,
      error: { message: 'notifications schema cache could not find relation' },
    };

    await expect(markNotificationRead('notif-1')).resolves.toBeUndefined();
    await expect(markAllNotificationsRead('user-1')).resolves.toBeUndefined();
    await expect(deleteNotification('notif-2')).resolves.toBeUndefined();
    await expect(deleteAllNotifications('user-1')).resolves.toBeUndefined();
    await expect(markFriendRequestNotificationsHandled('actor-1', 'user-1')).resolves.toBeUndefined();
    await expect(markLobbyJoinRequestNotificationsHandled('actor-1', 'lobby-1', 'user-1')).resolves.toBeUndefined();
    await expect(markWaitlistSpotNotificationsHandled('user-1', 'lobby-1')).resolves.toBeUndefined();
  });
});
