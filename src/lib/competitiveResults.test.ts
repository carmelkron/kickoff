import { describe, expect, it } from 'vitest';
import { calculateCompetitiveStandings, resolveCompetitiveTier } from './competitiveResults';

describe('competitiveResults', () => {
  it('moves players through tiers based on their current competitive points', () => {
    expect(resolveCompetitiveTier(0)).toBe('starter');
    expect(resolveCompetitiveTier(149)).toBe('starter');
    expect(resolveCompetitiveTier(150)).toBe('contender');
    expect(resolveCompetitiveTier(300)).toBe('elite');
    expect(resolveCompetitiveTier(500)).toBe('master');
  });

  it('awards points per player tier even when teammates are in different tiers', () => {
    const standings = calculateCompetitiveStandings([
      {
        teamId: 'blue',
        color: 'blue',
        teamNumber: 1,
        wins: 3,
        players: [
          { profileId: 'starter-winner', competitivePoints: 40 },
          { profileId: 'master-winner', competitivePoints: 620 },
        ],
      },
      {
        teamId: 'red',
        color: 'red',
        teamNumber: 2,
        wins: 1,
        players: [
          { profileId: 'starter-loser', competitivePoints: 40 },
          { profileId: 'master-loser', competitivePoints: 620 },
        ],
      },
    ]);

    expect(standings[0].awardedPoints).toBe(5);
    expect(standings[0].awardedPointsMax).toBe(20);
    expect(standings[0].playerAwards).toEqual([
      {
        profileId: 'starter-winner',
        startingCompetitivePoints: 40,
        tier: 'starter',
        awardedPoints: 20,
      },
      {
        profileId: 'master-winner',
        startingCompetitivePoints: 620,
        tier: 'master',
        awardedPoints: 5,
      },
    ]);

    expect(standings[1].awardedPoints).toBe(-5);
    expect(standings[1].awardedPointsMax).toBe(10);
    expect(standings[1].playerAwards).toEqual([
      {
        profileId: 'starter-loser',
        startingCompetitivePoints: 40,
        tier: 'starter',
        awardedPoints: 10,
      },
      {
        profileId: 'master-loser',
        startingCompetitivePoints: 620,
        tier: 'master',
        awardedPoints: -5,
      },
    ]);
  });

  it('keeps tied placements on valid 5-point increments for every tier', () => {
    const standings = calculateCompetitiveStandings([
      {
        teamId: 'blue',
        color: 'blue',
        teamNumber: 1,
        wins: 2,
        players: [{ profileId: 'blue-player', competitivePoints: 520 }],
      },
      {
        teamId: 'yellow',
        color: 'yellow',
        teamNumber: 2,
        wins: 1,
        players: [{ profileId: 'yellow-player', competitivePoints: 520 }],
      },
      {
        teamId: 'red',
        color: 'red',
        teamNumber: 3,
        wins: 0,
        players: [{ profileId: 'red-player', competitivePoints: 520 }],
      },
      {
        teamId: 'green',
        color: 'green',
        teamNumber: 4,
        wins: 0,
        players: [{ profileId: 'green-player', competitivePoints: 520 }],
      },
    ]);

    expect(standings[2].rank).toBe(3.5);
    expect(standings[2].playerAwards[0].awardedPoints).toBe(0);
    expect(standings[3].rank).toBe(3.5);
    expect(standings[3].playerAwards[0].awardedPoints).toBe(0);
  });
});
