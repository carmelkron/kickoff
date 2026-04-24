export type Language = 'he' | 'en';
export type ThemeMode = 'system' | 'light' | 'dark';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'mixed';
export type GameType = 'friendly' | 'competitive';
export type FieldType = 'grass' | 'asphalt' | 'indoor';
export type ContributionType = 'ball' | 'speaker';
export type LobbyStatus = 'active' | 'deleted' | 'expired';
export type LobbyAccessType = 'open' | 'locked';
export type TeamColor = 'blue' | 'yellow' | 'red' | 'green';
export type LobbyInviteStatus = 'pending' | 'accepted' | 'revoked';
export type LobbyJoinRequestStatus = 'pending' | 'approved' | 'declined';
export type SearchHistoryEntryKind = 'query' | 'profile' | 'lobby';
export type SearchResultKind = 'profile' | 'lobby';
export type NetworkRecommendationBucket =
  | 'played_together'
  | 'mutual_friends'
  | 'near_you'
  | 'people_you_may_know';
export type NotificationPreferenceKey =
  | 'friendRequests'
  | 'lobbyInvites'
  | 'joinRequests'
  | 'waitlist'
  | 'competitiveResults'
  | 'organizerReminders';

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

export interface RatingEntry {
  date: string;
  rating: number;
  change: number;
  lobbyTitle: string;
  lobbyId: string;
}

export interface LobbyHistoryEntry {
  lobbyId: string;
  lobbyTitle: string;
  date: string;
  city: string;
  fieldName?: string;
  gameType?: GameType;
  ratingChange: number;
}

export interface ProfileSkill {
  id: string;
  label: string;
  endorsementCount: number;
  viewerHasEndorsed: boolean;
}

export interface Player {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  rating: number;        // 1–10
  competitivePoints?: number;
  competitiveGamesPlayed?: number;
  competitivePointsPerGame?: number;
  gamesPlayed: number;
  position?: string;
  bio?: string;
  email?: string;
  photoUrl?: string;
  homeLatitude?: number;
  homeLongitude?: number;
  homeAddress?: string;
  skills?: ProfileSkill[];
  ratingHistory: RatingEntry[];
  lobbyHistory: LobbyHistoryEntry[];
}

export interface Lobby {
  id: string;
  title: string;
  fieldName?: string;
  address: string;
  city: string;
  datetime: string;
  players: Player[];
  maxPlayers: number;
  numTeams?: number;
  playersPerTeam?: number;
  minRating?: number;
  minPointsPerGame?: number;
  isPrivate: boolean;
  price?: number;
  description?: string;
  createdBy: string;
  organizerIds: string[];
  distanceKm: number;
  waitlist: Player[];
  pendingWaitlistIds?: string[];
  passedWaitlistIds?: string[];
  gameType: GameType;
  accessType: LobbyAccessType;
  fieldType?: FieldType;
  latitude?: number;
  longitude?: number;
  status: LobbyStatus;
  viewerHasAccess: boolean;
  viewerIsInvited: boolean;
  viewerHasFriendInside: boolean;
  viewerJoinRequestStatus?: LobbyJoinRequestStatus | null;
}

export interface LobbyInvite {
  id: string;
  lobbyId: string;
  invitedProfileId: string;
  invitedByProfileId: string;
  status: LobbyInviteStatus;
  createdAt: string;
  invitedPlayer: Player;
}

export interface LobbyJoinRequest {
  id: string;
  lobbyId: string;
  requesterProfileId: string;
  status: LobbyJoinRequestStatus;
  createdAt: string;
  respondedAt?: string;
  requester: Player;
}

export interface LobbyMessage {
  id: string;
  lobbyId: string;
  profileId: string;
  body: string;
  createdAt: string;
  author: Player;
}

export interface LobbyTeam {
  id: string;
  lobbyId: string;
  color: TeamColor;
  teamNumber: number;
  lockedAt?: string;
}

export interface LobbyTeamResult {
  lobbyId: string;
  lobbyTeamId: string;
  wins: number;
  rank: number;
  awardedPoints: number;
  awardedPointsMax?: number;
  playerAwardedPoints?: Record<string, number>;
}

export interface LobbyTeamStanding extends LobbyTeamResult {
  teamColor: TeamColor;
  teamNumber: number;
}

export interface LobbyResultSummary {
  lobbyId: string;
  submittedByProfileId: string;
  submittedByProfileName?: string;
  submittedAt: string;
  notes?: string;
  teamResults: LobbyTeamStanding[];
}

export interface CompetitivePointEvent {
  id: string;
  lobbyId: string;
  profileId: string;
  awardedByProfileId: string;
  teamColor: TeamColor;
  teamNumber: number;
  wins: number;
  rank: number;
  maxRank?: number;
  points: number;
  createdAt: string;
}

export interface CompetitivePointHistoryEntry {
  id: string;
  lobbyId: string;
  lobbyTitle: string;
  lobbyDate: string;
  city: string;
  teamColor: TeamColor;
  teamNumber: number;
  wins: number;
  rank: number;
  maxRank?: number;
  points: number;
  createdAt: string;
  notes?: string;
}

export interface SearchHistoryEntry {
  id: string;
  kind: SearchHistoryEntryKind;
  queryText?: string;
  targetId?: string;
  label: string;
  actedAt: string;
}

export interface SearchResultProfile {
  kind: 'profile';
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  initials: string;
  avatarColor: string;
  competitivePoints?: number;
  isFriend?: boolean;
  pendingState?: 'sent' | 'received';
}

export interface SearchResultLobby {
  kind: 'lobby';
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  city?: string;
  gameType: GameType;
  joinedCount: number;
  maxPlayers: number;
  viewerHasAccess: boolean;
  accessType: LobbyAccessType;
}

export type SearchResult = SearchResultProfile | SearchResultLobby;

export interface FriendRequestListItem {
  id: string;
  user: Player;
  createdAt?: string;
}

export interface NetworkRecommendation {
  profile: Player;
  score: number;
  primaryBucket: NetworkRecommendationBucket;
  subtitle?: string;
  mutualFriends: number;
  sharedLobbies: number;
  sameTeamLobbies: number;
  recentInteractions: number;
  reasons: string[];
}

export interface LeaderboardEntry {
  profile: Player;
  value: number;
  rank: number;
}

export interface LeaderboardStats {
  allTimePoints: LeaderboardEntry[];
  competitiveWins: LeaderboardEntry[];
  highestWinStreak: LeaderboardEntry[];
}

export interface LobbyTeamAssignment {
  team: LobbyTeam;
  players: Player[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  initials: string;
  avatarColor: string;
  rating: number;
  gamesPlayed: number;
  position?: string;
  bio?: string;
  photoUrl?: string;
  ratingHistory: RatingEntry[];
  lobbyHistory: LobbyHistoryEntry[];
  skills?: ProfileSkill[];
  competitivePoints?: number;
  competitiveGamesPlayed?: number;
  competitivePointsPerGame?: number;
  friends: string[];
  sentRequests: string[];
  pendingRequests: string[];
  homeLatitude?: number;
  homeLongitude?: number;
  homeAddress?: string;
}
