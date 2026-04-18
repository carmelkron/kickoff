import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthUser, LobbyHistoryEntry, RatingEntry, Gender } from '../types';
import {
  createFriendRequestNotification,
  markFriendRequestNotificationsHandled,
} from '../lib/appNotifications';
import { fetchCompetitiveProfileStats, fetchProfileSkillsMap } from '../lib/appData';
import { requireSupabase } from '../lib/supabase';
import { uploadAvatar } from '../lib/storage';
import { normalizeText, validateRegisterDraft } from '../lib/validation';
import type { User } from '@supabase/supabase-js';

type ProfileRow = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  name: string;
  initials: string;
  avatar_color: string;
  rating: number;
  games_played: number;
  competitive_points: number | null;
  position: string | null;
  bio: string | null;
  photo_url: string | null;
  gender: Gender | null;
  birthdate: string | null;
  rating_history: RatingEntry[];
  lobby_history: LobbyHistoryEntry[];
  home_latitude: number | null;
  home_longitude: number | null;
  home_address: string | null;
};

type FriendRequestRow = {
  from_profile_id: string;
  to_profile_id: string;
  status: 'pending' | 'accepted' | 'declined';
};

type RegisterInput = {
  name: string;
  email: string;
  password?: string;
  initials: string;
  avatarColor: string;
  position: string;
  bio?: string;
  gender?: Gender;
  birthdate?: string;
  photoFile?: File;
  homeLatitude?: number;
  homeLongitude?: number;
  homeAddress?: string;
};

interface AuthContextType {
  currentUser: AuthUser | null;
  login: (email: string, password: string) => Promise<string | null>;
  register: (data: RegisterInput) => Promise<string | null>;
  logout: () => Promise<void>;
  getAllUsers: () => AuthUser[];
  sendFriendRequest: (targetId: string) => Promise<void>;
  acceptFriendRequest: (requesterId: string) => Promise<void>;
  declineFriendRequest: (requesterId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function mapProfileToAuthUser(
  profile: ProfileRow,
  competitiveGamesPlayed = 0,
  skills: AuthUser['skills'] = [],
  overrides?: Partial<AuthUser>,
): AuthUser {
  const competitivePoints = profile.competitive_points ?? 0;
  const competitivePointsPerGame =
    competitiveGamesPlayed > 0
      ? competitivePoints / competitiveGamesPlayed
      : 0;

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email ?? '',
    initials: profile.initials,
    avatarColor: profile.avatar_color,
    rating: profile.rating,
    gamesPlayed: profile.games_played,
    competitivePoints,
    competitiveGamesPlayed,
    competitivePointsPerGame,
    position: profile.position ?? undefined,
    bio: profile.bio ?? undefined,
    photoUrl: profile.photo_url ?? undefined,
    gender: profile.gender ?? undefined,
    birthdate: profile.birthdate ?? undefined,
    skills,
    ratingHistory: profile.rating_history ?? [],
    lobbyHistory: profile.lobby_history ?? [],
    friends: [],
    sentRequests: [],
    pendingRequests: [],
    homeLatitude: profile.home_latitude ?? undefined,
    homeLongitude: profile.home_longitude ?? undefined,
    homeAddress: profile.home_address ?? undefined,
    ...overrides,
  };
}

function buildInitials(name: string) {
  const parts = normalizeText(name).split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return normalizeText(name).slice(0, 2).toUpperCase() || '?';
}

function buildFallbackName(email: string | undefined) {
  const localPart = email?.split('@')[0] ?? 'Player';
  const cleaned = localPart.replace(/[._-]+/g, ' ').trim();
  return cleaned ? cleaned.replace(/\b\w/g, (char) => char.toUpperCase()) : 'Player';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = requireSupabase();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [allUsers, setAllUsers] = useState<AuthUser[]>([]);

  async function ensureProfileForAuthUser(
    authUser: User,
    overrides?: {
      name?: string;
      initials?: string;
      avatarColor?: string;
      position?: string;
      bio?: string;
      gender?: Gender;
      birthdate?: string;
      photoUrl?: string | null;
      homeLatitude?: number;
      homeLongitude?: number;
      homeAddress?: string;
    },
  ) {
    const { data: existingProfile, error: existingProfileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    if (existingProfileError) {
      throw existingProfileError;
    }

    if (existingProfile) {
      return existingProfile.id as string;
    }

    const metadata = authUser.user_metadata ?? {};
    const email = authUser.email?.trim().toLowerCase() ?? null;
    const name = normalizeText(
      overrides?.name ??
        (typeof metadata.name === 'string' ? metadata.name : '') ??
        buildFallbackName(authUser.email),
    );
    const initials =
      overrides?.initials ??
      (typeof metadata.initials === 'string' ? metadata.initials : '') ??
      buildInitials(name);
    const avatarColor =
      overrides?.avatarColor ??
      (typeof metadata.avatarColor === 'string' ? metadata.avatarColor : '') ??
      'bg-blue-500';
    const position =
      overrides?.position ??
      (typeof metadata.position === 'string' ? metadata.position : undefined);
    const bio =
      overrides?.bio ??
      (typeof metadata.bio === 'string' ? metadata.bio : undefined);
    const photoUrl =
      overrides?.photoUrl ??
      (typeof metadata.photoUrl === 'string' ? metadata.photoUrl : null);

    const gender =
      overrides?.gender ??
      (typeof metadata.gender === 'string' ? metadata.gender as Gender : undefined);
    const birthdate =
      overrides?.birthdate ??
      (typeof metadata.birthdate === 'string' ? metadata.birthdate : undefined);

    const { error: insertProfileError } = await supabase.from('profiles').insert({
      id: authUser.id,
      auth_user_id: authUser.id,
      email,
      name,
      initials,
      avatar_color: avatarColor,
      rating: 5,
      games_played: 0,
      position: position ? normalizeText(position) : null,
      bio: bio ? normalizeText(bio) : null,
      gender: gender ?? null,
      birthdate: birthdate ?? null,
      photo_url: photoUrl,
      rating_history: [],
      lobby_history: [],
      is_mock: false,
      home_latitude: overrides?.homeLatitude ?? null,
      home_longitude: overrides?.homeLongitude ?? null,
      home_address: overrides?.homeAddress ?? null,
    });

    if (insertProfileError) {
      throw insertProfileError;
    }

    return authUser.id;
  }

  async function refresh(authUserId: string | null) {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, auth_user_id, email, name, initials, avatar_color, rating, games_played, competitive_points, position, bio, photo_url, gender, birthdate, rating_history, lobby_history, home_latitude, home_longitude, home_address')
      .order('name', { ascending: true });

    if (profilesError) {
      throw profilesError;
    }

    const profiles = (profilesData ?? []) as ProfileRow[];
    const viewerProfileId = authUserId
      ? (profiles.find((profile) => profile.auth_user_id === authUserId)?.id ?? null)
      : null;
    const competitiveStatsByProfileId = await fetchCompetitiveProfileStats(profiles.map((profile) => profile.id));
    const skillsByProfileId = await fetchProfileSkillsMap(profiles.map((profile) => profile.id), viewerProfileId);
    setAllUsers(
      profiles.map((profile) =>
        mapProfileToAuthUser(
          profile,
          competitiveStatsByProfileId.get(profile.id)?.competitiveGamesPlayed ?? 0,
          skillsByProfileId.get(profile.id) ?? [],
        ),
      ),
    );

    if (!authUserId) {
      setCurrentUser(null);
      return;
    }

    const currentProfile = profiles.find((profile) => profile.auth_user_id === authUserId) ?? null;
    if (!currentProfile) {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user || authData.user.id !== authUserId) {
        setCurrentUser(null);
        return;
      }

      await ensureProfileForAuthUser(authData.user);
      await refresh(authUserId);
      return;
    }

    const { data: requestsData, error: requestsError } = await supabase
      .from('friend_requests')
      .select('from_profile_id, to_profile_id, status')
      .or(`from_profile_id.eq.${currentProfile.id},to_profile_id.eq.${currentProfile.id}`);

    if (requestsError) {
      throw requestsError;
    }

    const requests = (requestsData ?? []) as FriendRequestRow[];
    const friends = requests
      .filter((request) => request.status === 'accepted')
      .map((request) => (request.from_profile_id === currentProfile.id ? request.to_profile_id : request.from_profile_id));

    const sentRequests = requests
      .filter((request) => request.status === 'pending' && request.from_profile_id === currentProfile.id)
      .map((request) => request.to_profile_id);

    const pendingRequests = requests
      .filter((request) => request.status === 'pending' && request.to_profile_id === currentProfile.id)
      .map((request) => request.from_profile_id);

    setCurrentUser(
      mapProfileToAuthUser(
        currentProfile,
        competitiveStatsByProfileId.get(currentProfile.id)?.competitiveGamesPlayed ?? 0,
        skillsByProfileId.get(currentProfile.id) ?? [],
        {
          friends,
          sentRequests,
          pendingRequests,
        },
      ),
    );
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !active) {
        return;
      }

      await refresh(data.user?.id ?? null);
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) {
        return;
      }

      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        void refresh(null);
        return;
      }

      void refresh(session?.user.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const login = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      return error.message;
    }

    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await ensureProfileForAuthUser(data.user);
    }
    await refresh(data.user?.id ?? null);
    return null;
  };

  const register = async (data: RegisterInput): Promise<string | null> => {
    const validationErrors = validateRegisterDraft({
      name: data.name,
      email: data.email,
      password: data.password ?? '',
      position: data.position,
      bio: data.bio,
      photoFile: data.photoFile ?? null,
      birthdate: data.birthdate,
    });

    if (validationErrors.length > 0) {
      return validationErrors[0];
    }

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email.trim().toLowerCase(),
      password: data.password ?? '',
      options: {
        data: {
          name: normalizeText(data.name),
          initials: data.initials,
          avatarColor: data.avatarColor,
          position: data.position ? normalizeText(data.position) : null,
          bio: data.bio ? normalizeText(data.bio) : null,
          gender: data.gender ?? null,
          birthdate: data.birthdate ?? null,
        },
      },
    });

    if (error) {
      if (/already registered/i.test(error.message)) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email.trim().toLowerCase(),
          password: data.password ?? '',
        });

        if (signInError) {
          return error.message;
        }

        const existingAuthUser = signInData.user;
        if (!existingAuthUser) {
          return 'Failed to recover existing account';
        }

        let recoveredPhotoUrl: string | null = null;
        if (data.photoFile) {
          try {
            recoveredPhotoUrl = await uploadAvatar(data.photoFile, existingAuthUser.id);
          } catch (uploadError) {
            return uploadError instanceof Error ? uploadError.message : 'Failed to upload avatar';
          }
        }

        await ensureProfileForAuthUser(existingAuthUser, {
          name: normalizeText(data.name),
          initials: data.initials,
          avatarColor: data.avatarColor,
          position: data.position,
          bio: data.bio,
          gender: data.gender,
          birthdate: data.birthdate,
          photoUrl: recoveredPhotoUrl,
        });

        await refresh(existingAuthUser.id);
        return null;
      }

      return error.message;
    }

    const authUser = signUpData.user;
    if (!authUser) {
      return 'Failed to create account';
    }

    let photoUrl: string | null = null;

    if (data.photoFile) {
      try {
        photoUrl = await uploadAvatar(data.photoFile, authUser.id);
      } catch (uploadError) {
        return uploadError instanceof Error ? uploadError.message : 'Failed to upload avatar';
      }
    }

    try {
      await ensureProfileForAuthUser(authUser, {
        name: normalizeText(data.name),
        initials: data.initials,
        avatarColor: data.avatarColor,
        position: data.position,
        bio: data.bio,
        gender: data.gender,
        birthdate: data.birthdate,
        photoUrl,
        homeLatitude: data.homeLatitude,
        homeLongitude: data.homeLongitude,
        homeAddress: data.homeAddress,
      });
    } catch (profileError) {
      return profileError instanceof Error ? profileError.message : 'Failed to create profile';
    }

    await refresh(authUser.id);
    return null;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const getAllUsers = () => allUsers;

  const refreshCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    await refresh(data.user?.id ?? null);
  };

  const sendFriendRequest = async (targetId: string) => {
    if (!currentUser) {
      return;
    }

    if (currentUser.friends.includes(targetId) || currentUser.sentRequests.includes(targetId)) {
      return;
    }

    const status = targetId.startsWith('p') ? 'accepted' : 'pending';
    const payload = {
      from_profile_id: currentUser.id,
      to_profile_id: targetId,
      status,
      responded_at: status === 'accepted' ? new Date().toISOString() : null,
    };

    const { error } = await supabase.from('friend_requests').upsert(payload, { onConflict: 'from_profile_id,to_profile_id' });
    if (error) {
      throw error;
    }

    if (status === 'pending') {
      await createFriendRequestNotification(currentUser.id, currentUser.name, targetId);
    }

    await refresh((await supabase.auth.getUser()).data.user?.id ?? null);
  };

  const acceptFriendRequest = async (requesterId: string) => {
    if (!currentUser) {
      return;
    }

    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('from_profile_id', requesterId)
      .eq('to_profile_id', currentUser.id)
      .eq('status', 'pending');

    if (error) {
      throw error;
    }

    await markFriendRequestNotificationsHandled(requesterId, currentUser.id);
    await refresh((await supabase.auth.getUser()).data.user?.id ?? null);
  };

  const declineFriendRequest = async (requesterId: string) => {
    if (!currentUser) {
      return;
    }

    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('from_profile_id', requesterId)
      .eq('to_profile_id', currentUser.id)
      .eq('status', 'pending');

    if (error) {
      throw error;
    }

    await markFriendRequestNotificationsHandled(requesterId, currentUser.id);
    await refresh((await supabase.auth.getUser()).data.user?.id ?? null);
  };

  const removeFriend = async (friendId: string) => {
    if (!currentUser) {
      return;
    }

    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .or(`and(from_profile_id.eq.${currentUser.id},to_profile_id.eq.${friendId}),and(from_profile_id.eq.${friendId},to_profile_id.eq.${currentUser.id})`)
      .eq('status', 'accepted');

    if (error) {
      throw error;
    }

    await refresh((await supabase.auth.getUser()).data.user?.id ?? null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        login,
        register,
        logout,
        getAllUsers,
        sendFriendRequest,
        acceptFriendRequest,
        declineFriendRequest,
        removeFriend,
        refreshCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
