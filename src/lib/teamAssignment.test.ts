import { describe, expect, it } from 'vitest';
import {
  buildBalancedLobbyTeams,
  getPreferredPositionLabel,
  getTeamColorLabel,
  normalizePreferredPosition,
} from './teamAssignment';
import type { Player } from '../types';

function makePlayer(
  id: string,
  position: string,
  competitivePoints: number,
  overrides: Partial<Player> = {},
): Player {
  return {
    id,
    name: `Player ${id}`,
    initials: 'PL',
    avatarColor: 'bg-blue-500',
    rating: 5,
    competitivePoints,
    gamesPlayed: 10,
    position,
    ratingHistory: [],
    lobbyHistory: [],
    ...overrides,
  };
}

describe('normalizePreferredPosition', () => {
  it('normalizes English and Hebrew aliases to canonical positions', () => {
    expect(normalizePreferredPosition('keeper')).toBe('goalkeeper');
    expect(normalizePreferredPosition('בלם')).toBe('defense');
    expect(normalizePreferredPosition('Midfielder')).toBe('midfield');
    expect(normalizePreferredPosition('חלוץ')).toBe('attack');
  });

  it('returns null for missing or unsupported values', () => {
    expect(normalizePreferredPosition('')).toBeNull();
    expect(normalizePreferredPosition('coach')).toBeNull();
    expect(normalizePreferredPosition(undefined)).toBeNull();
  });
});

describe('position and color labels', () => {
  it('returns localized position labels for known aliases', () => {
    expect(getPreferredPositionLabel('winger', 'en')).toBe('Attack');
    expect(getPreferredPositionLabel('שוער', 'he')).toBe('שוער');
  });

  it('falls back to the original position when it is unknown', () => {
    expect(getPreferredPositionLabel('Sweeper', 'en')).toBe('Sweeper');
    expect(getPreferredPositionLabel(undefined, 'en')).toBe('');
  });

  it('returns localized team color labels', () => {
    expect(getTeamColorLabel('blue', 'en')).toBe('Blue');
    expect(getTeamColorLabel('green', 'he')).toBe('ירוקה');
  });
});

describe('buildBalancedLobbyTeams', () => {
  it('requires a full roster before building teams', () => {
    expect(() => buildBalancedLobbyTeams([
      makePlayer('1', 'Goalkeeper', 12),
      makePlayer('2', 'Defense', 10),
      makePlayer('3', 'Attack', 9),
    ], 2, 2)).toThrow('Cannot build teams until the roster is full.');
  });

  it('requires every player to choose a supported position', () => {
    expect(() => buildBalancedLobbyTeams([
      makePlayer('1', 'Goalkeeper', 12),
      makePlayer('2', 'Defense', 10),
      makePlayer('3', 'Coach', 9, { name: 'Missing Position' }),
      makePlayer('4', 'Attack', 8),
    ], 2, 2)).toThrow('Every player must choose a preferred position before building teams. Missing: Missing Position');
  });

  it('builds sorted balanced teams and spreads goalkeepers across squads', () => {
    const players = [
      makePlayer('gk-1', 'Goalkeeper', 18, { name: 'Goalkeeper One' }),
      makePlayer('gk-2', 'שוער', 16, { name: 'Goalkeeper Two' }),
      makePlayer('def-1', 'Defense', 15),
      makePlayer('def-2', 'בלם', 14),
      makePlayer('mid-1', 'Midfield', 13),
      makePlayer('mid-2', 'קישור', 12),
      makePlayer('att-1', 'Attack', 11),
      makePlayer('att-2', 'חלוץ', 10),
    ];

    const teams = buildBalancedLobbyTeams(players, 2, 4);

    expect(teams).toHaveLength(2);
    expect(teams[0].teamNumber).toBe(1);
    expect(teams[0].color).toBe('blue');
    expect(teams[1].teamNumber).toBe(2);
    expect(teams[1].color).toBe('yellow');

    for (const team of teams) {
      expect(team.players).toHaveLength(4);
      expect(team.players).toEqual(
        [...team.players].sort((left, right) => (right.competitivePoints ?? 0) - (left.competitivePoints ?? 0)),
      );
      expect(
        team.players.filter((player) => normalizePreferredPosition(player.position) === 'goalkeeper'),
      ).toHaveLength(1);
    }

    const teamTotals = teams.map((team) =>
      team.players.reduce((total, player) => total + (player.competitivePoints ?? 0), 0),
    );
    expect(Math.abs(teamTotals[0] - teamTotals[1])).toBeLessThanOrEqual(2);
  });
});
