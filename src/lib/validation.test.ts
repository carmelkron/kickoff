import { describe, expect, it } from 'vitest';
import type { Lobby, Player } from '../types';
import {
  buildLobbyDateTime,
  getJoinLobbyError,
  getJoinLobbyTargetStatus,
  isValidEmail,
  normalizeText,
  sanitizeProfileSkills,
  validateCreateLobbyDraft,
  validateCreateLobbyPayload,
  validateProfileSkills,
  validateRegisterDraft,
} from './validation';

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
    organizerIds: [],
    distanceKm: 1,
    waitlist: [],
    gameType: 'competitive',
    accessType: 'open',
    genderRestriction: 'none',
    status: 'active',
    viewerHasAccess: true,
    viewerIsInvited: false,
    viewerHasFriendInside: false,
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
      position: 'Midfield',
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
      position: '',
      bio: 'x'.repeat(281),
      photoFile: { type: 'image/gif', size: 3 * 1024 * 1024 } as File,
    });

    expect(errors).toContain('Name must be between 2 and 80 characters.');
    expect(errors).toContain('Enter a valid email address.');
    expect(errors).toContain('Password must be between 6 and 72 characters.');
    expect(errors).toContain('Passwords do not match.');
    expect(errors).toContain('Choose your preferred position.');
    expect(errors).toContain('Bio must be 280 characters or fewer.');
    expect(errors).toContain('Profile photo must be a JPG, PNG, or WebP image.');
    expect(errors).toContain('Profile photo must be 2 MB or smaller.');
  });
});

describe('profile skills helpers', () => {
  it('normalizes free text and validates email addresses', () => {
    expect(normalizeText('  Jane   Doe  ')).toBe('Jane Doe');
    expect(isValidEmail('jane@example.com')).toBe(true);
    expect(isValidEmail('jane.example.com')).toBe(false);
  });

  it('sanitizes and deduplicates skills', () => {
    expect(sanitizeProfileSkills(['  Finishing ', 'finishing', '', '1v1 defending'])).toEqual([
      'Finishing',
      '1v1 defending',
    ]);
  });

  it('rejects too many or invalid skills', () => {
    expect(validateProfileSkills(['A'])).toContain('Each skill must be between 2 and 32 characters.');
    expect(validateProfileSkills(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'])).toContain('Choose up to 8 skills.');
  });
});

describe('validateCreateLobbyDraft', () => {
  it('builds a valid lobby date-time and rejects invalid values', () => {
    expect(buildLobbyDateTime('2099-06-01', '20:30')?.toISOString()).toContain('2099-06-01T');
    expect(buildLobbyDateTime('2099-13-01', '20:30')).toBeNull();
  });

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
        minPointsPerGame: 8.5,
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
        address: '1',
        city: 'T',
        date: '2020-01-01',
        time: '10:00',
        numTeams: 1,
        playersPerTeam: 2,
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
    expect(errors).toContain('Price must be between 0 and 999.');
    expect(errors).toContain('Description must be 500 characters or fewer.');
  });

  it('rejects invalid age ranges', () => {
    const errors = validateCreateLobbyDraft(
      {
        title: 'Thursday Night',
        address: '123 Gordon St',
        city: 'Tel Aviv',
        date: '2099-06-01',
        time: '20:30',
        numTeams: 2,
        playersPerTeam: 5,
        minAge: 30,
        maxAge: 20,
      },
      new Date('2099-05-01T00:00:00.000Z'),
    );

    expect(errors).toContain('Minimum age cannot be greater than maximum age.');
  });

  it('rejects invalid minimum points per game thresholds', () => {
    const errors = validateCreateLobbyDraft(
      {
        title: 'Thursday Night',
        address: '123 Gordon St',
        city: 'Tel Aviv',
        date: '2099-06-01',
        time: '20:30',
        numTeams: 2,
        playersPerTeam: 5,
        minPointsPerGame: 120,
      },
      new Date('2099-05-01T00:00:00.000Z'),
    );

    expect(errors).toContain('Minimum points per game must be between 0 and 99.99.');
  });

  it('rejects malformed payload values on the payload validator too', () => {
    const errors = validateCreateLobbyPayload(
      {
        title: 'Hi',
        address: '1',
        city: 'T',
        datetime: 'not-a-date',
        numTeams: 5,
        playersPerTeam: 20,
        minAge: 5,
        maxAge: 100,
        minPointsPerGame: Number.POSITIVE_INFINITY,
        price: 1000,
        description: 'x'.repeat(501),
      },
      new Date('2026-04-23T00:00:00.000Z'),
    );

    expect(errors).toContain('Choose a valid date and time.');
    expect(errors).toContain('Number of teams must be between 2 and 4.');
    expect(errors).toContain('Players per team must be between 3 and 11.');
    expect(errors).toContain('Total max players must be between 6 and 44.');
    expect(errors).toContain('Minimum age must be between 6 and 99.');
    expect(errors).toContain('Maximum age must be between 6 and 99.');
    expect(errors).toContain('Minimum points per game must be between 0 and 99.99.');
    expect(errors).toContain('Price must be between 0 and 999.');
    expect(errors).toContain('Description must be 500 characters or fewer.');
  });
});

describe('getJoinLobbyError', () => {
  it('requires login before joining', () => {
    expect(getJoinLobbyError(makeLobby(), null)).toBe('Please log in to join this game.');
  });

  it('blocks duplicate membership', () => {
    const player = makePlayer();
    const lobby = makeLobby({ players: [player] });

    expect(getJoinLobbyError(lobby, player)).toBe('You are already in this game.');
  });

  it('blocks duplicate waitlist membership by default', () => {
    const player = makePlayer();
    const lobby = makeLobby({ waitlist: [player] });

    expect(getJoinLobbyError(lobby, player)).toBe('You are already on the waitlist.');
  });

  it('allows waitlist promotion when requested', () => {
    const player = makePlayer();
    const lobby = makeLobby({ waitlist: [player] });

    expect(getJoinLobbyError(lobby, player, { allowExistingWaitlist: true })).toBeNull();
  });

  it('blocks joining an age-restricted lobby without a birth date', () => {
    const player = makePlayer();
    const lobby = makeLobby({ minAge: 18, maxAge: 35 });

    expect(getJoinLobbyError(lobby, player)).toBe('Add your birth date in your profile to join this age-restricted lobby.');
  });

  it('blocks players outside the age range on game day', () => {
    const player = makePlayer({ birthdate: '2085-06-02' });
    const lobby = makeLobby({ minAge: 18 });

    expect(getJoinLobbyError(lobby, player)).toBe('This lobby is for players aged 18 and up.');
  });

  it('blocks players above the maximum age or with invalid birthdates', () => {
    const tooOldPlayer = makePlayer({ birthdate: '1980-01-01' });
    const invalidBirthdatePlayer = makePlayer({ birthdate: 'not-a-date' });
    const lobby = makeLobby({ maxAge: 35, datetime: '2026-04-23T18:00:00.000Z' });

    expect(getJoinLobbyError(lobby, tooOldPlayer)).toBe('This lobby is for players up to age 35.');
    expect(getJoinLobbyError(lobby, invalidBirthdatePlayer)).toBe('Add a valid birth date in your profile to join this age-restricted lobby.');
  });

  it('blocks players below the required competitive points per game threshold', () => {
    const player = makePlayer({ competitivePoints: 36, competitiveGamesPlayed: 6, competitivePointsPerGame: 6 });
    const lobby = makeLobby({ minPointsPerGame: 7.5 });

    expect(getJoinLobbyError(lobby, player)).toBe('This lobby requires at least 7.5 competitive points per game.');
  });

  it('allows eligible players to join', () => {
    const player = makePlayer({
      birthdate: '2000-04-23',
      competitivePoints: 50,
      competitiveGamesPlayed: 5,
      competitivePointsPerGame: 10,
    });
    const lobby = makeLobby({
      minAge: 18,
      maxAge: 35,
      minPointsPerGame: 7.5,
      datetime: '2026-04-23T18:00:00.000Z',
    });

    expect(getJoinLobbyError(lobby, player)).toBeNull();
  });
});

describe('getJoinLobbyTargetStatus', () => {
  it('joins immediately when there is room', () => {
    expect(getJoinLobbyTargetStatus(makeLobby({ maxPlayers: 10, players: [makePlayer()] }))).toBe('joined');
  });

  it('waitlists when the lobby is already full', () => {
    const players = Array.from({ length: 2 }, (_, index) => makePlayer({ id: `p-${index}` }));
    expect(getJoinLobbyTargetStatus(makeLobby({ maxPlayers: 2, players }))).toBe('waitlisted');
  });
});
