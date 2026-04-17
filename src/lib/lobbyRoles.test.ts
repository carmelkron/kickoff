import { describe, expect, it } from 'vitest';
import { canManageLobby, isSecondaryLobbyOrganizer } from './lobbyRoles';

const lobby = {
  createdBy: 'creator',
  organizerIds: ['assistant'],
  players: [{ id: 'creator' }, { id: 'assistant' }, { id: 'player' }],
};

describe('lobbyRoles', () => {
  it('lets the creator manage the lobby', () => {
    expect(canManageLobby(lobby, 'creator')).toBe(true);
  });

  it('lets a joined secondary organizer manage the lobby', () => {
    expect(isSecondaryLobbyOrganizer(lobby, 'assistant')).toBe(true);
    expect(canManageLobby(lobby, 'assistant')).toBe(true);
  });

  it('does not grant organizer powers to regular players', () => {
    expect(isSecondaryLobbyOrganizer(lobby, 'player')).toBe(false);
    expect(canManageLobby(lobby, 'player')).toBe(false);
  });

  it('does not grant organizer powers when the organizer is no longer joined', () => {
    expect(
      isSecondaryLobbyOrganizer(
        {
          ...lobby,
          players: [{ id: 'creator' }, { id: 'player' }],
        },
        'assistant',
      ),
    ).toBe(false);
  });
});
