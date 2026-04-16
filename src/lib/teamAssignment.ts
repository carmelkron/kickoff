import type { Language, LobbyTeamAssignment, Player, TeamColor } from '../types';

type PositionKey = 'goalkeeper' | 'defense' | 'midfield' | 'attack';

type TeamBucket = {
  color: TeamColor;
  teamNumber: number;
  players: Player[];
};

const TEAM_COLORS: TeamColor[] = ['blue', 'yellow', 'red', 'green'];
const POSITION_ORDER: PositionKey[] = ['goalkeeper', 'defense', 'midfield', 'attack'];

const POSITION_ALIASES: Record<PositionKey, string[]> = {
  goalkeeper: ['goalkeeper', 'keeper', 'שוער'],
  defense: ['defense', 'defender', 'הגנה', 'בלם'],
  midfield: ['midfield', 'midfielder', 'קישור'],
  attack: ['attack', 'attacker', 'forward', 'striker', 'winger', 'התקפה', 'חלוץ', 'אגף'],
};

export function normalizePreferredPosition(value: string | null | undefined): PositionKey | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const [position, aliases] of Object.entries(POSITION_ALIASES) as Array<[PositionKey, string[]]>) {
    if (aliases.includes(normalized)) {
      return position;
    }
  }

  return null;
}

export function getPreferredPositionLabel(position: string | null | undefined, lang: Language) {
  const normalized = normalizePreferredPosition(position);

  if (normalized === 'goalkeeper') {
    return lang === 'he' ? 'שוער' : 'Goalkeeper';
  }

  if (normalized === 'defense') {
    return lang === 'he' ? 'הגנה' : 'Defense';
  }

  if (normalized === 'midfield') {
    return lang === 'he' ? 'קישור' : 'Midfield';
  }

  if (normalized === 'attack') {
    return lang === 'he' ? 'התקפה' : 'Attack';
  }

  return position ?? '';
}

export function getTeamColorLabel(color: TeamColor, lang: Language) {
  if (color === 'blue') {
    return lang === 'he' ? 'כחולה' : 'Blue';
  }

  if (color === 'yellow') {
    return lang === 'he' ? 'צהובה' : 'Yellow';
  }

  if (color === 'red') {
    return lang === 'he' ? 'אדומה' : 'Red';
  }

  return lang === 'he' ? 'ירוקה' : 'Green';
}

function teamRating(team: TeamBucket) {
  return team.players.reduce((total, player) => total + player.rating, 0);
}

function teamPositionCount(team: TeamBucket, position: PositionKey) {
  return team.players.filter((player) => normalizePreferredPosition(player.position) === position).length;
}

function scoreTeamForPlayer(team: TeamBucket, player: Player, playersPerTeam: number) {
  if (team.players.length >= playersPerTeam) {
    return Number.POSITIVE_INFINITY;
  }

  const position = normalizePreferredPosition(player.position);
  const samePositionCount = position ? teamPositionCount(team, position) : 0;
  const currentRating = teamRating(team);
  const goalkeeperPenalty =
    position === 'goalkeeper' && teamPositionCount(team, 'goalkeeper') > 0 ? 1000 : 0;

  return goalkeeperPenalty + samePositionCount * 100 + currentRating * 10 + team.players.length * 5 + team.teamNumber;
}

function bucketObjective(teams: TeamBucket[]) {
  const ratingTotals = teams.map(teamRating);
  const averageRating = ratingTotals.reduce((sum, value) => sum + value, 0) / Math.max(1, teams.length);
  const positionAverages = Object.fromEntries(
    POSITION_ORDER.map((position) => [
      position,
      teams.reduce((sum, team) => sum + teamPositionCount(team, position), 0) / Math.max(1, teams.length),
    ]),
  ) as Record<PositionKey, number>;

  return teams.reduce((score, team) => {
    const ratingPenalty = Math.abs(teamRating(team) - averageRating) * 4;
    const goalkeeperPenalty =
      positionAverages.goalkeeper >= 1 && teamPositionCount(team, 'goalkeeper') === 0 ? 120 : 0;
    const defensePenalty = Math.abs(teamPositionCount(team, 'defense') - positionAverages.defense) * 18;
    const midfieldPenalty = Math.abs(teamPositionCount(team, 'midfield') - positionAverages.midfield) * 10;
    const attackPenalty = Math.abs(teamPositionCount(team, 'attack') - positionAverages.attack) * 10;

    return score + ratingPenalty + goalkeeperPenalty + defensePenalty + midfieldPenalty + attackPenalty;
  }, 0);
}

function tryImproveBuckets(teams: TeamBucket[]) {
  let improved = true;
  let guard = 0;

  while (improved && guard < 20) {
    improved = false;
    guard += 1;
    const baselineScore = bucketObjective(teams);

    for (let teamIndex = 0; teamIndex < teams.length; teamIndex += 1) {
      for (let otherTeamIndex = teamIndex + 1; otherTeamIndex < teams.length; otherTeamIndex += 1) {
        const team = teams[teamIndex];
        const otherTeam = teams[otherTeamIndex];

        for (let playerIndex = 0; playerIndex < team.players.length; playerIndex += 1) {
          for (let otherPlayerIndex = 0; otherPlayerIndex < otherTeam.players.length; otherPlayerIndex += 1) {
            const nextTeams = teams.map((currentTeam) => ({
              ...currentTeam,
              players: [...currentTeam.players],
            }));

            const firstPlayer = nextTeams[teamIndex].players[playerIndex];
            const secondPlayer = nextTeams[otherTeamIndex].players[otherPlayerIndex];

            nextTeams[teamIndex].players[playerIndex] = secondPlayer;
            nextTeams[otherTeamIndex].players[otherPlayerIndex] = firstPlayer;

            if (bucketObjective(nextTeams) + 0.5 < baselineScore) {
              teams[teamIndex].players[playerIndex] = secondPlayer;
              teams[otherTeamIndex].players[otherPlayerIndex] = firstPlayer;
              improved = true;
              break;
            }
          }

          if (improved) {
            break;
          }
        }

        if (improved) {
          break;
        }
      }

      if (improved) {
        break;
      }
    }
  }
}

export function buildBalancedLobbyTeams(
  players: Player[],
  numTeams: number,
  playersPerTeam: number,
): Array<Omit<LobbyTeamAssignment, 'team'> & { color: TeamColor; teamNumber: number }> {
  if (players.length !== numTeams * playersPerTeam) {
    throw new Error('Cannot build teams until the roster is full.');
  }

  const unsupportedPlayers = players.filter((player) => !normalizePreferredPosition(player.position));
  if (unsupportedPlayers.length > 0) {
    throw new Error(`Every player must choose a preferred position before building teams. Missing: ${unsupportedPlayers.map((player) => player.name).join(', ')}`);
  }

  const teams: TeamBucket[] = TEAM_COLORS.slice(0, numTeams).map((color, index) => ({
    color,
    teamNumber: index + 1,
    players: [],
  }));

  for (const position of POSITION_ORDER) {
    const playersForPosition = players
      .filter((player) => normalizePreferredPosition(player.position) === position)
      .sort((left, right) => right.rating - left.rating);

    for (const player of playersForPosition) {
      const selectedTeam = [...teams].sort((left, right) =>
        scoreTeamForPlayer(left, player, playersPerTeam) - scoreTeamForPlayer(right, player, playersPerTeam))[0];
      selectedTeam.players.push(player);
    }
  }

  tryImproveBuckets(teams);

  return teams
    .map((team) => ({
      color: team.color,
      teamNumber: team.teamNumber,
      players: [...team.players].sort((left, right) => right.rating - left.rating),
    }))
    .sort((left, right) => left.teamNumber - right.teamNumber);
}
