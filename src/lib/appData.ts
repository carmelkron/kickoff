import type { Lobby, Player, RatingEntry, LobbyHistoryEntry, GameType, FieldType, GenderRestriction, Gender, ContributionType, LobbyStatus } from '../types';
import { createFriendJoinedLobbyNotifications, createOrganizerSummaryNotification, fetchAcceptedFriendIds } from './appNotifications';
import { requireSupabase } from './supabase';
import { getJoinLobbyError, normalizeText, validateCreateLobbyPayload } from './validation';

const LOBBY_SELECT_FIELDS = 'id, title, address, city, datetime, max_players, num_teams, players_per_team, min_rating, is_private, price, description, created_by, distance_km, game_type, field_type, gender_restriction, latitude, longitude';
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

function isMissingLobbyStatusColumnError(error: unknown) {
  const text = getErrorText(error).toLowerCase();
  return text.includes('status') && (
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

function resolveLobbyStatus(row: LobbyRow): LobbyStatus {
  if (row.status === 'deleted') {
    return 'deleted';
  }

  if (row.status === 'expired') {
    return 'expired';
  }

  return new Date(row.datetime) > new Date() ? 'active' : 'expired';
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

  if (!isMissingLobbyStatusColumnError(withStatus.error)) {
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
    ratingHistory: row.rating_history ?? [],
    lobbyHistory: row.lobby_history ?? [],
  };
}

export async function fetchProfiles(): Promise<Player[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, initials, avatar_color, rating, games_played, position, bio, photo_url, gender, rating_history, lobby_history')
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
    .select('id, email, name, initials, avatar_color, rating, games_played, position, bio, photo_url, gender, rating_history, lobby_history')
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

  const [{ data: lobbyRows, error: lobbiesError }, { data: profileRows, error: profilesError }, { data: membershipRows, error: membershipsError }] = await Promise.all([
    fetchLobbyRows().then((data) => ({ data, error: null })),
    supabase
      .from('profiles')
      .select('id, email, name, initials, avatar_color, rating, games_played, position, bio, photo_url, gender, rating_history, lobby_history'),
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

  const playersById = new Map<string, Player>(((profileRows ?? []) as ProfileRow[]).map((row) => [row.id, mapProfile(row)]));
  const membershipsByLobby = new Map<string, MembershipRow[]>();

  for (const membership of (membershipRows ?? []) as MembershipRow[]) {
    const list = membershipsByLobby.get(membership.lobby_id) ?? [];
    list.push(membership);
    membershipsByLobby.set(membership.lobby_id, list);
  }

  return ((lobbyRows ?? []) as LobbyRow[]).map((row) => {
    const lobbyStatus = resolveLobbyStatus(row);
    const memberships = [...(membershipsByLobby.get(row.id) ?? [])].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
    const players = memberships
      .filter((membership) => membership.status === 'joined')
      .map((membership) => playersById.get(membership.profile_id))
      .filter((player): player is Player => Boolean(player));

    const waitlist = memberships
      .filter((membership) => membership.status === 'waitlisted')
      .map((membership) => playersById.get(membership.profile_id))
      .filter((player): player is Player => Boolean(player));

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
      fieldType: row.field_type ?? undefined,
      genderRestriction: row.gender_restriction ?? 'none',
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      status: lobbyStatus,
    };
  }).filter((lobby) => lobby.status !== 'deleted');
}

export async function fetchLobbyById(id: string): Promise<Lobby | null> {
  const lobbies = await fetchLobbies();
  return lobbies.find((lobby) => lobby.id === id) ?? null;
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
    field_type: input.fieldType ?? null,
    gender_restriction: input.genderRestriction ?? 'none',
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    status: 'active' as const,
  };

  let { error: lobbyError } = await supabase.from('lobbies').insert(lobbyPayload);

  if (lobbyError && isMissingLobbyStatusColumnError(lobbyError)) {
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
    if (isMissingLobbyStatusColumnError(error)) {
      throw new Error('Lobby status column is missing. Apply the Supabase lobby status patch and try again.');
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
