import { describe, expect, it } from 'vitest';
import type { Lobby, Player } from '../types';
import { getJoinLobbyError, validateCreateLobbyDraft, validateRegisterDraft } from './validation';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    name: 'Test Player',
    initials: 'TP',
    avatarColor: 'bg-blue-500',
    rating: 6,
    gamesPlayed: 10,
    ratingHistory: [],
    lobbyHistory: [],
    ...overrides,
  };
}

function makeLobby(overrides: Partial<Lobby> = {}): Lobby {
  return {
    id: 'lobby-1',
    title: 'Evening Match',
    address: '123 Test Street',
    city: 'Tel Aviv',
    datetime: '2099-06-01T18:00:00.000Z',
    players: [],
    maxPlayers: 10,
    numTeams: 2,
    playersPerTeam: 5,
    minRating: 4,
    isPrivate: false,
    createdBy: 'player-1',
    distanceKm: 1,
    waitlist: [],
    gameType: 'competitive',
    genderRestriction: 'none',
    ...overrides,
  };
}

describe('validateRegisterDraft', () => {
  it('accepts a valid draft', () => {
    const errors = validateRegisterDraft({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'secret12',
      confirm: 'secret12',
      bio: 'Midfielder',
    });

    expect(errors).toEqual([]);
  });

  it('rejects invalid profile details', () => {
    const errors = validateRegisterDraft({
      name: 'J',
      email: 'not-an-email',
      password: '123',
      confirm: '456',
      bio: 'x'.repeat(281),
      photoFile: { type: 'image/gif', size: 3 * 1024 * 1024 } as File,
    });

    expect(errors).toContain('Name must be between 2 and 80 characters.');
    expect(errors).toContain('Enter a valid email address.');
    expect(errors).toContain('Password must be between 6 and 72 characters.');
    expect(errors).toContain('Passwords do not match.');
    expect(errors).toContain('Bio must be 280 characters or fewer.');
    expect(errors).toContain('Profile photo must be a JPG, PNG, or WebP image.');
    expect(errors).toContain('Profile photo must be 2 MB or smaller.');
  });
});

describe('validateCreateLobbyDraft', () => {
  it('accepts a valid lobby draft', () => {
    const errors = validateCreateLobbyDraft(
      {
        title: 'Thursday Night',
        address: '123 Gordon St',
        city: 'Tel Aviv',
        date: '2099-06-01',
        time: '20:30',
        numTeams: 2,
        playersPerTeam: 5,
        minRating: 4.5,
        price: 30,
        description: 'Friendly game',
      },
      new Date('2099-05-01T00:00:00.000Z'),
    );

    expect(errors).toEqual([]);
  });

  it('accepts a locality-style address returned by place autocomplete', () => {
    const errors = validateCreateLobbyDraft(
      {
        title: 'Thursday Night',
        address: 'Shoham',
        city: 'Shoham',
        date: '2099-06-01',
        time: '20:30',
        numTeams: 2,
        playersPerTeam: 5,
      },
      new Date('2099-05-01T00:00:00.000Z'),
    );

    expect(errors).toEqual([]);
  });

  it('rejects invalid lobby draft data', () => {
    const errors = validateCreateLobbyDraft(
      {
        title: 'Hi',
        address: '123',
        city: 'T',
        date: '2020-01-01',
        time: '10:00',
        numTeams: 1,
        playersPerTeam: 2,
        minRating: 11,
        price: -1,
        description: 'x'.repeat(501),
      },
      new Date('2021-01-01T00:00:00.000Z'),
    );

    expect(errors).toContain('Game name must be between 3 and 80 characters.');
    expect(errors).toContain('Address must be between 2 and 160 characters.');
    expect(errors).toContain('City must be between 2 and 60 characters.');
    expect(errors).toContain('Game time must be in the future.');
    expect(errors).toContain('Number of teams must be between 2 and 4.');
    expect(errors).toContain('Players per team must be between 3 and 11.');
    expect(errors).toContain('Total max players must be between 6 and 44.');
    expect(errors).toContain('Minimum rating must be between 1 and 10.');
    expect(errors).toContain('Price must be between 0 and 999.');
    expect(errors).toContain('Description must be 500 characters or fewer.');
  });
});

describe('getJoinLobbyError', () => {
  it('blocks duplicate membership', () => {
    const player = makePlayer();
    const lobby = makeLobby({ players: [player] });

    expect(getJoinLobbyError(lobby, player)).toBe('You are already in this game.');
  });

  it('blocks low-rated players', () => {
    const player = makePlayer({ rating: 3.5 });
    const lobby = makeLobby({ minRating: 4 });

    expect(getJoinLobbyError(lobby, player)).toBe('This game requires a minimum rating of 4.0.');
  });

  it('allows waitlist promotion when requested', () => {
    const player = makePlayer();
    const lobby = makeLobby({ waitlist: [player] });

    expect(getJoinLobbyError(lobby, player, { allowExistingWaitlist: true })).toBeNull();
  });
});
