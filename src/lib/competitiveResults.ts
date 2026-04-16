import type { TeamColor } from '../types';

export type CompetitiveResultInputTeam = {
  teamId: string;
  color: TeamColor;
  teamNumber: number;
  wins: number;
};

export type CompetitiveStanding = {
  teamId: string;
  color: TeamColor;
  teamNumber: number;
  wins: number;
  rank: number;
  awardedPoints: number;
};

function basePointsForTeamCount(teamCount: number) {
  if (teamCount < 2 || teamCount > 4) {
    throw new Error('Competitive results currently support 2 to 4 teams.');
  }

  return Array.from({ length: teamCount }, (_, index) => (teamCount - index) * 10);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

export function calculateCompetitiveStandings(teams: CompetitiveResultInputTeam[]): CompetitiveStanding[] {
  if (teams.length < 2 || teams.length > 4) {
    throw new Error('Competitive results currently support 2 to 4 teams.');
  }

  const invalidTeam = teams.find((team) => !Number.isInteger(team.wins) || team.wins < 0);
  if (invalidTeam) {
    throw new Error('Each team must have a valid number of wins.');
  }

  const basePoints = basePointsForTeamCount(teams.length);
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
    const pointsSlice = basePoints.slice(start, end + 1);
    const sharedRank = average(positions);
    const sharedPoints = average(pointsSlice);

    for (let current = start; current <= end; current += 1) {
      const team = orderedTeams[current];
      standings.set(team.teamId, {
        teamId: team.teamId,
        color: team.color,
        teamNumber: team.teamNumber,
        wins: team.wins,
        rank: sharedRank,
        awardedPoints: sharedPoints,
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
