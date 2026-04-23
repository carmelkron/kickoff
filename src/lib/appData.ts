import type {
  Lobby,
  Player,
  ProfileSkill,
  RatingEntry,
  LobbyHistoryEntry,
  GameType,
  FieldType,
  GenderRestriction,
  Gender,
  ContributionType,
  LobbyStatus,
  LobbyTeam,
  LobbyTeamAssignment,
  LobbyResultSummary,
  LobbyTeamStanding,
  TeamColor,
  CompetitivePointHistoryEntry,
  LobbyAccessType,
  LobbyInvite,
  LobbyInviteStatus,
  LobbyJoinRequest,
  LobbyJoinRequestStatus,
  LobbyMessage,
  ThemeMode,
  NotificationPreferences,
  SearchHistoryEntry,
  SearchResult,
  FriendRequestListItem,
  NetworkRecommendation,
  LeaderboardStats,
  LeaderboardEntry,
} from '../types';
import {
  createCompetitiveResultNotifications,
  createLobbyInviteNotification,
  createLobbyJoinRequestNotification,
  createLobbyJoinRequestResolutionNotification,
  createWaitlistSpotOpenedNotifications,
  fetchAcceptedFriendIds,
  markLobbyJoinRequestNotificationsHandled,
  markWaitlistSpotNotificationsHandled,
} from './appNotifications';
import { requireSupabase } from './supabase';
import { getJoinLobbyError, getJoinLobbyTargetStatus, normalizeText, sanitizeProfileSkills, validateCreateLobbyPayload, validateProfileSkills } from './validation';
import { calculateCompetitiveStandings } from './competitiveResults';
import { buildLobbyHistoryEntries, type LobbyHistoryMembershipRow } from './lobbyHistory';
import {
  buildPendingLobbyResultReminders,
  canSubmitLobbyResult,
  type LobbyResultReminderCandidate,
  type PendingLobbyResultReminder,
} from './lobbyResultReminders';
import { canManageLobby } from './lobbyRoles';
import { buildBalancedLobbyTeams } from './teamAssignment';
import { buildWaitlistSyncPlan } from './waitlist';
import { SEARCH_HISTORY_LIMIT, normalizeNotificationPreferences } from './preferences';

const PROFILE_SELECT_FIELDS = 'id, email, name, initials, avatar_color, rating, games_played, competitive_points, position, bio, photo_url, gender, birthdate, rating_history, lobby_history';
const LOBBY_SELECT_FIELDS = 'id, title, address, city, datetime, max_players, num_teams, players_per_team, min_rating, min_points_per_game, min_age, max_age, is_private, price, description, created_by, distance_km, game_type, access_type, field_type, gender_restriction, latitude, longitude';
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

function isMissingAuthSessionError(error: unknown) {
  return getErrorText(error).toLowerCase().includes('auth session missing');
}

function isMissingLobbyOptionalColumnError(error: unknown) {
  const text = getErrorText(error).toLowerCase();
  return (text.includes('status') || text.includes('access_type')) && (
    text.includes('column')
    || text.includes('schema cache')
    || text.includes('could not find')
  );
}

function isMissingLobbyJoinRequestsTableError(error: unknown) {
  const text = getErrorText(error).toLowerCase();
  return text.includes('lobby_join_requests') && (
    text.includes('does not exist')
    || text.includes('schema cache')
    || text.includes('could not find')
    || text.includes('relation')
  );
}

function isMissingLobbyMessagesTableError(error: unknown) {
  const text = getErrorText(error).toLowerCase();
  return text.includes('lobby_messages') && (
    text.includes('does not exist')
    || text.includes('schema cache')
    || text.includes('could not find')
    || text.includes('relation')
  );
}

function isMissingLobbyOrganizersTableError(error: unknown) {
  const text = getErrorText(error).toLowerCase();
  return text.includes('lobby_organizers') && (
    text.includes('does not exist')
    || text.includes('schema cache')
    || text.includes('could not find')
    || text.includes('relation')
  );
}

function isMissingUserPreferencesTableError(error: unknown) {
  const text = getErrorText(error).toLowerCase();
  return text.includes('user_preferences') && (
    text.includes('does not exist')
    || text.includes('schema cache')
    || text.includes('could not find')
    || text.includes('relation')
  );
}

function isMissingRecentSearchEntriesTableError(error: unknown) {
  const text = getErrorText(error).toLowerCase();
  return text.includes('recent_search_entries') && (
    text.includes('does not exist')
    || text.includes('schema cache')
    || text.includes('could not find')
    || text.includes('relation')
  );
}

function isDuplicateLobbyResultError(error: unknown) {
  const text = getErrorText(error).toLowerCase();
  return (
    text.includes('duplicate key')
    || text.includes('23505')
    || text.includes('already exists')
  ) && (
    text.includes('lobby_results')
    || text.includes('pkey')
    || text.includes('primary')
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
  birthdate: string | null;
  rating_history: RatingEntry[];
  lobby_history: LobbyHistoryEntry[];
};

type ProfileSkillRow = {
  id: string;
  profile_id: string;
  label: string;
  created_at: string;
};

type ProfileSkillEndorsementRow = {
  profile_skill_id: string;
  endorsed_by_profile_id: string;
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
  min_points_per_game: number | null;
  min_age: number | null;
  max_age: number | null;
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
  status: 'joined' | 'waitlisted' | 'pending_confirm' | 'waitlisted_passed' | 'left';
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
  max_rank?: number;
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

type LobbyJoinRequestRow = {
  id: string;
  lobby_id: string;
  requester_profile_id: string;
  status: LobbyJoinRequestStatus;
  created_at: string;
  responded_at: string | null;
  responded_by_profile_id: string | null;
};

type LobbyMessageRow = {
  id: string;
  lobby_id: string;
  profile_id: string;
  body: string;
  created_at: string;
};

type LobbyOrganizerRow = {
  lobby_id: string;
  profile_id: string;
};

type LobbyResultReminderLobbyRow = {
  id: string;
  title: string;
  datetime: string;
  created_by: string;
  game_type: GameType;
  status?: 'active' | 'deleted' | 'expired' | null;
};

type UserPreferencesRow = {
  profile_id: string;
  theme_mode: ThemeMode | null;
  language: 'he' | 'en' | null;
  notification_preferences: NotificationPreferences | null;
};

type RecentSearchEntryRow = {
  id: string;
  profile_id: string;
  kind: 'query' | 'profile' | 'lobby';
  query_text: string | null;
  target_id: string | null;
  label: string;
  acted_at: string;
};

type FriendRequestListRow = {
  from_profile_id: string;
  to_profile_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at?: string;
};

type CompetitiveProfileStats = {
  competitiveGamesPlayed: number;
  competitivePointsPerGame: number;
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
    if (isMissingAuthSessionError(error)) {
      return null;
    }
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

async function fetchLobbyMembershipRows(lobbyId: string): Promise<MembershipRow[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('lobby_memberships')
    .select('lobby_id, profile_id, status, created_at')
    .eq('lobby_id', lobbyId);

  if (error) {
    throw error;
  }

  return (data ?? []) as MembershipRow[];
}

async function updateMembershipStatus(
  lobbyId: string,
  profileId: string,
  status: MembershipRow['status'],
) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('lobby_memberships')
    .update({ status })
    .eq('lobby_id', lobbyId)
    .eq('profile_id', profileId);

  if (error) {
    throw error;
  }
}

async function syncLobbyWaitlistState(lobbyId: string, actorProfileId: string) {
  const lobby = await fetchLobbyById(lobbyId);
  if (!lobby) {
    return null;
  }

  const memberships = await fetchLobbyMembershipRows(lobbyId);
  const plan = buildWaitlistSyncPlan(
    memberships.map((membership) => ({
      profileId: membership.profile_id,
      status: membership.status,
      createdAt: membership.created_at,
    })),
    lobby.maxPlayers,
  );

  for (const profileId of plan.resetToWaitlistedIds) {
    await updateMembershipStatus(lobbyId, profileId, 'waitlisted');
    await markWaitlistSpotNotificationsHandled(profileId, lobbyId);
  }

  for (const profileId of plan.promoteToPendingIds) {
    await updateMembershipStatus(lobbyId, profileId, 'pending_confirm');
  }

  const nextLobby = await fetchLobbyById(lobbyId);
  if (!nextLobby) {
    return null;
  }

  if (plan.promoteToPendingIds.length > 0) {
    await createWaitlistSpotOpenedNotifications(actorProfileId, nextLobby, plan.promoteToPendingIds);
  }

  return nextLobby;
}

function mapProfile(row: ProfileRow, stats?: CompetitiveProfileStats): Player {
  const competitivePoints = row.competitive_points ?? 0;
  const competitiveGamesPlayed = stats?.competitiveGamesPlayed ?? 0;
  const competitivePointsPerGame =
    competitiveGamesPlayed > 0
      ? competitivePoints / competitiveGamesPlayed
      : 0;

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
    birthdate: row.birthdate ?? undefined,
    skills: [],
    competitivePoints,
    competitiveGamesPlayed,
    competitivePointsPerGame,
    ratingHistory: row.rating_history ?? [],
    lobbyHistory: row.lobby_history ?? [],
  };
}

export async function fetchProfileSkillsMap(
  profileIds: string[],
  viewerProfileId?: string | null,
): Promise<Map<string, ProfileSkill[]>> {
  const uniqueProfileIds = [...new Set(profileIds.filter(Boolean))];
  if (uniqueProfileIds.length === 0) {
    return new Map();
  }

  const supabase = requireSupabase();
  const { data: skillRows, error: skillsError } = await supabase
    .from('profile_skills')
    .select('id, profile_id, label, created_at')
    .in('profile_id', uniqueProfileIds)
    .order('created_at', { ascending: true });

  if (skillsError) {
    throw skillsError;
  }

  const skills = (skillRows ?? []) as ProfileSkillRow[];
  const profileSkillsMap = new Map<string, ProfileSkill[]>(
    uniqueProfileIds.map((profileId) => [profileId, []]),
  );

  if (skills.length === 0) {
    return profileSkillsMap;
  }

  const skillIds = skills.map((skill) => skill.id);
  const [
    { data: endorsementRows, error: endorsementsError },
    viewerEndorsementsResult,
  ] = await Promise.all([
    supabase
      .from('profile_skill_endorsements')
      .select('profile_skill_id, endorsed_by_profile_id')
      .in('profile_skill_id', skillIds),
    viewerProfileId
      ? supabase
          .from('profile_skill_endorsements')
          .select('profile_skill_id')
          .eq('endorsed_by_profile_id', viewerProfileId)
          .in('profile_skill_id', skillIds)
      : Promise.resolve({ data: [] as Array<{ profile_skill_id: string }>, error: null }),
  ]);

  if (endorsementsError) {
    throw endorsementsError;
  }
  if (viewerEndorsementsResult.error) {
    throw viewerEndorsementsResult.error;
  }

  const endorsementCountBySkillId = new Map<string, number>();
  for (const row of (endorsementRows ?? []) as ProfileSkillEndorsementRow[]) {
    endorsementCountBySkillId.set(
      row.profile_skill_id,
      (endorsementCountBySkillId.get(row.profile_skill_id) ?? 0) + 1,
    );
  }

  const viewerEndorsedSkillIds = new Set(
    ((viewerEndorsementsResult.data ?? []) as Array<{ profile_skill_id: string }>).map((row) => row.profile_skill_id),
  );

  for (const skill of skills) {
    const current = profileSkillsMap.get(skill.profile_id) ?? [];
    current.push({
      id: skill.id,
      label: skill.label,
      endorsementCount: endorsementCountBySkillId.get(skill.id) ?? 0,
      viewerHasEndorsed: viewerEndorsedSkillIds.has(skill.id),
    });
    profileSkillsMap.set(skill.profile_id, current);
  }

  return profileSkillsMap;
}

export async function fetchCompetitiveProfileStats(profileIds: string[]): Promise<Map<string, CompetitiveProfileStats>> {
  const uniqueProfileIds = [...new Set(profileIds.filter(Boolean))];
  if (uniqueProfileIds.length === 0) {
    return new Map();
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('competitive_point_events')
    .select('profile_id')
    .in('profile_id', uniqueProfileIds);

  if (error) {
    throw error;
  }

  const competitiveGamesByProfileId = new Map<string, number>();

  for (const row of (data ?? []) as Array<{ profile_id: string }>) {
    competitiveGamesByProfileId.set(row.profile_id, (competitiveGamesByProfileId.get(row.profile_id) ?? 0) + 1);
  }

  return new Map(
    uniqueProfileIds.map((profileId) => {
      const competitiveGamesPlayed = competitiveGamesByProfileId.get(profileId) ?? 0;
      return [
        profileId,
        {
          competitiveGamesPlayed,
          competitivePointsPerGame: 0,
        },
      ] satisfies [string, CompetitiveProfileStats];
    }),
  );
}

export async function fetchProfiles(): Promise<Player[]> {
  const supabase = requireSupabase();
  const currentProfileId = await fetchCurrentProfileId();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT_FIELDS)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  const profiles = (data ?? []) as ProfileRow[];
  const competitiveStatsByProfileId = await fetchCompetitiveProfileStats(profiles.map((profile) => profile.id));
  const skillsByProfileId = await fetchProfileSkillsMap(profiles.map((profile) => profile.id), currentProfileId);
  return profiles.map((profile) => ({
    ...mapProfile(profile, competitiveStatsByProfileId.get(profile.id)),
    skills: skillsByProfileId.get(profile.id) ?? [],
  }));
}

export async function fetchProfileById(id: string): Promise<Player | null> {
  const supabase = requireSupabase();
  const currentProfileId = await fetchCurrentProfileId();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT_FIELDS)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const competitiveStatsByProfileId = await fetchCompetitiveProfileStats([id]);
  const skillsByProfileId = await fetchProfileSkillsMap([id], currentProfileId);
  return {
    ...mapProfile(data as ProfileRow, competitiveStatsByProfileId.get(id)),
    skills: skillsByProfileId.get(id) ?? [],
  };
}

export async function fetchProfileLobbyHistory(profileId: string): Promise<LobbyHistoryEntry[]> {
  const supabase = requireSupabase();
  const { data: membershipRows, error: membershipsError } = await supabase
    .from('lobby_memberships')
    .select('lobby_id, status')
    .eq('profile_id', profileId);

  if (membershipsError) {
    throw membershipsError;
  }

  const resolvedMembershipRows = (membershipRows ?? []) as LobbyHistoryMembershipRow[];
  const joinedLobbyIds = [...new Set(
    resolvedMembershipRows
      .filter((membership) => membership.status === 'joined')
      .map((membership) => membership.lobby_id),
  )];

  if (joinedLobbyIds.length === 0) {
    return [];
  }

  const withStatus = await supabase
    .from('lobbies')
    .select('id, title, city, datetime, status')
    .in('id', joinedLobbyIds);

  if (!withStatus.error) {
    return buildLobbyHistoryEntries(
      resolvedMembershipRows,
      (withStatus.data ?? []) as Array<Pick<LobbyRow, 'id' | 'title' | 'city' | 'datetime' | 'status'>>,
    );
  }

  if (!isMissingLobbyOptionalColumnError(withStatus.error)) {
    throw withStatus.error;
  }

  const fallback = await supabase
    .from('lobbies')
    .select('id, title, city, datetime')
    .in('id', joinedLobbyIds);

  if (fallback.error) {
    throw fallback.error;
  }

  return buildLobbyHistoryEntries(
    resolvedMembershipRows,
    ((fallback.data ?? []) as Array<Pick<LobbyRow, 'id' | 'title' | 'city' | 'datetime'>>).map((row) => ({
      ...row,
      status: 'active',
    })),
  );
}

export type UpdateProfileInput = {
  profileId: string;
  name: string;
  position?: string;
  bio?: string;
  gender?: Gender;
  birthdate?: string | null;
  photoUrl?: string | null;
  skills?: string[];
};

export async function updateProfile(input: UpdateProfileInput) {
  const supabase = requireSupabase();
  const normalizedSkills = input.skills !== undefined ? sanitizeProfileSkills(input.skills) : undefined;
  const skillErrors = normalizedSkills ? validateProfileSkills(normalizedSkills) : [];
  if (skillErrors.length > 0) {
    throw new Error(skillErrors[0]);
  }

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
      birthdate: input.birthdate ?? null,
      ...(input.photoUrl !== undefined ? { photo_url: input.photoUrl } : {}),
    })
    .eq('id', input.profileId);

  if (error) {
    throw error;
  }

  if (input.skills !== undefined) {
    const nextSkills = normalizedSkills ?? [];
    const { data: existingSkillRows, error: existingSkillsError } = await supabase
      .from('profile_skills')
      .select('id, label')
      .eq('profile_id', input.profileId);

    if (existingSkillsError) {
      throw existingSkillsError;
    }

    const existingSkills = (existingSkillRows ?? []) as Array<{ id: string; label: string }>;
    const existingByNormalizedLabel = new Map(
      existingSkills.map((skill) => [normalizeText(skill.label).toLocaleLowerCase(), skill]),
    );
    const nextNormalizedLabels = new Set(nextSkills.map((skill) => skill.toLocaleLowerCase()));
    const removableSkillIds = existingSkills
      .filter((skill) => !nextNormalizedLabels.has(normalizeText(skill.label).toLocaleLowerCase()))
      .map((skill) => skill.id);
    const insertableSkills = nextSkills.filter((skill) => !existingByNormalizedLabel.has(skill.toLocaleLowerCase()));

    if (removableSkillIds.length > 0) {
      const { error: deleteSkillsError } = await supabase
        .from('profile_skills')
        .delete()
        .eq('profile_id', input.profileId)
        .in('id', removableSkillIds);

      if (deleteSkillsError) {
        throw deleteSkillsError;
      }
    }

    if (insertableSkills.length > 0) {
      const { error: insertSkillsError } = await supabase
        .from('profile_skills')
        .insert(insertableSkills.map((label) => ({
          profile_id: input.profileId,
          label,
        })));

      if (insertSkillsError) {
        throw insertSkillsError;
      }
    }
  }
}

export async function toggleProfileSkillEndorsement(
  profileSkillId: string,
  endorsedByProfileId: string,
  currentlyEndorsed: boolean,
) {
  const supabase = requireSupabase();
  const { data: skillRow, error: skillError } = await supabase
    .from('profile_skills')
    .select('id, profile_id')
    .eq('id', profileSkillId)
    .maybeSingle();

  if (skillError) {
    throw skillError;
  }

  if (!skillRow) {
    throw new Error('Skill not found.');
  }

  if ((skillRow as { profile_id: string }).profile_id === endorsedByProfileId) {
    throw new Error('You cannot like your own skill.');
  }

  if (currentlyEndorsed) {
    const { error } = await supabase
      .from('profile_skill_endorsements')
      .delete()
      .eq('profile_skill_id', profileSkillId)
      .eq('endorsed_by_profile_id', endorsedByProfileId);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from('profile_skill_endorsements')
    .insert({
      profile_skill_id: profileSkillId,
      endorsed_by_profile_id: endorsedByProfileId,
    });

  if (error) {
    throw error;
  }
}

export async function fetchLobbies(): Promise<Lobby[]> {
  const supabase = requireSupabase();
  const currentProfileId = await fetchCurrentProfileId();
  const [friendIds, inviteRows, joinRequestRows] = await Promise.all([
    currentProfileId ? fetchAcceptedFriendIds(currentProfileId) : Promise.resolve<string[]>([]),
    currentProfileId
      ? supabase
          .from('lobby_invites')
          .select('id, lobby_id, invited_profile_id, invited_by_profile_id, status, created_at')
          .eq('invited_profile_id', currentProfileId)
          .neq('status', 'revoked')
      : Promise.resolve({ data: [] as LobbyInviteRow[], error: null }),
    currentProfileId
      ? supabase
          .from('lobby_join_requests')
          .select('id, lobby_id, requester_profile_id, status, created_at, responded_at, responded_by_profile_id')
          .eq('requester_profile_id', currentProfileId)
      : Promise.resolve({ data: [] as LobbyJoinRequestRow[], error: null }),
  ]);

  const [
    { data: lobbyRows, error: lobbiesError },
    { data: profileRows, error: profilesError },
    { data: membershipRows, error: membershipsError },
    { data: organizerRows, error: organizersError },
  ] = await Promise.all([
    fetchLobbyRows().then((data) => ({ data, error: null })),
    supabase
      .from('profiles')
      .select(PROFILE_SELECT_FIELDS),
    supabase
      .from('lobby_memberships')
      .select('lobby_id, profile_id, status, created_at'),
    supabase
      .from('lobby_organizers')
      .select('lobby_id, profile_id'),
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
  if (organizersError && !isMissingLobbyOrganizersTableError(organizersError)) {
    throw organizersError;
  }
  if (inviteRows.error) {
    throw inviteRows.error;
  }
  if (joinRequestRows.error && !isMissingLobbyJoinRequestsTableError(joinRequestRows.error)) {
    throw joinRequestRows.error;
  }

  const profiles = (profileRows ?? []) as ProfileRow[];
  const competitiveStatsByProfileId = await fetchCompetitiveProfileStats(profiles.map((profile) => profile.id));
  const playersById = new Map<string, Player>(
    profiles.map((profile) => [profile.id, mapProfile(profile, competitiveStatsByProfileId.get(profile.id))]),
  );
  const membershipsByLobby = new Map<string, MembershipRow[]>();
  const organizerIdsByLobby = new Map<string, string[]>();
  const viewerInviteStatusByLobbyId = new Map<string, LobbyInviteStatus>(
    ((inviteRows.data ?? []) as LobbyInviteRow[]).map((row) => [row.lobby_id, row.status]),
  );
  const viewerJoinRequestStatusByLobbyId = new Map<string, LobbyJoinRequestStatus>(
    ((joinRequestRows.data ?? []) as LobbyJoinRequestRow[]).map((row) => [row.lobby_id, row.status]),
  );
  const friendIdsSet = new Set(friendIds);

  for (const membership of (membershipRows ?? []) as MembershipRow[]) {
    const list = membershipsByLobby.get(membership.lobby_id) ?? [];
    list.push(membership);
    membershipsByLobby.set(membership.lobby_id, list);
  }

  for (const organizer of (organizerRows ?? []) as LobbyOrganizerRow[]) {
    const list = organizerIdsByLobby.get(organizer.lobby_id) ?? [];
    list.push(organizer.profile_id);
    organizerIdsByLobby.set(organizer.lobby_id, list);
  }

  return ((lobbyRows ?? []) as LobbyRow[]).map((row) => {
    const lobbyStatus = resolveLobbyStatus(row);
    const memberships = [...(membershipsByLobby.get(row.id) ?? [])].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
    const joinedProfileIds = memberships
      .filter((membership) => membership.status === 'joined')
      .map((membership) => membership.profile_id);
    const waitlistedProfileIds = memberships
      .filter((membership) =>
        membership.status === 'waitlisted'
        || membership.status === 'pending_confirm'
        || membership.status === 'waitlisted_passed',
      )
      .map((membership) => membership.profile_id);
    const pendingWaitlistIds = memberships
      .filter((membership) => membership.status === 'pending_confirm')
      .map((membership) => membership.profile_id);
    const passedWaitlistIds = memberships
      .filter((membership) => membership.status === 'waitlisted_passed')
      .map((membership) => membership.profile_id);
    const players = memberships
      .filter((membership) => membership.status === 'joined')
      .map((membership) => playersById.get(membership.profile_id))
      .filter((player): player is Player => Boolean(player));

    const waitlist = memberships
      .filter((membership) =>
        membership.status === 'waitlisted'
        || membership.status === 'pending_confirm'
        || membership.status === 'waitlisted_passed',
      )
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
      minPointsPerGame: row.min_points_per_game ?? undefined,
      minAge: row.min_age ?? undefined,
      maxAge: row.max_age ?? undefined,
      isPrivate: row.is_private,
      price: row.price ?? undefined,
      description: row.description ?? undefined,
      createdBy: row.created_by,
      organizerIds: [...new Set(organizerIdsByLobby.get(row.id) ?? [])].filter((profileId) => profileId !== row.created_by),
      distanceKm: row.distance_km,
      waitlist,
      pendingWaitlistIds,
      passedWaitlistIds,
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
      viewerJoinRequestStatus: viewerJoinRequestStatusByLobbyId.get(row.id) ?? null,
    };
  }).filter((lobby) => lobby.status !== 'deleted');
}

async function hasLobbyShareAccess(lobbyId: string, shareToken?: string | null) {
  if (!shareToken) {
    return false;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('has_lobby_share_access', {
    target_lobby_id: lobbyId,
    provided_share_token: shareToken,
  });

  if (error) {
    throw error;
  }

  return data === true;
}

export async function fetchLobbyShareToken(lobbyId: string): Promise<string | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('get_lobby_share_token', {
    target_lobby_id: lobbyId,
  });

  if (error) {
    throw error;
  }

  return typeof data === 'string' ? data : null;
}

export async function fetchLobbyById(id: string, options?: { shareToken?: string | null }): Promise<Lobby | null> {
  const lobbies = await fetchLobbies();
  const lobby = lobbies.find((item) => item.id === id) ?? null;

  if (!lobby || lobby.accessType !== 'locked' || lobby.viewerHasAccess) {
    return lobby;
  }

  const shareAccess = await hasLobbyShareAccess(id, options?.shareToken);
  if (!shareAccess) {
    return lobby;
  }

  return {
    ...lobby,
    viewerHasAccess: true,
  };
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
    .select(PROFILE_SELECT_FIELDS)
    .in('id', profileIds);

  if (profilesError) {
    throw profilesError;
  }

  const profiles = (profileRows ?? []) as ProfileRow[];
  const competitiveStatsByProfileId = await fetchCompetitiveProfileStats(profiles.map((profile) => profile.id));
  const playersById = new Map(
    profiles.map((profile) => [profile.id, mapProfile(profile, competitiveStatsByProfileId.get(profile.id))]),
  );

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

export async function fetchLobbyJoinRequests(lobbyId: string): Promise<LobbyJoinRequest[]> {
  const supabase = requireSupabase();
  const { data: requestRows, error: requestsError } = await supabase
    .from('lobby_join_requests')
    .select('id, lobby_id, requester_profile_id, status, created_at, responded_at, responded_by_profile_id')
    .eq('lobby_id', lobbyId)
    .order('created_at', { ascending: false });

  if (requestsError) {
    if (isMissingLobbyJoinRequestsTableError(requestsError)) {
      return [];
    }
    throw requestsError;
  }

  const requests = (requestRows ?? []) as LobbyJoinRequestRow[];
  if (requests.length === 0) {
    return [];
  }

  const profileIds = [...new Set(requests.map((request) => request.requester_profile_id))];
  const { data: profileRows, error: profilesError } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT_FIELDS)
    .in('id', profileIds);

  if (profilesError) {
    throw profilesError;
  }

  const profiles = (profileRows ?? []) as ProfileRow[];
  const competitiveStatsByProfileId = await fetchCompetitiveProfileStats(profiles.map((profile) => profile.id));
  const playersById = new Map(
    profiles.map((profile) => [profile.id, mapProfile(profile, competitiveStatsByProfileId.get(profile.id))]),
  );

  return requests
    .map((request) => {
      const requester = playersById.get(request.requester_profile_id);
      if (!requester) {
        return null;
      }

      const mappedRequest = {
        id: request.id,
        lobbyId: request.lobby_id,
        requesterProfileId: request.requester_profile_id,
        status: request.status,
        createdAt: request.created_at,
        requester,
      };

      return request.responded_at
        ? {
            ...mappedRequest,
            respondedAt: request.responded_at,
          }
        : mappedRequest;
    })
    .filter((request): request is LobbyJoinRequest => request !== null);
}

export async function assignLobbyOrganizer(lobbyId: string, actorProfileId: string, organizerProfileId: string) {
  const supabase = requireSupabase();
  const lobby = await fetchLobbyById(lobbyId);

  if (!lobby) {
    throw new Error('Lobby not found.');
  }

  if (lobby.createdBy !== actorProfileId) {
    throw new Error('Only the lobby creator can assign secondary organizers.');
  }

  if (organizerProfileId === lobby.createdBy) {
    throw new Error('The lobby creator is already an organizer.');
  }

  if (!lobby.players.some((player) => player.id === organizerProfileId)) {
    throw new Error('Secondary organizers must already be joined in the lobby.');
  }

  if (lobby.organizerIds.includes(organizerProfileId)) {
    return;
  }

  const { error } = await supabase
    .from('lobby_organizers')
    .upsert(
      {
        lobby_id: lobbyId,
        profile_id: organizerProfileId,
      },
      { onConflict: 'lobby_id,profile_id' },
    );

  if (error) {
    if (isMissingLobbyOrganizersTableError(error)) {
      throw new Error('Secondary organizers require the latest Supabase patch. Apply it and try again.');
    }
    throw error;
  }
}

export async function removeLobbyOrganizer(lobbyId: string, actorProfileId: string, organizerProfileId: string) {
  const supabase = requireSupabase();
  const lobby = await fetchLobbyById(lobbyId);

  if (!lobby) {
    throw new Error('Lobby not found.');
  }

  if (lobby.createdBy !== actorProfileId) {
    throw new Error('Only the lobby creator can remove secondary organizers.');
  }

  const { error } = await supabase
    .from('lobby_organizers')
    .delete()
    .eq('lobby_id', lobbyId)
    .eq('profile_id', organizerProfileId);

  if (error) {
    if (isMissingLobbyOrganizersTableError(error)) {
      throw new Error('Secondary organizers require the latest Supabase patch. Apply it and try again.');
    }
    throw error;
  }
}

export async function fetchLobbyMessages(lobbyId: string): Promise<LobbyMessage[]> {
  const supabase = requireSupabase();
  const { data: messageRows, error: messagesError } = await supabase
    .from('lobby_messages')
    .select('id, lobby_id, profile_id, body, created_at')
    .eq('lobby_id', lobbyId)
    .order('created_at', { ascending: false })
    .limit(120);

  if (messagesError) {
    if (isMissingLobbyMessagesTableError(messagesError)) {
      return [];
    }
    throw messagesError;
  }

  const messages = ((messageRows ?? []) as LobbyMessageRow[]).reverse();
  if (messages.length === 0) {
    return [];
  }

  const profileIds = [...new Set(messages.map((message) => message.profile_id))];
  const { data: profileRows, error: profilesError } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT_FIELDS)
    .in('id', profileIds);

  if (profilesError) {
    throw profilesError;
  }

  const profiles = (profileRows ?? []) as ProfileRow[];
  const competitiveStatsByProfileId = await fetchCompetitiveProfileStats(profiles.map((profile) => profile.id));
  const playersById = new Map(
    profiles.map((profile) => [profile.id, mapProfile(profile, competitiveStatsByProfileId.get(profile.id))]),
  );

  return messages
    .map((message) => {
      const author = playersById.get(message.profile_id);
      if (!author) {
        return null;
      }

      return {
        id: message.id,
        lobbyId: message.lobby_id,
        profileId: message.profile_id,
        body: message.body,
        createdAt: message.created_at,
        author,
      };
    })
    .filter((message): message is LobbyMessage => message !== null);
}

export async function createLobbyMessage(lobbyId: string, profileId: string, body: string) {
  const messageBody = normalizeText(body).slice(0, 500);
  if (messageBody.length === 0) {
    throw new Error('Message cannot be empty.');
  }

  const [lobby, profile] = await Promise.all([
    fetchLobbyById(lobbyId),
    fetchProfileById(profileId),
  ]);

  if (!lobby) {
    throw new Error('Lobby not found.');
  }

  if (!profile) {
    throw new Error('Failed to resolve the sender.');
  }

  const isParticipant =
    lobby.createdBy === profileId
    || lobby.players.some((player) => player.id === profileId)
    || lobby.waitlist.some((player) => player.id === profileId);

  if (!isParticipant) {
    throw new Error('Only lobby participants can send chat messages.');
  }

  const supabase = requireSupabase();
  const { error } = await supabase
    .from('lobby_messages')
    .insert({
      lobby_id: lobbyId,
      profile_id: profileId,
      body: messageBody,
    });

  if (error) {
    if (isMissingLobbyMessagesTableError(error)) {
      throw new Error('Lobby chat requires the latest Supabase patch. Apply it and try again.');
    }
    throw error;
  }
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
    .select(PROFILE_SELECT_FIELDS)
    .in('id', profileIds);

  if (profilesError) {
    throw profilesError;
  }

  const profiles = (profileRows ?? []) as ProfileRow[];
  const competitiveStatsByProfileId = await fetchCompetitiveProfileStats(profiles.map((profile) => profile.id));
  const playersById = new Map(
    profiles.map((profile) => [profile.id, mapProfile(profile, competitiveStatsByProfileId.get(profile.id))]),
  );
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

  if (!canManageLobby(lobby, actorProfileId)) {
    throw new Error('Only the lobby organizer team can create teams.');
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

  if (!canManageLobby(lobby, actorProfileId)) {
    throw new Error('Only the lobby organizer team can edit teams.');
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

  const [teamRowsResult, teamResultsResult, submittedByProfileResult, pointEventsResult] = await Promise.all([
    supabase
      .from('lobby_teams')
      .select('id, lobby_id, color, team_number, locked_at')
      .eq('lobby_id', lobbyId),
    supabase
      .from('lobby_team_results')
      .select('lobby_id, lobby_team_id, wins, rank, awarded_points')
      .eq('lobby_id', lobbyId),
    supabase
      .from('profiles')
      .select('id, name')
      .eq('id', (resultRow as LobbyResultRow).submitted_by_profile_id)
      .maybeSingle(),
    supabase
      .from('competitive_point_events')
      .select('profile_id, team_number, points')
      .eq('lobby_id', lobbyId),
  ]);

  if (teamRowsResult.error) {
    throw teamRowsResult.error;
  }

  if (teamResultsResult.error) {
    throw teamResultsResult.error;
  }
  if (submittedByProfileResult.error) {
    throw submittedByProfileResult.error;
  }
  if (pointEventsResult.error) {
    throw pointEventsResult.error;
  }

  const teamsById = new Map(((teamRowsResult.data ?? []) as LobbyTeamRow[]).map((row) => [row.id, row]));
  const pointSummaryByTeamNumber = new Map<number, { min: number; max: number; byProfileId: Record<string, number> }>();

  for (const row of (pointEventsResult.data ?? []) as Array<Pick<CompetitivePointEventRow, 'profile_id' | 'team_number' | 'points'>>) {
    const current = pointSummaryByTeamNumber.get(row.team_number) ?? {
      min: row.points,
      max: row.points,
      byProfileId: {},
    };

    current.min = Math.min(current.min, row.points);
    current.max = Math.max(current.max, row.points);
    current.byProfileId[row.profile_id] = row.points;
    pointSummaryByTeamNumber.set(row.team_number, current);
  }

  const teamResults = ((teamResultsResult.data ?? []) as LobbyTeamResultRow[])
    .map((row) => {
      const team = teamsById.get(row.lobby_team_id);
      if (!team) {
        return null as LobbyTeamStanding | null;
      }

      const pointSummary = pointSummaryByTeamNumber.get(team.team_number);

      return {
        lobbyId: row.lobby_id,
        lobbyTeamId: row.lobby_team_id,
        wins: row.wins,
        rank: row.rank,
        awardedPoints: pointSummary?.min ?? row.awarded_points,
        awardedPointsMax: pointSummary?.max ?? row.awarded_points,
        playerAwardedPoints: pointSummary?.byProfileId,
        teamColor: team.color,
        teamNumber: team.team_number,
      } satisfies LobbyTeamStanding;
    })
    .filter((row): row is LobbyTeamStanding => row !== null)
    .sort((left, right) => left.teamNumber - right.teamNumber);

  const result = resultRow as LobbyResultRow;
  return {
    lobbyId: result.lobby_id,
    submittedByProfileId: result.submitted_by_profile_id,
    submittedByProfileName:
      submittedByProfileResult.data && typeof submittedByProfileResult.data.name === 'string'
        ? submittedByProfileResult.data.name
        : undefined,
    submittedAt: result.submitted_at,
    notes: result.notes ?? undefined,
    teamResults,
  };
}

export async function fetchPendingLobbyResultReminders(profileId: string): Promise<PendingLobbyResultReminder[]> {
  const supabase = requireSupabase();
  const [
    { data: ownedLobbyRows, error: ownedLobbiesError },
    { data: organizerRows, error: organizerRowsError },
  ] = await Promise.all([
    supabase
      .from('lobbies')
      .select('id')
      .eq('created_by', profileId)
      .eq('game_type', 'competitive'),
    supabase
      .from('lobby_organizers')
      .select('lobby_id, profile_id')
      .eq('profile_id', profileId),
  ]);

  if (ownedLobbiesError) {
    throw ownedLobbiesError;
  }
  if (organizerRowsError && !isMissingLobbyOrganizersTableError(organizerRowsError)) {
    throw organizerRowsError;
  }

  const organizerLobbyIds = ((organizerRows ?? []) as LobbyOrganizerRow[]).map((row) => row.lobby_id);
  const ownedLobbyIds = ((ownedLobbyRows ?? []) as Array<{ id: string }>).map((row) => row.id);
  const candidateLobbyIds = [...new Set([...ownedLobbyIds, ...organizerLobbyIds])];

  if (candidateLobbyIds.length === 0) {
    return [];
  }

  const withStatus = await supabase
    .from('lobbies')
    .select('id, title, datetime, created_by, game_type, status')
    .in('id', candidateLobbyIds);

  let lobbyRows: LobbyResultReminderLobbyRow[];
  if (!withStatus.error) {
    lobbyRows = (withStatus.data ?? []) as LobbyResultReminderLobbyRow[];
  } else if (isMissingLobbyOptionalColumnError(withStatus.error)) {
    const fallback = await supabase
      .from('lobbies')
      .select('id, title, datetime, created_by, game_type')
      .in('id', candidateLobbyIds);

    if (fallback.error) {
      throw fallback.error;
    }

    lobbyRows = ((fallback.data ?? []) as LobbyResultReminderLobbyRow[]).map((row) => ({
      ...row,
      status: 'active',
    }));
  } else {
    throw withStatus.error;
  }

  const [
    { data: membershipRows, error: membershipRowsError },
    { data: teamRows, error: teamRowsError },
    { data: resultRows, error: resultRowsError },
  ] = await Promise.all([
    supabase
      .from('lobby_memberships')
      .select('lobby_id, status')
      .eq('profile_id', profileId)
      .eq('status', 'joined')
      .in('lobby_id', candidateLobbyIds),
    supabase
      .from('lobby_teams')
      .select('lobby_id')
      .in('lobby_id', candidateLobbyIds),
    supabase
      .from('lobby_results')
      .select('lobby_id')
      .in('lobby_id', candidateLobbyIds),
  ]);

  if (membershipRowsError) {
    throw membershipRowsError;
  }
  if (teamRowsError) {
    throw teamRowsError;
  }
  if (resultRowsError) {
    throw resultRowsError;
  }

  const joinedOrganizerLobbyIds = new Set(
    ((membershipRows ?? []) as Array<{ lobby_id: string; status: MembershipRow['status'] }>).map((row) => row.lobby_id),
  );
  const resultLobbyIds = new Set(
    ((resultRows ?? []) as Array<{ lobby_id: string }>).map((row) => row.lobby_id),
  );
  const teamCountByLobbyId = new Map<string, number>();

  for (const row of (teamRows ?? []) as Array<{ lobby_id: string }>) {
    teamCountByLobbyId.set(row.lobby_id, (teamCountByLobbyId.get(row.lobby_id) ?? 0) + 1);
  }

  const reminderCandidates: LobbyResultReminderCandidate[] = lobbyRows
    .filter((row) => row.status !== 'deleted')
    .map((row) => ({
      lobbyId: row.id,
      lobbyTitle: row.title,
      lobbyDatetime: row.datetime,
      gameType: row.game_type ?? 'friendly',
      isManagedByViewer: row.created_by === profileId || joinedOrganizerLobbyIds.has(row.id),
      hasResult: resultLobbyIds.has(row.id),
      teamCount: teamCountByLobbyId.get(row.id) ?? 0,
    }));

  return buildPendingLobbyResultReminders(reminderCandidates);
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
  const [
    { data: lobbyRows, error: lobbiesError },
    { data: resultRows, error: resultsError },
    { data: teamResultRows, error: teamResultsError },
  ] = await Promise.all([
    supabase
      .from('lobbies')
      .select('id, title, city, datetime')
      .in('id', lobbyIds),
    supabase
      .from('lobby_results')
      .select('lobby_id, notes')
      .in('lobby_id', lobbyIds),
    supabase
      .from('lobby_team_results')
      .select('lobby_id, rank')
      .in('lobby_id', lobbyIds),
  ]);

  if (lobbiesError) {
    throw lobbiesError;
  }

  if (resultsError) {
    throw resultsError;
  }
  if (teamResultsError) {
    throw teamResultsError;
  }

  const lobbyById = new Map(
    ((lobbyRows ?? []) as Array<{ id: string; title: string; city: string; datetime: string }>).map((row) => [row.id, row]),
  );
  const resultByLobbyId = new Map(
    ((resultRows ?? []) as LobbyResultRow[]).map((row) => [row.lobby_id, row]),
  );
  const maxRankByLobbyId = new Map<string, number>();

  for (const row of (teamResultRows ?? []) as Array<{ lobby_id: string; rank: number }>) {
    maxRankByLobbyId.set(row.lobby_id, Math.max(maxRankByLobbyId.get(row.lobby_id) ?? 0, row.rank));
  }

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
      maxRank: maxRankByLobbyId.get(event.lobby_id) || undefined,
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

  if (!canManageLobby(lobby, submittedByProfileId)) {
    throw new Error('Only the lobby organizer team can submit the result.');
  }

  if (lobby.gameType !== 'competitive') {
    throw new Error('Results are only available for competitive lobbies.');
  }

  if (!canSubmitLobbyResult(lobby.datetime)) {
    throw new Error('You can submit the result about two hours after the scheduled kickoff.');
  }

  const [existingResult, teamAssignments] = await Promise.all([
    fetchLobbyResult(lobbyId),
    fetchLobbyTeams(lobbyId),
  ]);

  if (existingResult) {
    throw new Error('Another organizer already submitted the result for this lobby.');
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
      players: assignment.players.map((player) => ({
        profileId: player.id,
        competitivePoints: player.competitivePoints ?? 0,
      })),
    })),
  );

  const { error: resultInsertError } = await supabase.from('lobby_results').insert({
    lobby_id: lobbyId,
    submitted_by_profile_id: submittedByProfileId,
    notes: notes ? normalizeText(notes) : null,
  });

  if (resultInsertError) {
    if (isDuplicateLobbyResultError(resultInsertError)) {
      throw new Error('Another organizer already submitted the result for this lobby.');
    }
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

    return assignment.players.map((player) => {
      const playerAward = standing.playerAwards.find((award) => award.profileId === player.id);
      if (!playerAward) {
        throw new Error('Failed to map player points to the submitted team.');
      }

      return {
        lobby_id: lobbyId,
        profile_id: player.id,
        awarded_by_profile_id: submittedByProfileId,
        team_color: standing.color,
        team_number: standing.teamNumber,
        wins: standing.wins,
        rank: standing.rank,
        points: playerAward.awardedPoints,
        reason: 'competitive_lobby_result',
      };
    });
  });
  const resultNotifications = teamAssignments.flatMap((assignment) => {
    const standing = standingByTeamId.get(assignment.team.id);
    if (!standing) {
      throw new Error('Failed to map standings to teams.');
    }

    return assignment.players.map((player) => {
      const playerAward = standing.playerAwards.find((award) => award.profileId === player.id);
      if (!playerAward) {
        throw new Error('Failed to map player points to the result notification.');
      }

      return {
        profileId: player.id,
        teamColor: standing.color,
        wins: standing.wins,
        rank: standing.rank,
        points: playerAward.awardedPoints,
      };
    });
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
          .update({ competitive_points: Math.max(0, currentPoints + awardedPoints) })
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
  minPointsPerGame?: number;
  minAge?: number;
  maxAge?: number;
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
    minPointsPerGame: input.gameType === 'competitive' ? input.minPointsPerGame : undefined,
    minAge: input.minAge,
    maxAge: input.maxAge,
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
    min_points_per_game: input.gameType === 'competitive' ? (input.minPointsPerGame ?? null) : null,
    min_age: input.minAge ?? null,
    max_age: input.maxAge ?? null,
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
      min_points_per_game: lobbyPayload.min_points_per_game,
      min_age: lobbyPayload.min_age,
      max_age: lobbyPayload.max_age,
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

  return id;
}

export async function upsertLobbyMembership(
  lobbyId: string,
  profileId: string,
  status: MembershipRow['status'],
  options?: { shareToken?: string | null },
) {
  const supabase = requireSupabase();
  let shouldMarkInviteAccepted = false;

  if (status === 'joined' || status === 'waitlisted') {
    const [lobby, profile] = await Promise.all([fetchLobbyById(lobbyId), fetchProfileById(profileId)]);
    const resolvedLobby = lobby;
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
      const shareAccess = await hasLobbyShareAccess(lobbyId, options?.shareToken);
      if (!hasFriendInside && !isInvited && !shareAccess) {
        throw new Error('This locked lobby is available only to invited players, players with the share link, or friends of current participants.');
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

  if (status === 'joined' || status === 'waitlisted') {
    await markWaitlistSpotNotificationsHandled(profileId, lobbyId);
  }

  await syncLobbyWaitlistState(lobbyId, profileId);
}

export async function passLobbyWaitlistSpot(lobbyId: string, profileId: string) {
  const lobby = await fetchLobbyById(lobbyId);
  if (!lobby) {
    throw new Error('Lobby not found.');
  }

  if (!(lobby.pendingWaitlistIds ?? []).includes(profileId)) {
    throw new Error('The available spot is no longer reserved for you.');
  }

  await updateMembershipStatus(lobbyId, profileId, 'waitlisted_passed');
  await markWaitlistSpotNotificationsHandled(profileId, lobbyId);

  await syncLobbyWaitlistState(lobbyId, profileId);
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

export async function requestLobbyAccess(lobbyId: string, requesterProfileId: string) {
  const supabase = requireSupabase();
  const [lobby, requester] = await Promise.all([
    fetchLobbyById(lobbyId),
    fetchProfileById(requesterProfileId),
  ]);

  if (!lobby) {
    throw new Error('Lobby not found.');
  }

  if (!requester) {
    throw new Error('Failed to resolve the requesting player.');
  }

  if (lobby.accessType !== 'locked') {
    throw new Error('Access requests are available only for locked lobbies.');
  }

  if (lobby.createdBy === requesterProfileId) {
    throw new Error('You already manage this lobby.');
  }

  if (lobby.viewerHasAccess) {
    throw new Error('You already have access to this lobby.');
  }

  if (lobby.players.some((player) => player.id === requesterProfileId) || lobby.waitlist.some((player) => player.id === requesterProfileId)) {
    throw new Error('You are already part of this lobby.');
  }

  if (lobby.viewerJoinRequestStatus === 'pending') {
    throw new Error('You already have a pending request for this lobby.');
  }

  const { error } = await supabase.from('lobby_join_requests').upsert(
    {
      lobby_id: lobbyId,
      requester_profile_id: requesterProfileId,
      status: 'pending',
      responded_at: null,
      responded_by_profile_id: null,
    },
    { onConflict: 'lobby_id,requester_profile_id' },
  );

  if (error) {
    throw error;
  }

  await createLobbyJoinRequestNotification(requesterProfileId, requester.name, lobby.createdBy, lobby);
}

export async function approveLobbyJoinRequest(lobbyId: string, requesterProfileId: string, actorProfileId: string) {
  const supabase = requireSupabase();
  const [lobby, requester] = await Promise.all([
    fetchLobbyById(lobbyId),
    fetchProfileById(requesterProfileId),
  ]);

  if (!lobby) {
    throw new Error('Lobby not found.');
  }

  if (!requester) {
    throw new Error('Failed to resolve the requesting player.');
  }

  if (!canManageLobby(lobby, actorProfileId)) {
    throw new Error('Only the lobby organizer team can approve access requests.');
  }

  if (lobby.players.some((player) => player.id === requesterProfileId) || lobby.waitlist.some((player) => player.id === requesterProfileId)) {
    throw new Error('This player is already part of the lobby.');
  }

  const membershipStatus = getJoinLobbyTargetStatus(lobby);
  const { error: membershipError } = await supabase.from('lobby_memberships').upsert(
    {
      lobby_id: lobbyId,
      profile_id: requesterProfileId,
      status: membershipStatus,
    },
    { onConflict: 'lobby_id,profile_id' },
  );

  if (membershipError) {
    throw membershipError;
  }

  const timestamp = new Date().toISOString();
  const { error: requestError } = await supabase
    .from('lobby_join_requests')
    .update({
      status: 'approved',
      responded_at: timestamp,
      responded_by_profile_id: actorProfileId,
    })
    .eq('lobby_id', lobbyId)
    .eq('requester_profile_id', requesterProfileId)
    .eq('status', 'pending');

  if (requestError) {
    throw requestError;
  }

  await syncLobbyWaitlistState(lobbyId, actorProfileId);

  await markLobbyJoinRequestNotificationsHandled(requesterProfileId, lobbyId, actorProfileId);
  await createLobbyJoinRequestResolutionNotification(actorProfileId, requesterProfileId, lobby, 'approved', membershipStatus);
}

export async function declineLobbyJoinRequest(lobbyId: string, requesterProfileId: string, actorProfileId: string) {
  const supabase = requireSupabase();
  const lobby = await fetchLobbyById(lobbyId);

  if (!lobby) {
    throw new Error('Lobby not found.');
  }

  if (!canManageLobby(lobby, actorProfileId)) {
    throw new Error('Only the lobby organizer team can decline access requests.');
  }

  const timestamp = new Date().toISOString();
  const { error } = await supabase
    .from('lobby_join_requests')
    .update({
      status: 'declined',
      responded_at: timestamp,
      responded_by_profile_id: actorProfileId,
    })
    .eq('lobby_id', lobbyId)
    .eq('requester_profile_id', requesterProfileId)
    .eq('status', 'pending');

  if (error) {
    throw error;
  }

  await markLobbyJoinRequestNotificationsHandled(requesterProfileId, lobbyId, actorProfileId);
  await createLobbyJoinRequestResolutionNotification(actorProfileId, requesterProfileId, lobby, 'declined');
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

  await markWaitlistSpotNotificationsHandled(profileId, lobbyId);

  await syncLobbyWaitlistState(lobbyId, profileId);
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
  minPointsPerGame?: number;
  minAge?: number;
  maxAge?: number;
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
      min_points_per_game: input.gameType === 'competitive' ? (input.minPointsPerGame ?? null) : null,
      min_age: input.minAge ?? null,
      max_age: input.maxAge ?? null,
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

function mapRecentSearchEntry(row: RecentSearchEntryRow): SearchHistoryEntry {
  return {
    id: row.id,
    kind: row.kind,
    queryText: row.query_text ?? undefined,
    targetId: row.target_id ?? undefined,
    label: row.label,
    actedAt: row.acted_at,
  };
}

export async function fetchUserPreferences(profileId: string): Promise<{
  themeMode: ThemeMode;
  language: 'he' | 'en';
  notificationPreferences: NotificationPreferences;
} | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('user_preferences')
    .select('profile_id, theme_mode, language, notification_preferences')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) {
    if (isMissingUserPreferencesTableError(error)) {
      return null;
    }

    throw error;
  }

  const row = data as UserPreferencesRow | null;
  if (!row) {
    return null;
  }

  return {
    themeMode: row.theme_mode ?? 'system',
    language: row.language ?? 'he',
    notificationPreferences: normalizeNotificationPreferences(row.notification_preferences),
  };
}

export async function saveUserPreferences(
  profileId: string,
  input: {
    themeMode: ThemeMode;
    language: 'he' | 'en';
    notificationPreferences: NotificationPreferences;
  },
) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      profile_id: profileId,
      theme_mode: input.themeMode,
      language: input.language,
      notification_preferences: normalizeNotificationPreferences(input.notificationPreferences),
    }, { onConflict: 'profile_id' });

  if (error && !isMissingUserPreferencesTableError(error)) {
    throw error;
  }
}

export async function fetchRecentSearchEntries(profileId: string): Promise<SearchHistoryEntry[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('recent_search_entries')
    .select('id, profile_id, kind, query_text, target_id, label, acted_at')
    .eq('profile_id', profileId)
    .order('acted_at', { ascending: false })
    .limit(24);

  if (error) {
    if (isMissingRecentSearchEntriesTableError(error)) {
      return [];
    }

    throw error;
  }

  return ((data ?? []) as RecentSearchEntryRow[]).map(mapRecentSearchEntry);
}

async function trimRecentSearchEntries(profileId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('recent_search_entries')
    .select('id, kind, acted_at')
    .eq('profile_id', profileId)
    .order('acted_at', { ascending: false });

  if (error) {
    if (isMissingRecentSearchEntriesTableError(error)) {
      return;
    }

    throw error;
  }

  const rows = (data ?? []) as Array<{ id: string; kind: 'query' | 'profile' | 'lobby'; acted_at: string }>;
  const removableIds = rows
    .filter((row, index) => {
      if (row.kind === 'query') {
        const priorQueries = rows
          .slice(0, index + 1)
          .filter((candidate) => candidate.kind === 'query')
          .length;
        return priorQueries > SEARCH_HISTORY_LIMIT;
      }

      const priorOpened = rows
        .slice(0, index + 1)
        .filter((candidate) => candidate.kind !== 'query')
        .length;
      return priorOpened > SEARCH_HISTORY_LIMIT;
    })
    .map((row) => row.id);

  if (removableIds.length === 0) {
    return;
  }

  const { error: deleteError } = await supabase
    .from('recent_search_entries')
    .delete()
    .in('id', removableIds);

  if (deleteError && !isMissingRecentSearchEntriesTableError(deleteError)) {
    throw deleteError;
  }
}

export async function saveRecentSearchQuery(profileId: string, query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return;
  }

  const supabase = requireSupabase();
  const { error } = await supabase
    .from('recent_search_entries')
    .insert({
      profile_id: profileId,
      kind: 'query',
      query_text: normalizedQuery,
      target_id: null,
      label: normalizedQuery,
    });

  if (error) {
    if (isMissingRecentSearchEntriesTableError(error)) {
      return;
    }

    throw error;
  }

  await trimRecentSearchEntries(profileId);
}

export async function saveRecentSearchTap(
  profileId: string,
  input: {
    kind: 'profile' | 'lobby';
    targetId: string;
    label: string;
  },
) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('recent_search_entries')
    .insert({
      profile_id: profileId,
      kind: input.kind,
      query_text: null,
      target_id: input.targetId,
      label: normalizeText(input.label),
    });

  if (error) {
    if (isMissingRecentSearchEntriesTableError(error)) {
      return;
    }

    throw error;
  }

  await trimRecentSearchEntries(profileId);
}

export async function clearRecentSearchHistory(profileId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('recent_search_entries')
    .delete()
    .eq('profile_id', profileId);

  if (error && !isMissingRecentSearchEntriesTableError(error)) {
    throw error;
  }
}

export async function fetchSearchResults(query: string, viewerProfileId?: string | null): Promise<SearchResult[]> {
  const normalizedQuery = normalizeText(query).toLocaleLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const currentProfileId = viewerProfileId ?? await fetchCurrentProfileId();
  const [profiles, lobbies, friendRowsResult] = await Promise.all([
    fetchProfiles(),
    fetchLobbies(),
    currentProfileId
      ? requireSupabase()
          .from('friend_requests')
          .select('from_profile_id, to_profile_id, status')
          .or(`from_profile_id.eq.${currentProfileId},to_profile_id.eq.${currentProfileId}`)
      : Promise.resolve({ data: [] as FriendRequestListRow[], error: null }),
  ]);

  if (friendRowsResult.error) {
    throw friendRowsResult.error;
  }

  const friendStatusByProfileId = new Map<string, 'friend' | 'sent' | 'received'>();
  for (const row of (friendRowsResult.data ?? []) as FriendRequestListRow[]) {
    const candidateId = row.from_profile_id === currentProfileId ? row.to_profile_id : row.from_profile_id;
    if (row.status === 'accepted') {
      friendStatusByProfileId.set(candidateId, 'friend');
    } else if (row.status === 'pending') {
      friendStatusByProfileId.set(candidateId, row.from_profile_id === currentProfileId ? 'sent' : 'received');
    }
  }

  const profileResults = profiles
    .filter((profile) => profile.id !== currentProfileId)
    .filter((profile) => `${profile.name} ${profile.position ?? ''} ${profile.bio ?? ''}`.toLocaleLowerCase().includes(normalizedQuery))
    .slice(0, 6)
    .map((profile) => {
      const status = friendStatusByProfileId.get(profile.id);
      const pendingState: 'sent' | 'received' | undefined =
        status === 'sent' ? 'sent' : status === 'received' ? 'received' : undefined;

      return {
        kind: 'profile' as const,
        id: profile.id,
        title: profile.name,
        subtitle: profile.position ?? profile.bio ?? undefined,
        imageUrl: profile.photoUrl,
        initials: profile.initials,
        avatarColor: profile.avatarColor,
        competitivePoints: profile.competitivePoints,
        isFriend: status === 'friend',
        pendingState,
      };
    });

  const lobbyResults = lobbies
    .filter((lobby) => lobby.status === 'active')
    .filter((lobby) => `${lobby.title} ${lobby.city} ${lobby.address}`.toLocaleLowerCase().includes(normalizedQuery))
    .slice(0, 6)
    .map((lobby) => ({
      kind: 'lobby' as const,
      id: lobby.id,
      title: lobby.title,
      subtitle: `${lobby.city} · ${new Date(lobby.datetime).toLocaleDateString('en-GB')}`,
      city: lobby.city,
      gameType: lobby.gameType,
      joinedCount: lobby.players.length,
      maxPlayers: lobby.maxPlayers,
      viewerHasAccess: lobby.viewerHasAccess,
      accessType: lobby.accessType ?? 'open',
    }));

  return [...profileResults, ...lobbyResults];
}

export async function fetchFriendRequestLists(profileId: string): Promise<{
  received: FriendRequestListItem[];
  sent: FriendRequestListItem[];
}> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('friend_requests')
    .select('from_profile_id, to_profile_id, status, created_at')
    .eq('status', 'pending')
    .or(`from_profile_id.eq.${profileId},to_profile_id.eq.${profileId}`);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as FriendRequestListRow[];
  const players = await fetchProfiles();
  const playersById = new Map(players.map((player) => [player.id, player]));

  const received = rows
    .filter((row) => row.to_profile_id === profileId)
    .map((row) => ({
      id: row.from_profile_id,
      user: playersById.get(row.from_profile_id),
      createdAt: row.created_at,
    }))
    .filter((item): item is { id: string; user: Player; createdAt: string | undefined } => Boolean(item.user));

  const sent = rows
    .filter((row) => row.from_profile_id === profileId)
    .map((row) => ({
      id: row.to_profile_id,
      user: playersById.get(row.to_profile_id),
      createdAt: row.created_at,
    }))
    .filter((item): item is { id: string; user: Player; createdAt: string | undefined } => Boolean(item.user));

  return { received, sent };
}

export async function fetchNetworkRecommendations(profileId: string): Promise<NetworkRecommendation[]> {
  const supabase = requireSupabase();
  const [
    players,
    friendRowsResult,
    membershipRowsResult,
    viewerTeamRowsResult,
    teamMemberRowsResult,
    lobbyRowsResult,
  ] = await Promise.all([
    fetchProfiles(),
    supabase
      .from('friend_requests')
      .select('from_profile_id, to_profile_id, status'),
    supabase
      .from('lobby_memberships')
      .select('lobby_id, profile_id, status, created_at')
      .eq('status', 'joined'),
    supabase
      .from('lobby_team_members')
      .select('lobby_id, lobby_team_id, profile_id')
      .eq('profile_id', profileId),
    supabase
      .from('lobby_team_members')
      .select('lobby_id, lobby_team_id, profile_id'),
    supabase
      .from('lobbies')
      .select('id, datetime'),
  ]);

  if (friendRowsResult.error) {
    throw friendRowsResult.error;
  }
  if (membershipRowsResult.error) {
    throw membershipRowsResult.error;
  }
  if (viewerTeamRowsResult.error) {
    throw viewerTeamRowsResult.error;
  }
  if (teamMemberRowsResult.error) {
    throw teamMemberRowsResult.error;
  }
  if (lobbyRowsResult.error) {
    throw lobbyRowsResult.error;
  }

  const adjacency = new Map<string, Set<string>>();
  const sentOrPending = new Set<string>();
  const receivedPending = new Set<string>();
  const directFriends = new Set<string>();

  for (const row of (friendRowsResult.data ?? []) as FriendRequestListRow[]) {
    const fromSet = adjacency.get(row.from_profile_id) ?? new Set<string>();
    const toSet = adjacency.get(row.to_profile_id) ?? new Set<string>();
    if (row.status === 'accepted') {
      fromSet.add(row.to_profile_id);
      toSet.add(row.from_profile_id);
      adjacency.set(row.from_profile_id, fromSet);
      adjacency.set(row.to_profile_id, toSet);
      if (row.from_profile_id === profileId) {
        directFriends.add(row.to_profile_id);
      }
      if (row.to_profile_id === profileId) {
        directFriends.add(row.from_profile_id);
      }
    } else if (row.status === 'pending') {
      if (row.from_profile_id === profileId) {
        sentOrPending.add(row.to_profile_id);
      }
      if (row.to_profile_id === profileId) {
        receivedPending.add(row.from_profile_id);
      }
    }
  }

  const viewerLobbyIds = new Set(
    ((membershipRowsResult.data ?? []) as MembershipRow[])
      .filter((row) => row.profile_id === profileId)
      .map((row) => row.lobby_id),
  );
  const lobbyDateById = new Map(
    ((lobbyRowsResult.data ?? []) as Array<{ id: string; datetime: string }>).map((row) => [row.id, row.datetime]),
  );
  const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);

  const sharedLobbiesByProfile = new Map<string, Set<string>>();
  const recentInteractionsByProfile = new Map<string, number>();

  for (const row of (membershipRowsResult.data ?? []) as MembershipRow[]) {
    if (!viewerLobbyIds.has(row.lobby_id) || row.profile_id === profileId) {
      continue;
    }

    const current = sharedLobbiesByProfile.get(row.profile_id) ?? new Set<string>();
    current.add(row.lobby_id);
    sharedLobbiesByProfile.set(row.profile_id, current);

    const lobbyDatetime = lobbyDateById.get(row.lobby_id);
    if (lobbyDatetime && new Date(lobbyDatetime).getTime() >= sixtyDaysAgo) {
      recentInteractionsByProfile.set(row.profile_id, (recentInteractionsByProfile.get(row.profile_id) ?? 0) + 1);
    }
  }

  const viewerTeamIds = new Set(
    ((viewerTeamRowsResult.data ?? []) as LobbyTeamMemberRow[]).map((row) => row.lobby_team_id),
  );
  const sameTeamLobbiesByProfile = new Map<string, Set<string>>();

  for (const row of (teamMemberRowsResult.data ?? []) as LobbyTeamMemberRow[]) {
    if (row.profile_id === profileId || !viewerTeamIds.has(row.lobby_team_id)) {
      continue;
    }

    const current = sameTeamLobbiesByProfile.get(row.profile_id) ?? new Set<string>();
    current.add(row.lobby_id);
    sameTeamLobbiesByProfile.set(row.profile_id, current);

    const lobbyDatetime = lobbyDateById.get(row.lobby_id);
    if (lobbyDatetime && new Date(lobbyDatetime).getTime() >= sixtyDaysAgo) {
      recentInteractionsByProfile.set(row.profile_id, (recentInteractionsByProfile.get(row.profile_id) ?? 0) + 1);
    }
  }

  const recommendations: NetworkRecommendation[] = [];

  for (const player of players) {
    if (
      player.id === profileId
      || directFriends.has(player.id)
      || sentOrPending.has(player.id)
      || receivedPending.has(player.id)
    ) {
      continue;
    }

    const mutualFriends = [...directFriends].filter((friendId) => adjacency.get(player.id)?.has(friendId)).length;
    const sharedLobbies = sharedLobbiesByProfile.get(player.id)?.size ?? 0;
    const sameTeamLobbies = sameTeamLobbiesByProfile.get(player.id)?.size ?? 0;
    const recentInteractions = recentInteractionsByProfile.get(player.id) ?? 0;
    const score =
      (mutualFriends * 30)
      + (sharedLobbies * 15)
      + (sameTeamLobbies * 20)
      + (recentInteractions > 0 ? 20 : 0);

    if (score === 0) {
      continue;
    }

    const reasons: string[] = [];
    if (mutualFriends > 0) {
      reasons.push(`${mutualFriends} mutual friend${mutualFriends === 1 ? '' : 's'}`);
    }
    if (sharedLobbies > 0) {
      reasons.push(`${sharedLobbies} shared lobb${sharedLobbies === 1 ? 'y' : 'ies'}`);
    }
    if (sameTeamLobbies > 0) {
      reasons.push(`${sameTeamLobbies} same-team match${sameTeamLobbies === 1 ? '' : 'es'}`);
    }
    if (recentInteractions > 0) {
      reasons.push('recent activity');
    }

    recommendations.push({
      profile: player,
      score,
      mutualFriends,
      sharedLobbies,
      sameTeamLobbies,
      recentInteractions,
      reasons,
    });
  }

  return recommendations.sort((left, right) =>
    right.score - left.score
    || left.profile.name.localeCompare(right.profile.name),
  );
}

function rankEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  let currentRank = 0;
  let lastValue: number | null = null;
  return entries.map((entry, index) => {
    if (lastValue !== entry.value) {
      currentRank = index + 1;
      lastValue = entry.value;
    }

    return {
      ...entry,
      rank: currentRank,
    };
  });
}

export async function fetchLeaderboardStats(): Promise<LeaderboardStats> {
  const supabase = requireSupabase();
  const [players, pointEventsResult] = await Promise.all([
    fetchProfiles(),
    supabase
      .from('competitive_point_events')
      .select('profile_id, lobby_id, rank, created_at'),
  ]);

  if (pointEventsResult.error) {
    throw pointEventsResult.error;
  }

  const playersById = new Map(players.map((player) => [player.id, player]));
  const pointEvents = (pointEventsResult.data ?? []) as Array<{
    profile_id: string;
    lobby_id: string;
    rank: number;
    created_at: string;
  }>;

  const allTimePoints = rankEntries(
    players
      .map((player) => ({
        profile: player,
        value: player.competitivePoints ?? 0,
        rank: 0,
      }))
      .filter((entry) => entry.value > 0)
      .sort((left, right) => right.value - left.value || left.profile.name.localeCompare(right.profile.name))
      .slice(0, 20),
  );

  const winsByProfileId = new Map<string, number>();
  for (const event of pointEvents) {
    if (event.rank === 1) {
      winsByProfileId.set(event.profile_id, (winsByProfileId.get(event.profile_id) ?? 0) + 1);
    }
  }

  const competitiveWins = rankEntries(
    [...winsByProfileId.entries()]
      .map(([profileId, value]) => ({
        profile: playersById.get(profileId),
        value,
        rank: 0,
      }))
      .filter((entry): entry is { profile: Player; value: number; rank: number } => Boolean(entry.profile))
      .sort((left, right) => right.value - left.value || left.profile.name.localeCompare(right.profile.name))
      .slice(0, 20),
  );

  const eventsByProfileId = new Map<string, Array<{ rank: number; createdAt: string; lobbyId: string }>>();
  for (const event of pointEvents) {
    const current = eventsByProfileId.get(event.profile_id) ?? [];
    current.push({
      rank: event.rank,
      createdAt: event.created_at,
      lobbyId: event.lobby_id,
    });
    eventsByProfileId.set(event.profile_id, current);
  }

  const highestWinStreak = rankEntries(
    [...eventsByProfileId.entries()]
      .map(([profileId, events]) => {
        const orderedEvents = [...events].sort((left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
          || left.lobbyId.localeCompare(right.lobbyId),
        );

        let currentStreak = 0;
        let maxStreak = 0;
        for (const event of orderedEvents) {
          if (event.rank === 1) {
            currentStreak += 1;
            maxStreak = Math.max(maxStreak, currentStreak);
          } else {
            currentStreak = 0;
          }
        }

        return {
          profile: playersById.get(profileId),
          value: maxStreak,
          rank: 0,
        };
      })
      .filter((entry): entry is { profile: Player; value: number; rank: number } => Boolean(entry.profile) && entry.value > 0)
      .sort((left, right) => right.value - left.value || left.profile.name.localeCompare(right.profile.name))
      .slice(0, 20),
  );

  return {
    allTimePoints,
    competitiveWins,
    highestWinStreak,
  };
}
