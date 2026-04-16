import type { Lobby, Player, RatingEntry, LobbyHistoryEntry, GameType, FieldType, GenderRestriction, Gender, ContributionType, LobbyStatus, LobbyTeam, LobbyTeamAssignment, LobbyResultSummary, LobbyTeamStanding, TeamColor, CompetitivePointHistoryEntry, LobbyAccessType, LobbyInvite, LobbyInviteStatus } from '../types';
import { createCompetitiveResultNotifications, createFriendJoinedLobbyNotifications, createLobbyInviteNotification, createOrganizerSummaryNotification, createTeamAssignedNotifications, fetchAcceptedFriendIds } from './appNotifications';
import { requireSupabase } from './supabase';
import { getJoinLobbyError, normalizeText, validateCreateLobbyPayload } from './validation';
import { calculateCompetitiveStandings } from './competitiveResults';
import { buildBalancedLobbyTeams } from './teamAssignment';

const LOBBY_SELECT_FIELDS = 'id, title, address, city, datetime, max_players, num_teams, players_per_team, min_rating, is_private, price, description, created_by, distance_km, game_type, access_type, field_type, gender_restriction, latitude, longitude';
const LOBBY_SELECT_FIELDS_WITH_STATUS = `${LOBBY_SELECT_FIELDS}, status`;

function toAppError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error;
  }

  if (error && typeof error === 'object') {
    const maybeMessage = 'message' in error && typeof error.message === 'string' ? error.message : '';
    const maybeDetails = 'details' in error && typeof error.details === 'string' ? error.details : '';
    const maybeHint = 'hint' in error && typeof error.hint === 'string' ? error.hint : '';
    const parts = [maybeMessage, maybeDetails, maybeHint].filter(Boolean);
    if (parts.length > 0) {
      return new Error(parts.join(' '));
    }
  }

  return new Error(fallbackMessage);
}

function getErrorText(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const maybeMessage = 'message' in error && typeof error.message === 'string' ? error.message : '';
    const maybeDetails = 'details' in error && typeof error.details === 'string' ? error.details : '';
    const maybeHint = 'hint' in error && typeof error.hint === 'string' ? error.hint : '';
    return [maybeMessage, maybeDetails, maybeHint].filter(Boolean).join(' ');
  }

  return '';
}

function isMissingLobbyOptionalColumnError(error: unknown) {
  const text = getErrorText(error).toLowerCase();
  return (text.includes('status') || text.includes('access_type')) && (
    text.includes('column')
    || text.includes('schema cache')
    || text.includes('could not find')
  );
}

type ProfileRow = {
  id: string;
  email: string | null;
  name: string;
  initials: string;
  avatar_color: string;
  rating: number;
  games_played: number;
  competitive_points?: number;
  position: string | null;
  bio: string | null;
  photo_url: string | null;
  gender: Gender | null;
  rating_history: RatingEntry[];
  lobby_history: LobbyHistoryEntry[];
};

type LobbyRow = {
  id: string;
  title: string;
  address: string;
  city: string;
  datetime: string;
  max_players: number;
  num_teams: number | null;
  players_per_team: number | null;
  min_rating: number | null;
  is_private: boolean;
  price: number | null;
  description: string | null;
  created_by: string;
  distance_km: number;
  game_type: GameType;
  access_type?: LobbyAccessType | null;
  field_type: FieldType | null;
  gender_restriction: GenderRestriction;
  latitude: number | null;
  longitude: number | null;
  status?: 'active' | 'deleted' | 'expired' | null;
};

type MembershipRow = {
  lobby_id: string;
  profile_id: string;
  status: 'joined' | 'waitlisted' | 'pending_confirm' | 'left';
  created_at?: string;
};

type LobbyTeamRow = {
  id: string;
  lobby_id: string;
  color: TeamColor;
  team_number: number;
  locked_at: string | null;
};

type LobbyTeamMemberRow = {
  lobby_id: string;
  lobby_team_id: string;
  profile_id: string;
};

type LobbyResultRow = {
  lobby_id: string;
  submitted_by_profile_id: string;
  submitted_at: string;
  notes: string | null;
};

type LobbyTeamResultRow = {
  lobby_id: string;
  lobby_team_id: string;
  wins: number;
  rank: number;
  awarded_points: number;
};

type CompetitivePointEventRow = {
  id: string;
  lobby_id: string;
  profile_id: string;
  awarded_by_profile_id: string;
  team_color: TeamColor;
  team_number: number;
  wins: number;
  rank: number;
  points: number;
  created_at: string;
};

type LobbyInviteRow = {
  id: string;
  lobby_id: string;
  invited_profile_id: string;
  invited_by_profile_id: string;
  status: LobbyInviteStatus;
  created_at: string;
};

function resolveLobbyStatus(row: LobbyRow): LobbyStatus {
  if (row.status === 'deleted') {
    return 'deleted';
  }

  if (row.status === 'expired') {
    return 'expired';
  }

  return new Date(row.datetime) > new Date() ? 'active' : 'expired';
}

async function fetchCurrentProfileId() {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }

  return data.user?.id ?? null;
}

function canAccessLockedLobby(options: {
  lobby: LobbyRow;
  currentProfileId: string | null;
  joinedProfileIds: string[];
  waitlistedProfileIds: string[];
  invitedStatuses: Map<string, LobbyInviteStatus>;
  friendIds: Set<string>;
}) {
  const { lobby, currentProfileId, joinedProfileIds, waitlistedProfileIds, invitedStatuses, friendIds } = options;
  const accessType = lobby.access_type ?? 'open';
  const isInvited = currentProfileId ? ((invitedStatuses.get(lobby.id) ?? null) !== null && invitedStatuses.get(lobby.id) !== 'revoked') : false;
  const hasFriendInside = joinedProfileIds.some((profileId) => friendIds.has(profileId));
  const isParticipant = currentProfileId ? (joinedProfileIds.includes(currentProfileId) || waitlistedProfileIds.includes(currentProfileId)) : false;
  const canAccess = accessType === 'open'
    || lobby.created_by === currentProfileId
    || isParticipant
    || isInvited
    || hasFriendInside;

  return {
    accessType,
    isInvited,
    hasFriendInside,
    canAccess,
  };
}

async function fetchLobbyRows(): Promise<LobbyRow[]> {
  const supabase = requireSupabase();
  const withStatus = await supabase
    .from('lobbies')
    .select(LOBBY_SELECT_FIELDS_WITH_STATUS)
    .order('datetime', { ascending: true });

  if (!withStatus.error) {
    return (withStatus.data ?? []) as LobbyRow[];
  }

  if (!isMissingLobbyOptionalColumnError(withStatus.error)) {
    throw withStatus.error;
  }

  const fallback = await supabase
    .from('lobbies')
    .select(LOBBY_SELECT_FIELDS)
    .order('datetime', { ascending: true });

  if (fallback.error) {
    throw fallback.error;
  }

  return ((fallback.data ?? []) as LobbyRow[]).map((row) => ({
    ...row,
    access_type: 'open',
    status: 'active',
  }));
}

function mapProfile(row: ProfileRow): Player {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    avatarColor: row.avatar_color,
    rating: row.rating,
    gamesPlayed: row.games_played,
    position: row.position ?? undefined,
    bio: row.bio ?? undefined,
    email: row.email ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    gender: row.gender ?? undefined,
    competitivePoints: row.competitive_points ?? 0,
    ratingHistory: row.rating_history ?? [],
    lobbyHistory: row.lobby_history ?? [],
  };
}

export async function fetchProfiles(): Promise<Player[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, initials, avatar_color, rating, games_played, competitive_points, position, bio, photo_url, gender, rating_history, lobby_history')
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ProfileRow[]).map(mapProfile);
}

export async function fetchProfileById(id: string): Promise<Player | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, initials, avatar_color, rating, games_played, competitive_points, position, bio, photo_url, gender, rating_history, lobby_history')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProfile(data as ProfileRow) : null;
}

export type UpdateProfileInput = {
  profileId: string;
  name: string;
  position?: string;
  bio?: string;
  gender?: Gender;
  photoUrl?: string | null;
};

export async function updateProfile(input: UpdateProfileInput) {
  const supabase = requireSupabase();
  const parts = input.name.trim().split(' ').filter(Boolean);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : input.name.trim().slice(0, 2).toUpperCase() || '?';

  const { error } = await supabase
    .from('profiles')
    .update({
      name: input.name.trim(),
      initials,
      position: input.position ?? null,
      bio: input.bio ?? null,
      gender: input.gender ?? null,
      ...(input.photoUrl !== undefined ? { photo_url: input.photoUrl } : {}),
    })
    .eq('id', input.profileId);

  if (error) {
    throw error;
  }
}

export async function fetchLobbies(): Promise<Lobby[]> {
  const supabase = requireSupabase();
  const currentProfileId = await fetchCurrentProfileId();
  const [friendIds, inviteRows] = await Promise.all([
    currentProfileId ? fetchAcceptedFriendIds(currentProfileId) : Promise.resolve<string[]>([]),
    currentProfileId
      ? supabase
          .from('lobby_invites')
          .select('id, lobby_id, invited_profile_id, invited_by_profile_id, status, created_at')
          .eq('invited_profile_id', currentProfileId)
          .neq('status', 'revoked')
      : Promise.resolve({ data: [] as LobbyInviteRow[], error: null }),
  ]);

  const [{ data: lobbyRows, error: lobbiesError }, { data: profileRows, error: profilesError }, { data: membershipRows, error: membershipsError }] = await Promise.all([
    fetchLobbyRows().then((data) => ({ data, error: null })),
    supabase
      .from('profiles')
      .select('id, email, name, initials, avatar_color, rating, games_played, competitive_points, position, bio, photo_url, gender, rating_history, lobby_history'),
    supabase
      .from('lobby_memberships')
      .select('lobby_id, profile_id, status, created_at'),
  ]);

  if (lobbiesError) {
    throw lobbiesError;
  }
  if (profilesError) {
    throw profilesError;
  }
  if (membershipsError) {
    throw membershipsError;
  }
  if (inviteRows.error) {
    throw inviteRows.error;
  }

  const playersById = new Map<string, Player>(((profileRows ?? []) as ProfileRow[]).map((row) => [row.id, mapProfile(row)]));
  const membershipsByLobby = new Map<string, MembershipRow[]>();
  const viewerInviteStatusByLobbyId = new Map<string, LobbyInviteStatus>(
    ((inviteRows.data ?? []) as LobbyInviteRow[]).map((row) => [row.lobby_id, row.status]),
  );
  const friendIdsSet = new Set(friendIds);

  for (const membership of (membershipRows ?? []) as MembershipRow[]) {
    const list = membershipsByLobby.get(membership.lobby_id) ?? [];
    list.push(membership);
    membershipsByLobby.set(membership.lobby_id, list);
  }

  return ((lobbyRows ?? []) as LobbyRow[]).map((row) => {
    const lobbyStatus = resolveLobbyStatus(row);
    const memberships = [...(membershipsByLobby.get(row.id) ?? [])].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
    const joinedProfileIds = memberships
      .filter((membership) => membership.status === 'joined')
      .map((membership) => membership.profile_id);
    const waitlistedProfileIds = memberships
      .filter((membership) => membership.status === 'waitlisted')
      .map((membership) => membership.profile_id);
    const players = memberships
      .filter((membership) => membership.status === 'joined')
      .map((membership) => playersById.get(membership.profile_id))
      .filter((player): player is Player => Boolean(player));

    const waitlist = memberships
      .filter((membership) => membership.status === 'waitlisted')
      .map((membership) => playersById.get(membership.profile_id))
      .filter((player): player is Player => Boolean(player));
    const access = canAccessLockedLobby({
      lobby: row,
      currentProfileId,
      joinedProfileIds,
      waitlistedProfileIds,
      invitedStatuses: viewerInviteStatusByLobbyId,
      friendIds: friendIdsSet,
    });

    return {
      id: row.id,
      title: row.title,
      address: row.address,
      city: row.city,
      datetime: row.datetime,
      players,
      maxPlayers: row.max_players,
      numTeams: row.num_teams ?? undefined,
      playersPerTeam: row.players_per_team ?? undefined,
      minRating: row.min_rating ?? undefined,
      isPrivate: row.is_private,
      price: row.price ?? undefined,
      description: row.description ?? undefined,
      createdBy: row.created_by,
      distanceKm: row.distance_km,
      waitlist,
      gameType: row.game_type ?? 'friendly',
      accessType: access.accessType,
      fieldType: row.field_type ?? undefined,
      genderRestriction: row.gender_restriction ?? 'none',
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      status: lobbyStatus,
      viewerHasAccess: access.canAccess,
      viewerIsInvited: access.isInvited,
      viewerHasFriendInside: access.hasFriendInside,
    };
  }).filter((lobby) => lobby.status !== 'deleted' && lobby.viewerHasAccess);
}

export async function fetchLobbyById(id: string): Promise<Lobby | null> {
  const lobbies = await fetchLobbies();
  return lobbies.find((lobby) => lobby.id === id) ?? null;
}

export async function fetchLobbyInvites(lobbyId: string): Promise<LobbyInvite[]> {
  const supabase = requireSupabase();
  const { data: inviteRows, error: inviteError } = await supabase
    .from('lobby_invites')
    .select('id, lobby_id, invited_profile_id, invited_by_profile_id, status, created_at')
    .eq('lobby_id', lobbyId)
    .neq('status', 'revoked')
    .order('created_at', { ascending: false });

  if (inviteError) {
    throw inviteError;
  }

  const invites = (inviteRows ?? []) as LobbyInviteRow[];
  if (invites.length === 0) {
    return [];
  }

  const profileIds = [...new Set(invites.map((invite) => invite.invited_profile_id))];
  const { data: profileRows, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, name, initials, avatar_color, rating, games_played, competitive_points, position, bio, photo_url, gender, rating_history, lobby_history')
    .in('id', profileIds);

  if (profilesError) {
    throw profilesError;
  }

  const playersById = new Map(((profileRows ?? []) as ProfileRow[]).map((row) => [row.id, mapProfile(row)]));

  return invites
    .map((invite) => {
      const invitedPlayer = playersById.get(invite.invited_profile_id);
      if (!invitedPlayer) {
        return null;
      }

      return {
        id: invite.id,
        lobbyId: invite.lobby_id,
        invitedProfileId: invite.invited_profile_id,
        invitedByProfileId: invite.invited_by_profile_id,
        status: invite.status,
        createdAt: invite.created_at,
        invitedPlayer,
      };
    })
    .filter((invite): invite is LobbyInvite => Boolean(invite));
}

function mapLobbyTeam(row: LobbyTeamRow): LobbyTeam {
  return {
    id: row.id,
    lobbyId: row.lobby_id,
    color: row.color,
    teamNumber: row.team_number,
    lockedAt: row.locked_at ?? undefined,
  };
}

export async function fetchLobbyTeams(lobbyId: string): Promise<LobbyTeamAssignment[]> {
  const supabase = requireSupabase();
  const { data: teamRows, error: teamsError } = await supabase
    .from('lobby_teams')
    .select('id, lobby_id, color, team_number, locked_at')
    .eq('lobby_id', lobbyId)
    .order('team_number', { ascending: true });

  if (teamsError) {
    throw teamsError;
  }

  const teams = (teamRows ?? []) as LobbyTeamRow[];
  if (teams.length === 0) {
    return [];
  }

  const { data: memberRows, error: membersError } = await supabase
    .from('lobby_team_members')
    .select('lobby_id, lobby_team_id, profile_id')
    .eq('lobby_id', lobbyId);

  if (membersError) {
    throw membersError;
  }

  const profileIds = [...new Set(((memberRows ?? []) as LobbyTeamMemberRow[]).map((row) => row.profile_id))];
  if (profileIds.length === 0) {
    return teams.map((row) => ({
      team: mapLobbyTeam(row),
      players: [],
    }));
  }

  const { data: profileRows, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, name, initials, avatar_color, rating, games_played, competitive_points, position, bio, photo_url, gender, rating_history, lobby_history')
    .in('id', profileIds);

  if (profilesError) {
    throw profilesError;
  }

  const playersById = new Map(((profileRows ?? []) as ProfileRow[]).map((row) => [row.id, mapProfile(row)]));
  const membersByTeamId = new Map<string, Player[]>();

  for (const row of (memberRows ?? []) as LobbyTeamMemberRow[]) {
    const player = playersById.get(row.profile_id);
    if (!player) {
      continue;
    }
    const players = membersByTeamId.get(row.lobby_team_id) ?? [];
    players.push(player);
    membersByTeamId.set(row.lobby_team_id, players);
  }

  return teams.map((row) => ({
    team: mapLobbyTeam(row),
    players: [...(membersByTeamId.get(row.id) ?? [])].sort(
      (left, right) => (right.competitivePoints ?? 0) - (left.competitivePoints ?? 0),
    ),
  }));
}

export async function generateLobbyTeams(lobbyId: string, actorProfileId: string): Promise<LobbyTeamAssignment[]> {
  const supabase = requireSupabase();
  const lobby = await fetchLobbyById(lobbyId);

  if (!lobby) {
    throw new Error('Lobby not found.');
  }

  if (!lobby.numTeams || !lobby.playersPerTeam) {
    throw new Error('This lobby is missing team settings.');
  }

  if (lobby.players.length !== lobby.maxPlayers) {
    throw new Error('Teams can only be created once the lobby is full.');
  }

  const { data: existingResults, error: existingResultsError } = await supabase
    .from('lobby_results')
    .select('lobby_id')
    .eq('lobby_id', lobbyId)
    .maybeSingle();

  if (existingResultsError) {
    throw existingResultsError;
  }

  if (existingResults) {
    throw new Error('Teams cannot be changed after results were submitted.');
  }

  const existingTeams = await fetchLobbyTeams(lobbyId);
  if (existingTeams.length > 0) {
    throw new Error('Teams were already created for this lobby.');
  }

  const generatedTeams = buildBalancedLobbyTeams(lobby.players, lobby.numTeams, lobby.playersPerTeam);
  const timestamp = new Date().toISOString();

  const { data: insertedTeams, error: insertTeamsError } = await supabase
    .from('lobby_teams')
    .insert(
      generatedTeams.map((team) => ({
        lobby_id: lobbyId,
        color: team.color,
        team_number: team.teamNumber,
        locked_at: timestamp,
      })),
    )
    .select('id, lobby_id, color, team_number, locked_at');

  if (insertTeamsError) {
    throw insertTeamsError;
  }

  const teamIdByNumber = new Map(((insertedTeams ?? []) as LobbyTeamRow[]).map((row) => [row.team_number, row.id]));
  const memberPayload = generatedTeams.flatMap((team) => {
    const lobbyTeamId = teamIdByNumber.get(team.teamNumber);
    if (!lobbyTeamId) {
      throw new Error(`Failed to resolve created team ${team.teamNumber}.`);
    }

    return team.players.map((player) => ({
      lobby_id: lobbyId,
      lobby_team_id: lobbyTeamId,
      profile_id: player.id,
    }));
  });

  const { error: insertMembersError } = await supabase.from('lobby_team_members').insert(memberPayload);
  if (insertMembersError) {
    throw insertMembersError;
  }

  await createTeamAssignedNotifications(
    actorProfileId,
    lobby,
    generatedTeams.flatMap((team) =>
      team.players.map((player) => ({
        profileId: player.id,
        teamColor: team.color,
      })),
    ),
  );

  return fetchLobbyTeams(lobbyId);
}

export async function swapLobbyTeamPlayers(
  lobbyId: string,
  actorProfileId: string,
  firstProfileId: string,
  secondProfileId: string,
): Promise<LobbyTeamAssignment[]> {
  const supabase = requireSupabase();
  const lobby = await fetchLobbyById(lobbyId);

  if (!lobby) {
    throw new Error('Lobby not found.');
  }

  if (lobby.createdBy !== actorProfileId) {
    throw new Error('Only the lobby creator can edit teams.');
  }

  const { data: existingResults, error: existingResultsError } = await supabase
    .from('lobby_results')
    .select('lobby_id')
    .eq('lobby_id', lobbyId)
    .maybeSingle();

  if (existingResultsError) {
    throw existingResultsError;
  }

  if (existingResults) {
    throw new Error('Teams cannot be changed after results were submitted.');
  }

  const { data: teamRows, error: teamsError } = await supabase
    .from('lobby_teams')
    .select('id, lobby_id, color, team_number, locked_at')
    .eq('lobby_id', lobbyId);

  if (teamsError) {
    throw teamsError;
  }

  const teams = (teamRows ?? []) as LobbyTeamRow[];
  if (teams.length === 0) {
    throw new Error('Teams were not created for this lobby yet.');
  }

  const { data: memberRows, error: membersError } = await supabase
    .from('lobby_team_members')
    .select('lobby_id, lobby_team_id, profile_id')
    .eq('lobby_id', lobbyId)
    .in('profile_id', [firstProfileId, secondProfileId]);

  if (membersError) {
    throw membersError;
  }

  const members = (memberRows ?? []) as LobbyTeamMemberRow[];
  const firstMember = members.find((member) => member.profile_id === firstProfileId);
  const secondMember = members.find((member) => member.profile_id === secondProfileId);

  if (!firstMember || !secondMember) {
    throw new Error('Both selected players must already belong to a team.');
  }

  if (firstMember.lobby_team_id === secondMember.lobby_team_id) {
    throw new Error('Select players from different teams to swap them.');
  }

  const { error: updateFirstError } = await supabase
    .from('lobby_team_members')
    .update({ lobby_team_id: secondMember.lobby_team_id })
    .eq('lobby_id', lobbyId)
    .eq('profile_id', firstProfileId);

  if (updateFirstError) {
    throw updateFirstError;
  }

  const { error: updateSecondError } = await supabase
    .from('lobby_team_members')
    .update({ lobby_team_id: firstMember.lobby_team_id })
    .eq('lobby_id', lobbyId)
    .eq('profile_id', secondProfileId);

  if (updateSecondError) {
    throw updateSecondError;
  }

  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const firstTargetTeam = teamsById.get(secondMember.lobby_team_id);
  const secondTargetTeam = teamsById.get(firstMember.lobby_team_id);

  if (firstTargetTeam && secondTargetTeam) {
    await createTeamAssignedNotifications(actorProfileId, lobby, [
      { profileId: firstProfileId, teamColor: firstTargetTeam.color },
      { profileId: secondProfileId, teamColor: secondTargetTeam.color },
    ]);
  }

  return fetchLobbyTeams(lobbyId);
}

export async function fetchLobbyResult(lobbyId: string): Promise<LobbyResultSummary | null> {
  const supabase = requireSupabase();
  const { data: resultRow, error: resultError } = await supabase
    .from('lobby_results')
    .select('lobby_id, submitted_by_profile_id, submitted_at, notes')
    .eq('lobby_id', lobbyId)
    .maybeSingle();

  if (resultError) {
    throw resultError;
  }

  if (!resultRow) {
    return null;
  }

  const [teamRowsResult, teamResultsResult] = await Promise.all([
    supabase
      .from('lobby_teams')
      .select('id, lobby_id, color, team_number, locked_at')
      .eq('lobby_id', lobbyId),
    supabase
      .from('lobby_team_results')
      .select('lobby_id, lobby_team_id, wins, rank, awarded_points')
      .eq('lobby_id', lobbyId),
  ]);

  if (teamRowsResult.error) {
    throw teamRowsResult.error;
  }

  if (teamResultsResult.error) {
    throw teamResultsResult.error;
  }

  const teamsById = new Map(((teamRowsResult.data ?? []) as LobbyTeamRow[]).map((row) => [row.id, row]));
  const teamResults: LobbyTeamStanding[] = ((teamResultsResult.data ?? []) as LobbyTeamResultRow[])
    .map((row) => {
      const team = teamsById.get(row.lobby_team_id);
      if (!team) {
        return null;
      }

      return {
        lobbyId: row.lobby_id,
        lobbyTeamId: row.lobby_team_id,
        wins: row.wins,
        rank: row.rank,
        awardedPoints: row.awarded_points,
        teamColor: team.color,
        teamNumber: team.team_number,
      };
    })
    .filter((row): row is LobbyTeamStanding => Boolean(row))
    .sort((left, right) => left.teamNumber - right.teamNumber);

  const result = resultRow as LobbyResultRow;
  return {
    lobbyId: result.lobby_id,
    submittedByProfileId: result.submitted_by_profile_id,
    submittedAt: result.submitted_at,
    notes: result.notes ?? undefined,
    teamResults,
  };
}

export async function fetchCompetitivePointHistory(profileId: string): Promise<CompetitivePointHistoryEntry[]> {
  const supabase = requireSupabase();
  const { data: eventRows, error: eventsError } = await supabase
    .from('competitive_point_events')
    .select('id, lobby_id, profile_id, awarded_by_profile_id, team_color, team_number, wins, rank, points, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (eventsError) {
    throw eventsError;
  }

  const events = (eventRows ?? []) as CompetitivePointEventRow[];
  if (events.length === 0) {
    return [];
  }

  const lobbyIds = [...new Set(events.map((event) => event.lobby_id))];
  const [{ data: lobbyRows, error: lobbiesError }, { data: resultRows, error: resultsError }] = await Promise.all([
    supabase
      .from('lobbies')
      .select('id, title, city, datetime')
      .in('id', lobbyIds),
    supabase
      .from('lobby_results')
      .select('lobby_id, notes')
      .in('lobby_id', lobbyIds),
  ]);

  if (lobbiesError) {
    throw lobbiesError;
  }

  if (resultsError) {
    throw resultsError;
  }

  const lobbyById = new Map(
    ((lobbyRows ?? []) as Array<{ id: string; title: string; city: string; datetime: string }>).map((row) => [row.id, row]),
  );
  const resultByLobbyId = new Map(
    ((resultRows ?? []) as LobbyResultRow[]).map((row) => [row.lobby_id, row]),
  );

  return events.map((event) => {
    const lobby = lobbyById.get(event.lobby_id);
    const result = resultByLobbyId.get(event.lobby_id);

    return {
      id: event.id,
      lobbyId: event.lobby_id,
      lobbyTitle: lobby?.title ?? 'Competitive lobby',
      lobbyDate: lobby?.datetime ?? event.created_at,
      city: lobby?.city ?? '',
      teamColor: event.team_color,
      teamNumber: event.team_number,
      wins: event.wins,
      rank: event.rank,
      points: event.points,
      createdAt: event.created_at,
      notes: result?.notes ?? undefined,
    };
  });
}

export async function submitCompetitiveLobbyResult(
  lobbyId: string,
  submittedByProfileId: string,
  winsByTeamId: Record<string, number>,
  notes?: string,
): Promise<LobbyResultSummary> {
  const supabase = requireSupabase();
  const lobby = await fetchLobbyById(lobbyId);

  if (!lobby) {
    throw new Error('Lobby not found.');
  }

  if (lobby.createdBy !== submittedByProfileId) {
    throw new Error('Only the lobby creator can submit the result.');
  }

  if (lobby.gameType !== 'competitive') {
    throw new Error('Results are only available for competitive lobbies.');
  }

  if (new Date(lobby.datetime) > new Date()) {
    throw new Error('You can submit the result only after the game starts.');
  }

  const [existingResult, teamAssignments] = await Promise.all([
    fetchLobbyResult(lobbyId),
    fetchLobbyTeams(lobbyId),
  ]);

  if (existingResult) {
    throw new Error('Results were already submitted for this lobby.');
  }

  if (teamAssignments.length < 2) {
    throw new Error('Create the teams before submitting a result.');
  }

  const standings = calculateCompetitiveStandings(
    teamAssignments.map((assignment) => ({
      teamId: assignment.team.id,
      color: assignment.team.color,
      teamNumber: assignment.team.teamNumber,
      wins: winsByTeamId[assignment.team.id] ?? 0,
    })),
  );

  const { error: resultInsertError } = await supabase.from('lobby_results').insert({
    lobby_id: lobbyId,
    submitted_by_profile_id: submittedByProfileId,
    notes: notes ? normalizeText(notes) : null,
  });

  if (resultInsertError) {
    throw resultInsertError;
  }

  const { error: teamResultsInsertError } = await supabase.from('lobby_team_results').insert(
    standings.map((standing) => ({
      lobby_id: lobbyId,
      lobby_team_id: standing.teamId,
      wins: standing.wins,
      rank: standing.rank,
      awarded_points: standing.awardedPoints,
    })),
  );

  if (teamResultsInsertError) {
    throw teamResultsInsertError;
  }

  const standingByTeamId = new Map(standings.map((standing) => [standing.teamId, standing]));
  const pointEvents = teamAssignments.flatMap((assignment) => {
    const standing = standingByTeamId.get(assignment.team.id);
    if (!standing) {
      throw new Error('Failed to map standings to teams.');
    }

    return assignment.players.map((player) => ({
      lobby_id: lobbyId,
      profile_id: player.id,
      awarded_by_profile_id: submittedByProfileId,
      team_color: standing.color,
      team_number: standing.teamNumber,
      wins: standing.wins,
      rank: standing.rank,
      points: standing.awardedPoints,
      reason: 'competitive_lobby_result',
    }));
  });
  const resultNotifications = teamAssignments.flatMap((assignment) => {
    const standing = standingByTeamId.get(assignment.team.id);
    if (!standing) {
      throw new Error('Failed to map standings to teams.');
    }

    return assignment.players.map((player) => ({
      profileId: player.id,
      teamColor: standing.color,
      wins: standing.wins,
      rank: standing.rank,
      points: standing.awardedPoints,
    }));
  });

  const { error: pointEventsError } = await supabase.from('competitive_point_events').insert(pointEvents);
  if (pointEventsError) {
    throw pointEventsError;
  }

  const pointsByProfileId = new Map<string, number>();
  for (const event of pointEvents) {
    pointsByProfileId.set(event.profile_id, (pointsByProfileId.get(event.profile_id) ?? 0) + event.points);
  }

  const profileIds = [...pointsByProfileId.keys()];
  if (profileIds.length > 0) {
    const { data: profileRows, error: profilesError } = await supabase
      .from('profiles')
      .select('id, competitive_points')
      .in('id', profileIds);

    if (profilesError) {
      throw profilesError;
    }

    const currentPointsById = new Map(
      ((profileRows ?? []) as Array<{ id: string; competitive_points: number | null }>).map((row) => [
        row.id,
        row.competitive_points ?? 0,
      ]),
    );

    await Promise.all(
      profileIds.map(async (profileId) => {
        const currentPoints = currentPointsById.get(profileId) ?? 0;
        const awardedPoints = pointsByProfileId.get(profileId) ?? 0;
        const { error: updatePointsError } = await supabase
          .from('profiles')
          .update({ competitive_points: currentPoints + awardedPoints })
          .eq('id', profileId);

        if (updatePointsError) {
          throw updatePointsError;
        }
      }),
    );
  }

  await createCompetitiveResultNotifications(submittedByProfileId, lobby, resultNotifications);

  const nextResult = await fetchLobbyResult(lobbyId);
  if (!nextResult) {
    throw new Error('Failed to load the submitted result.');
  }

  return nextResult;
}

export type CreateLobbyInput = {
  title: string;
  address: string;
  city: string;
  datetime: string;
  maxPlayers: number;
  numTeams?: number;
  playersPerTeam?: number;
  minRating?: number;
  price?: number;
  description?: string;
  createdBy: string;
  gameType: GameType;
  accessType: LobbyAccessType;
  fieldType?: FieldType;
  genderRestriction?: GenderRestriction;
  latitude?: number;
  longitude?: number;
};

export async function createLobby(input: CreateLobbyInput): Promise<string> {
  const draftErrors = validateCreateLobbyPayload({
    title: input.title,
    address: input.address,
    city: input.city,
    datetime: input.datetime,
    numTeams: input.numTeams ?? 0,
    playersPerTeam: input.playersPerTeam ?? 0,
    accessType: input.accessType,
    minRating: input.gameType === 'competitive' ? input.minRating : undefined,
    price: input.price,
    description: input.description,
  });

  if (draftErrors.length > 0) {
    throw new Error(draftErrors[0]);
  }

  const supabase = requireSupabase();
  const id = `lobby_${crypto.randomUUID()}`;

  const lobbyPayload = {
    id,
    title: normalizeText(input.title),
    address: normalizeText(input.address),
    city: normalizeText(input.city),
    datetime: input.datetime,
    max_players: input.maxPlayers,
    num_teams: input.numTeams ?? null,
    players_per_team: input.playersPerTeam ?? null,
    min_rating: input.gameType === 'competitive' ? (input.minRating ?? null) : null,
    is_private: false,
    price: input.price ?? null,
    description: input.description ? normalizeText(input.description) : null,
    created_by: input.createdBy,
    distance_km: 0,
    game_type: input.gameType,
    access_type: input.accessType,
    field_type: input.fieldType ?? null,
    gender_restriction: input.genderRestriction ?? 'none',
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    status: 'active' as const,
  };

  let { error: lobbyError } = await supabase.from('lobbies').insert(lobbyPayload);

  if (lobbyError && isMissingLobbyOptionalColumnError(lobbyError)) {
    ({ error: lobbyError } = await supabase.from('lobbies').insert({
      id: lobbyPayload.id,
      title: lobbyPayload.title,
      address: lobbyPayload.address,
      city: lobbyPayload.city,
      datetime: lobbyPayload.datetime,
      max_players: lobbyPayload.max_players,
      num_teams: lobbyPayload.num_teams,
      players_per_team: lobbyPayload.players_per_team,
      min_rating: lobbyPayload.min_rating,
      is_private: lobbyPayload.is_private,
      price: lobbyPayload.price,
      description: lobbyPayload.description,
      created_by: lobbyPayload.created_by,
      distance_km: lobbyPayload.distance_km,
      game_type: lobbyPayload.game_type,
      access_type: lobbyPayload.access_type,
      field_type: lobbyPayload.field_type,
      gender_restriction: lobbyPayload.gender_restriction,
      latitude: lobbyPayload.latitude,
      longitude: lobbyPayload.longitude,
    }));
  }

  if (lobbyError) {
    throw toAppError(lobbyError, 'Failed to create game.');
  }

  const { error: membershipError } = await supabase.from('lobby_memberships').insert({
    lobby_id: id,
    profile_id: input.createdBy,
    status: 'joined',
  });

  if (membershipError) {
    throw toAppError(membershipError, 'Failed to join the game after creating it.');
  }

  const createdLobby = await fetchLobbyById(id);
  if (createdLobby) {
    await createOrganizerSummaryNotification(input.createdBy, createdLobby);
  }

  return id;
}

export async function upsertLobbyMembership(lobbyId: string, profileId: string, status: MembershipRow['status']) {
  const supabase = requireSupabase();
  let resolvedProfile: Player | null = null;
  let wasJoinedBefore = false;
  let shouldMarkInviteAccepted = false;

  if (status === 'joined' || status === 'waitlisted') {
    const [lobby, profile] = await Promise.all([fetchLobbyById(lobbyId), fetchProfileById(profileId)]);
    const resolvedLobby = lobby;
    resolvedProfile = profile;
    wasJoinedBefore = resolvedLobby ? resolvedLobby.players.some((player) => player.id === profileId) : false;
    const joinError =
      resolvedLobby && profile
        ? getJoinLobbyError(resolvedLobby, profile, { allowExistingWaitlist: status === 'joined' })
        : 'Failed to resolve player or game.';

    if (joinError) {
      throw new Error(joinError);
    }

    if (!resolvedLobby || !profile) {
      throw new Error('Failed to resolve player or game.');
    }

    if (resolvedLobby.accessType === 'locked' && profileId !== resolvedLobby.createdBy) {
      const friendIds = await fetchAcceptedFriendIds(profileId);
      const hasFriendInside = resolvedLobby.players.some((player) => friendIds.includes(player.id));
      const { data: inviteRow, error: inviteError } = await supabase
        .from('lobby_invites')
        .select('id, status')
        .eq('lobby_id', lobbyId)
        .eq('invited_profile_id', profileId)
        .maybeSingle();

      if (inviteError) {
        throw inviteError;
      }

      const isInvited = Boolean(inviteRow && inviteRow.status !== 'revoked');
      if (!hasFriendInside && !isInvited) {
        throw new Error('This locked lobby is available only to invited players or friends of current participants.');
      }

      shouldMarkInviteAccepted = Boolean(inviteRow);
    }

    if (status === 'joined') {
      const joinedCount = resolvedLobby.players.length;
      if (joinedCount >= resolvedLobby.maxPlayers) {
        throw new Error('This game is full right now.');
      }
    }
  }

  const { error } = await supabase.from('lobby_memberships').upsert(
    {
      lobby_id: lobbyId,
      profile_id: profileId,
      status,
    },
    { onConflict: 'lobby_id,profile_id' },
  );

  if (error) {
    throw error;
  }

  if (status === 'joined' && shouldMarkInviteAccepted) {
    const { error: inviteUpdateError } = await supabase
      .from('lobby_invites')
      .update({ status: 'accepted' })
      .eq('lobby_id', lobbyId)
      .eq('invited_profile_id', profileId)
      .neq('status', 'revoked');

    if (inviteUpdateError) {
      throw inviteUpdateError;
    }
  }

  const nextLobby = await fetchLobbyById(lobbyId);
  if (!nextLobby) {
    return;
  }

  if (status === 'joined' && !wasJoinedBefore && resolvedProfile) {
    const friendIds = await fetchAcceptedFriendIds(profileId);
    await createFriendJoinedLobbyNotifications(profileId, resolvedProfile.name, friendIds, nextLobby);
  }

  await createOrganizerSummaryNotification(profileId, nextLobby);
}

export async function createLobbyInvite(lobbyId: string, invitedByProfileId: string, invitedProfileId: string) {
  const supabase = requireSupabase();
  const [lobby, inviter, invitedProfile] = await Promise.all([
    fetchLobbyById(lobbyId),
    fetchProfileById(invitedByProfileId),
    fetchProfileById(invitedProfileId),
  ]);

  if (!lobby) {
    throw new Error('Lobby not found.');
  }

  if (lobby.createdBy !== invitedByProfileId) {
    throw new Error('Only the lobby creator can invite players.');
  }

  if (lobby.accessType !== 'locked') {
    throw new Error('Invites are available only for locked lobbies.');
  }

  if (invitedByProfileId === invitedProfileId) {
    throw new Error('You are already in this lobby.');
  }

  if (!inviter || !invitedProfile) {
    throw new Error('Failed to resolve the invited player.');
  }

  if (lobby.players.some((player) => player.id === invitedProfileId) || lobby.waitlist.some((player) => player.id === invitedProfileId)) {
    throw new Error('This player is already part of the lobby.');
  }

  const inviterFriendIds = await fetchAcceptedFriendIds(invitedByProfileId);
  if (!inviterFriendIds.includes(invitedProfileId)) {
    throw new Error('You can invite only friends to a locked lobby.');
  }

  const { error } = await supabase.from('lobby_invites').upsert(
    {
      lobby_id: lobbyId,
      invited_profile_id: invitedProfileId,
      invited_by_profile_id: invitedByProfileId,
      status: 'pending',
    },
    { onConflict: 'lobby_id,invited_profile_id' },
  );

  if (error) {
    throw error;
  }

  await createLobbyInviteNotification(invitedByProfileId, inviter.name, invitedProfileId, lobby);
}

export async function deleteLobbyMembership(lobbyId: string, profileId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('lobby_memberships')
    .delete()
    .eq('lobby_id', lobbyId)
    .eq('profile_id', profileId);

  if (error) {
    throw error;
  }
}

export type PlayerRatingInput = {
  ratedProfileId: string;
  rating: number;
};

export type LobbyRatingSubmission = {
  lobbyId: string;
  raterProfileId: string;
  playerRatings: PlayerRatingInput[];
  fieldRating: number;
  gameLevel: 'beginner' | 'intermediate' | 'advanced';
};

export async function submitLobbyRatings(input: LobbyRatingSubmission) {
  const supabase = requireSupabase();

  const rows = input.playerRatings.map((pr) => ({
    lobby_id: input.lobbyId,
    rater_profile_id: input.raterProfileId,
    rated_profile_id: pr.ratedProfileId,
    rating: pr.rating,
    field_rating: input.fieldRating,
    game_level: input.gameLevel,
  }));

  const { error } = await supabase.from('lobby_ratings').insert(rows);
  if (error) {
    throw error;
  }
}

export type UpdateLobbyInput = {
  lobbyId: string;
  title: string;
  address: string;
  city: string;
  datetime: string;
  numTeams?: number;
  playersPerTeam?: number;
  minRating?: number;
  price?: number;
  description?: string;
  gameType: GameType;
  accessType: LobbyAccessType;
  fieldType?: FieldType;
  genderRestriction: GenderRestriction;
  latitude?: number;
  longitude?: number;
};

export async function updateLobby(input: UpdateLobbyInput) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('lobbies')
    .update({
      title: normalizeText(input.title),
      address: normalizeText(input.address),
      city: normalizeText(input.city),
      datetime: input.datetime,
      num_teams: input.numTeams ?? null,
      players_per_team: input.playersPerTeam ?? null,
      max_players: (input.numTeams ?? 2) * (input.playersPerTeam ?? 5),
      min_rating: input.gameType === 'competitive' ? (input.minRating ?? null) : null,
      price: input.price ?? null,
      description: input.description ? normalizeText(input.description) : null,
      game_type: input.gameType,
      access_type: input.accessType,
      field_type: input.fieldType ?? null,
      gender_restriction: input.genderRestriction,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    })
    .eq('id', input.lobbyId);

  if (error) {
    throw error;
  }
}

export async function deleteLobby(lobbyId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('lobbies')
    .update({ status: 'deleted' })
    .eq('id', lobbyId)
    .select('id')
    .maybeSingle();

  if (error) {
    if (isMissingLobbyOptionalColumnError(error)) {
      throw new Error('Lobby schema is missing required columns. Apply the latest Supabase lobby patch and try again.');
    }
    throw toAppError(error, 'Failed to delete game.');
  }

  if (!data) {
    throw new Error('Failed to update lobby status.');
  }
}

export async function fetchContributions(lobbyId: string): Promise<{ profileId: string; type: ContributionType }[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('lobby_contributions')
    .select('profile_id, type')
    .eq('lobby_id', lobbyId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row: { profile_id: string; type: string }) => ({
    profileId: row.profile_id,
    type: row.type as ContributionType,
  }));
}

export async function toggleContribution(lobbyId: string, profileId: string, type: ContributionType, currentlyActive: boolean) {
  const supabase = requireSupabase();

  if (currentlyActive) {
    const { error } = await supabase
      .from('lobby_contributions')
      .delete()
      .eq('lobby_id', lobbyId)
      .eq('profile_id', profileId)
      .eq('type', type);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('lobby_contributions')
      .insert({ lobby_id: lobbyId, profile_id: profileId, type });

    if (error) throw error;
  }
}

export async function updateHomeLocation(
  profileId: string,
  homeLatitude: number | null,
  homeLongitude: number | null,
  homeAddress: string | null,
) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('profiles')
    .update({ home_latitude: homeLatitude, home_longitude: homeLongitude, home_address: homeAddress })
    .eq('id', profileId);
  if (error) throw error;
}

export async function fetchDistinctCities(): Promise<string[]> {
  const supabase = requireSupabase();
  const { data } = await supabase.from('lobbies').select('city');
  const values = [...new Set((data ?? []).map((row: { city: string }) => row.city).filter(Boolean))];
  return values.sort();
}

export async function hasAlreadyRated(lobbyId: string, raterProfileId: string): Promise<boolean> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('lobby_ratings')
    .select('id')
    .eq('lobby_id', lobbyId)
    .eq('rater_profile_id', raterProfileId)
    .limit(1);

  if (error) {
    throw error;
  }

  return (data ?? []).length > 0;
}
