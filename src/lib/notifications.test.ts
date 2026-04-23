import { describe, expect, it } from 'vitest';
import { buildNotifications } from './notifications';
import type { AuthUser, Lobby } from '../types';

function makeUser(
  id: string,
  overrides: Partial<AuthUser> = {},
): AuthUser {
  return {
    id,
    name: `User ${id}`,
    email: `${id}@example.com`,
    initials: 'US',
    avatarColor: 'bg-blue-500',
    rating: 5,
    gamesPlayed: 10,
    ratingHistory: [],
    lobbyHistory: [],
    friends: [],
    sentRequests: [],
    pendingRequests: [],
    ...overrides,
  };
}

function makeLobby(
  id: string,
  overrides: Partial<Lobby> = {},
): Lobby {
  return {
    id,
    title: `Lobby ${id}`,
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
    gameType: 'friendly',
    accessType: 'open',
    genderRestriction: 'none',
    status: 'active',
    viewerHasAccess: true,
    viewerIsInvited: false,
    viewerHasFriendInside: false,
    ...overrides,
  };
}

describe('buildNotifications', () => {
  it('builds and prioritizes friend requests, friend lobby alerts, and organizer summaries', () => {
    const currentUser = makeUser('me', {
      friends: ['friend-1', 'friend-2'],
      pendingRequests: ['requester-1'],
    });
    const requester = makeUser('requester-1', { name: 'Dana' });
    const friendOne = makeUser('friend-1', { name: 'Avi' });
    const friendTwo = makeUser('friend-2', { name: 'Noa' });

    const notifications = buildNotifications({
      allUsers: [currentUser, requester, friendOne, friendTwo],
      currentUser,
      lang: 'en',
      lobbies: [
        makeLobby('lobby-friends', {
          title: 'Sunset Match',
          players: [friendOne, friendTwo],
        }),
        makeLobby('lobby-hosted', {
          title: 'Hosted Match',
          createdBy: 'me',
          players: [currentUser],
          waitlist: [friendTwo],
          maxPlayers: 12,
        }),
        makeLobby('lobby-expired', {
          status: 'expired',
          players: [friendOne],
        }),
      ],
    });

    expect(notifications).toHaveLength(3);
    expect(notifications.map((notification) => notification.kind)).toEqual([
      'friend_request',
      'friend_joined_lobby',
      'organizer_summary',
    ]);

    expect(notifications[0]).toMatchObject({
      title: 'New friend request',
      message: 'Dana sent you a friend request.',
      requesterId: 'requester-1',
      priority: 300,
    });

    expect(notifications[1]).toMatchObject({
      title: 'Your friends joined a lobby',
      message: 'Avi and 1 more friends are in Sunset Match.',
      lobbyId: 'lobby-friends',
      priority: 200,
    });

    expect(notifications[2]).toMatchObject({
      title: 'Update for your lobby',
      message: 'Hosted Match: 1/12 players, 1 waiting.',
      lobbyId: 'lobby-hosted',
      priority: 100,
    });
  });

  it('falls back gracefully when the requester is missing and supports Hebrew strings', () => {
    const currentUser = makeUser('me', {
      pendingRequests: ['unknown-user'],
    });

    const notifications = buildNotifications({
      allUsers: [currentUser],
      currentUser,
      lang: 'he',
      lobbies: [],
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      kind: 'friend_request',
      profileId: 'unknown-user',
      requesterId: 'unknown-user',
      priority: 300,
    });
    expect(notifications[0].title).toContain('בקשת');
    expect(notifications[0].message).toContain('קיבלת');
  });

  it('uses the single-friend wording when only one friend is in a lobby', () => {
    const currentUser = makeUser('me', {
      friends: ['friend-1'],
    });
    const friend = makeUser('friend-1', { name: 'Maya' });

    const notifications = buildNotifications({
      allUsers: [currentUser, friend],
      currentUser,
      lang: 'en',
      lobbies: [
        makeLobby('lobby-1', {
          title: 'Morning Game',
          players: [friend],
        }),
      ],
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      kind: 'friend_joined_lobby',
      message: 'Maya is in Morning Game.',
    });
  });
});
