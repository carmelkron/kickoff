import type { TeamColor } from '../types';

export type CompetitiveTierKey = 'starter' | 'contender' | 'elite' | 'master';

export type CompetitiveResultInputPlayer = {
  profileId: string;
  competitivePoints?: number;
};

export type CompetitiveResultInputTeam = {
  teamId: string;
  color: TeamColor;
  teamNumber: number;
  wins: number;
  players: CompetitiveResultInputPlayer[];
};

export type CompetitivePlayerAward = {
  profileId: string;
  startingCompetitivePoints: number;
  tier: CompetitiveTierKey;
  awardedPoints: number;
};

export type CompetitiveStanding = {
  teamId: string;
  color: TeamColor;
  teamNumber: number;
  wins: number;
  rank: number;
  awardedPoints: number;
  awardedPointsMax: number;
  playerAwards: CompetitivePlayerAward[];
};

type CompetitiveTierConfig = {
  id: CompetitiveTierKey;
  minPoints: number;
  pointsOffset: number;
};

const COMPETITIVE_TIERS: CompetitiveTierConfig[] = [
  { id: 'starter', minPoints: 0, pointsOffset: 0 },
  { id: 'contender', minPoints: 150, pointsOffset: 5 },
  { id: 'elite', minPoints: 300, pointsOffset: 10 },
  { id: 'master', minPoints: 500, pointsOffset: 15 },
];

function basePointsForTeamCount(teamCount: number, pointsOffset = 0) {
  if (teamCount < 2 || teamCount > 4) {
    throw new Error('Competitive results currently support 2 to 4 teams.');
  }

  return Array.from({ length: teamCount }, (_, index) => (teamCount - index) * 10 - pointsOffset);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

export function resolveCompetitiveTier(competitivePoints: number): CompetitiveTierKey {
  const safePoints = Number.isFinite(competitivePoints) ? Math.max(0, competitivePoints) : 0;

  for (let index = COMPETITIVE_TIERS.length - 1; index >= 0; index -= 1) {
    const tier = COMPETITIVE_TIERS[index];
    if (safePoints >= tier.minPoints) {
      return tier.id;
    }
  }

  return 'starter';
}

function getTierConfig(tierId: CompetitiveTierKey) {
  const tier = COMPETITIVE_TIERS.find((candidate) => candidate.id === tierId);
  if (!tier) {
    throw new Error('Unknown competitive tier.');
  }

  return tier;
}

function getPlacementPoints(teamCount: number, tierId: CompetitiveTierKey, start: number, end: number) {
  const tier = getTierConfig(tierId);
  const points = basePointsForTeamCount(teamCount, tier.pointsOffset).slice(start, end + 1);
  return average(points);
}

export function calculateCompetitiveStandings(teams: CompetitiveResultInputTeam[]): CompetitiveStanding[] {
  if (teams.length < 2 || teams.length > 4) {
    throw new Error('Competitive results currently support 2 to 4 teams.');
  }

  const invalidTeam = teams.find((team) => !Number.isInteger(team.wins) || team.wins < 0);
  if (invalidTeam) {
    throw new Error('Each team must have a valid number of wins.');
  }

  const orderedTeams = [...teams].sort((left, right) => right.wins - left.wins || left.teamNumber - right.teamNumber);
  const standings = new Map<string, CompetitiveStanding>();

  let index = 0;
  while (index < orderedTeams.length) {
    const start = index;
    const wins = orderedTeams[index].wins;
    while (index + 1 < orderedTeams.length && orderedTeams[index + 1].wins === wins) {
      index += 1;
    }

    const end = index;
    const positions = Array.from({ length: end - start + 1 }, (_, offset) => start + offset + 1);
    const sharedRank = average(positions);

    for (let current = start; current <= end; current += 1) {
      const team = orderedTeams[current];
      const playerAwards = team.players.map((player) => {
        const startingCompetitivePoints = Math.max(0, player.competitivePoints ?? 0);
        const tier = resolveCompetitiveTier(startingCompetitivePoints);
        return {
          profileId: player.profileId,
          startingCompetitivePoints,
          tier,
          awardedPoints: getPlacementPoints(teams.length, tier, start, end),
        };
      });
      const fallbackAwardedPoints = getPlacementPoints(teams.length, 'starter', start, end);
      const awardedPointsValues = playerAwards.map((award) => award.awardedPoints);
      const awardedPoints = awardedPointsValues.length > 0 ? Math.min(...awardedPointsValues) : fallbackAwardedPoints;
      const awardedPointsMax = awardedPointsValues.length > 0 ? Math.max(...awardedPointsValues) : fallbackAwardedPoints;

      standings.set(team.teamId, {
        teamId: team.teamId,
        color: team.color,
        teamNumber: team.teamNumber,
        wins: team.wins,
        rank: sharedRank,
        awardedPoints,
        awardedPointsMax,
        playerAwards,
      });
    }

    index += 1;
  }

  return teams.map((team) => {
    const standing = standings.get(team.teamId);
    if (!standing) {
      throw new Error('Failed to calculate the standings.');
    }
    return standing;
  });
}
