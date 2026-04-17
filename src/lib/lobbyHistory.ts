import type { LobbyHistoryEntry, LobbyStatus } from '../types';

export type LobbyHistoryMembershipRow = {
  lobby_id: string;
  status: 'joined' | 'waitlisted' | 'pending_confirm' | 'waitlisted_passed' | 'left';
};

export type LobbyHistoryLobbyRow = {
  id: string;
  title: string;
  city: string;
  datetime: string;
  status?: LobbyStatus | null;
};

export function buildLobbyHistoryEntries(
  memberships: LobbyHistoryMembershipRow[],
  lobbies: LobbyHistoryLobbyRow[],
  now = new Date(),
): LobbyHistoryEntry[] {
  const joinedLobbyIds = new Set(
    memberships
      .filter((membership) => membership.status === 'joined')
      .map((membership) => membership.lobby_id),
  );

  return lobbies
    .filter((lobby) => joinedLobbyIds.has(lobby.id))
    .filter((lobby) => lobby.status !== 'deleted')
    .filter((lobby) => new Date(lobby.datetime).getTime() <= now.getTime())
    .sort((left, right) => new Date(right.datetime).getTime() - new Date(left.datetime).getTime())
    .map((lobby) => ({
      lobbyId: lobby.id,
      lobbyTitle: lobby.title,
      date: lobby.datetime,
      city: lobby.city,
      ratingChange: 0,
    }));
}
