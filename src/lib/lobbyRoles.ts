type LobbyRolePlayer = {
  id: string;
};

type LobbyRoleSource = {
  createdBy: string;
  organizerIds: string[];
  players: LobbyRolePlayer[];
};

function isJoinedPlayer(lobby: LobbyRoleSource, profileId: string) {
  return lobby.players.some((player) => player.id === profileId);
}

export function isSecondaryLobbyOrganizer(lobby: LobbyRoleSource, profileId?: string | null) {
  if (!profileId) {
    return false;
  }

  return lobby.organizerIds.includes(profileId) && isJoinedPlayer(lobby, profileId);
}

export function canManageLobby(lobby: LobbyRoleSource, profileId?: string | null) {
  if (!profileId) {
    return false;
  }

  return lobby.createdBy === profileId || isSecondaryLobbyOrganizer(lobby, profileId);
}
