import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, Clock, MapPin, Pencil, ThumbsUp, Trophy, UserCheck, UserPlus, UserX, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { fetchCompetitivePointHistory, fetchProfileLobbyHistory, toggleProfileSkillEndorsement } from '../lib/appData';
import { getProfileSkillBadgeStyle } from '../lib/profileSkillBadges';
import { getTeamColorLabel } from '../lib/teamAssignment';
import type { AuthUser, CompetitivePointHistoryEntry, LobbyHistoryEntry, TeamColor } from '../types';

function teamColorClassName(color: TeamColor) {
  if (color === 'blue') {
    return 'bg-blue-500';
  }

  if (color === 'yellow') {
    return 'bg-yellow-400';
  }

  if (color === 'red') {
    return 'bg-red-500';
  }

  return 'bg-green-500';
}

function formatSignedPoints(points: number) {
  return points > 0 ? `+${points}` : `${points}`;
}

function formatRankLabel(rank: number, lang: 'he' | 'en') {
  const roundedRank = Number.isInteger(rank) ? `${rank}` : rank.toFixed(1);
  return lang === 'he' ? `מקום ${roundedRank}` : `Place ${roundedRank}`;
}

export default function ProfileLive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lang } = useLang();
  const { currentUser, getAllUsers, sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend, refreshCurrentUser } = useAuth();
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [competitiveHistory, setCompetitiveHistory] = useState<CompetitivePointHistoryEntry[]>([]);
  const [loadingCompetitiveHistory, setLoadingCompetitiveHistory] = useState(false);
  const [lobbyHistory, setLobbyHistory] = useState<LobbyHistoryEntry[]>([]);
  const [loadingLobbyHistory, setLoadingLobbyHistory] = useState(false);
  const [showFullBio, setShowFullBio] = useState(false);

  const allUsers = getAllUsers();
  const profile = allUsers.find((user) => user.id === id) ?? null;
  const isMe = currentUser?.id === id;

  useEffect(() => {
    if (!profile) {
      setCompetitiveHistory([]);
      return;
    }

    const profileId = profile.id;
    let cancelled = false;

    async function loadCompetitiveHistory() {
      setLoadingCompetitiveHistory(true);
      try {
        const nextHistory = await fetchCompetitivePointHistory(profileId);
        if (!cancelled) {
          setCompetitiveHistory(nextHistory);
        }
      } catch {
        if (!cancelled) {
          setCompetitiveHistory([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingCompetitiveHistory(false);
        }
      }
    }

    void loadCompetitiveHistory();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile) {
      setLobbyHistory([]);
      return;
    }

    const profileId = profile.id;
    let cancelled = false;

    async function loadLobbyHistory() {
      setLoadingLobbyHistory(true);
      try {
        const nextHistory = await fetchProfileLobbyHistory(profileId);
        if (!cancelled) {
          setLobbyHistory(nextHistory);
        }
      } catch {
        if (!cancelled) {
          setLobbyHistory([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingLobbyHistory(false);
        }
      }
    }

    void loadLobbyHistory();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const friendsList = useMemo(() => {
    if (!profile) {
      return [];
    }

    return profile.friends
      .map((friendId) => allUsers.find((user) => user.id === friendId))
      .filter((user): user is AuthUser => Boolean(user));
  }, [allUsers, profile]);

  type FriendStatus = 'self' | 'friend' | 'sent' | 'pending' | 'none';

  const friendStatus: FriendStatus = (() => {
    if (!currentUser || !id) {
      return 'none';
    }
    if (isMe) {
      return 'self';
    }
    if (currentUser.friends.includes(id)) {
      return 'friend';
    }
    if (currentUser.sentRequests.includes(id)) {
      return 'sent';
    }
    if (currentUser.pendingRequests.includes(id)) {
      return 'pending';
    }
    return 'none';
  })();

  async function runAction(key: string, action: () => Promise<void>) {
    setBusyAction(key);
    setActionError('');
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : lang === 'he' ? 'הפעולה נכשלה.' : 'Action failed.');
    } finally {
      setBusyAction('');
    }
  }

  const competitivePointsTotal = profile?.competitivePoints ?? 0;
  const profileSkills = profile?.skills ?? [];
  const hasCompetitiveHistory = loadingCompetitiveHistory || competitiveHistory.length > 0 || competitivePointsTotal > 0;
  const hasLobbyHistory = loadingLobbyHistory || lobbyHistory.length > 0;
  const latestCompetitiveGain = competitiveHistory[0]?.points ?? null;
  const competitiveGamesPlayed = profile?.competitiveGamesPlayed ?? competitiveHistory.length;
  const competitivePointsPerGame = profile?.competitivePointsPerGame ?? (
    competitiveGamesPlayed > 0 ? competitivePointsTotal / competitiveGamesPlayed : 0
  );
  const competitiveWins = competitiveHistory.filter((entry) => entry.rank === 1).length;
  const competitiveLosses = competitiveHistory.filter((entry) => {
    const maxRank = entry.maxRank ?? (entry.rank > 1 ? entry.rank : undefined);
    return maxRank != null && entry.rank === maxRank;
  }).length;
  const visibleFriends = friendsList.slice(0, 4);
  const visibleLobbyHistory = lobbyHistory.slice(0, 5);
  const bioNeedsClamp = Boolean(profile?.bio && profile.bio.length > 140);
  const visibleBio =
    profile?.bio && bioNeedsClamp && !showFullBio
      ? `${profile.bio.slice(0, 140).trimEnd()}...`
      : profile?.bio ?? '';

  async function handleToggleSkillLike(skillId: string, currentlyEndorsed: boolean) {
    if (!currentUser || isMe) {
      return;
    }

    await runAction(`skill-${skillId}`, async () => {
      await toggleProfileSkillEndorsement(skillId, currentUser.id, currentlyEndorsed);
      await refreshCurrentUser();
    });
  }

  if (!profile && allUsers.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center text-gray-500">
        {lang === 'he' ? 'טוען פרופיל...' : 'Loading profile...'}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-gray-500">{lang === 'he' ? 'המשתמש לא נמצא' : 'User not found'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary-600 underline">
          {lang === 'he' ? 'חזרה' : 'Back'}
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-primary-600"
      >
        <ChevronLeft size={16} />
        {lang === 'he' ? 'חזרה' : 'Back'}
      </button>

      <div className="mb-4 rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            {profile.photoUrl ? (
              <button type="button" onClick={() => setLightboxPhoto(profile.photoUrl!)} className="block cursor-zoom-in">
                <img src={profile.photoUrl} alt={profile.name} className="h-20 w-20 rounded-full object-cover transition-opacity hover:opacity-90" />
              </button>
            ) : (
              <div className={`flex h-20 w-20 items-center justify-center rounded-full ${profile.avatarColor} text-2xl font-bold text-white`}>
                {profile.initials}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-bold text-gray-900">{profile.name}</h1>
                  {isMe ? (
                    <span className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-700">
                      {lang === 'he' ? 'הפרופיל שלי' : 'My Profile'}
                    </span>
                  ) : null}
                </div>
                {profile.position ? <p className="mt-1 text-sm text-gray-500">{profile.position}</p> : null}
              </div>

              <div className="shrink-0 rounded-2xl bg-primary-50 px-4 py-3 text-center">
                <p className="flex items-center justify-center gap-1 text-xl font-bold text-primary-700">
                  <Trophy size={16} />
                  {competitivePointsTotal}
                </p>
                <p className="mt-1 text-[11px] font-medium text-primary-700">
                  {lang === 'he' ? 'דירוג תחרותי' : 'Comp. rating'}
                </p>
              </div>
            </div>

            {visibleBio ? (
              <div className="mt-3">
                <p className="text-sm leading-7 text-gray-600">{visibleBio}</p>
                {bioNeedsClamp ? (
                  <button
                    type="button"
                    onClick={() => setShowFullBio((current) => !current)}
                    className="mt-1 text-xs font-semibold text-primary-600"
                  >
                    {showFullBio ? (lang === 'he' ? 'הצג פחות' : 'Show less') : (lang === 'he' ? 'הצג עוד' : 'Show more')}
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {isMe ? (
                <button
                  onClick={() => navigate(`/profile/${currentUser!.id}/edit`)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                >
                  <Pencil size={14} />
                  {lang === 'he' ? 'עריכת פרופיל' : 'Edit profile'}
                </button>
              ) : null}

              {!isMe && currentUser && friendStatus === 'none' ? (
                <button
                  onClick={() => void runAction(`send-${profile.id}`, () => sendFriendRequest(profile.id))}
                  disabled={busyAction !== ''}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
                >
                  <UserPlus size={14} />
                  {lang === 'he' ? 'שלח בקשת חברות' : 'Send Friend Request'}
                </button>
              ) : null}

              {!isMe && currentUser && friendStatus === 'sent' ? (
                <div className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500">
                  <Clock size={14} />
                  {lang === 'he' ? 'בקשה נשלחה' : 'Request sent'}
                </div>
              ) : null}

              {!isMe && currentUser && friendStatus === 'pending' ? (
                <>
                  <button
                    onClick={() => void runAction(`accept-${profile.id}`, () => acceptFriendRequest(profile.id))}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    <UserCheck size={14} />
                    {lang === 'he' ? 'אשר' : 'Accept'}
                  </button>
                  <button
                    onClick={() => void runAction(`decline-${profile.id}`, () => declineFriendRequest(profile.id))}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    <UserX size={14} />
                    {lang === 'he' ? 'דחה' : 'Decline'}
                  </button>
                </>
              ) : null}

              {!isMe && currentUser && friendStatus === 'friend' ? (
                <button
                  onClick={() => void runAction(`remove-${profile.id}`, () => removeFriend(profile.id))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  <UserCheck size={14} />
                  {lang === 'he' ? 'חברים ✓' : 'Friends ✓'}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {actionError ? <p className="mt-4 text-sm text-red-500">{actionError}</p> : null}
      </div>

      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox value={profile.gamesPlayed} label={lang === 'he' ? 'משחקים' : 'Games'} />
          <StatBox value={friendsList.length} label={lang === 'he' ? 'קשרים' : 'Connections'} color="text-primary-700" />
          <StatBox
            value={competitiveGamesPlayed > 0 ? competitivePointsPerGame.toFixed(1) : '—'}
            label={lang === 'he' ? 'נק׳ למשחק' : 'Pts / game'}
            color={competitiveGamesPlayed > 0 ? 'text-primary-700' : 'text-gray-400'}
          />
          <StatBox value={competitiveWins} label={lang === 'he' ? 'ניצחונות' : 'Wins'} color="text-green-600" />
        </div>
      </div>

      {(profileSkills.length > 0 || isMe) ? (
        <ProfileSection
          title={lang === 'he' ? 'יכולות' : 'Skills'}
          action={isMe ? (
            <button
              type="button"
              onClick={() => navigate(`/profile/${currentUser!.id}/edit`)}
              className="text-xs font-semibold text-primary-600 hover:underline"
            >
              {lang === 'he' ? 'ערוך יכולות' : 'Edit skills'}
            </button>
          ) : undefined}
        >
          {profileSkills.length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {profileSkills.map((skill) => {
                const badgeStyle = getProfileSkillBadgeStyle(skill.label);

                return (
                  <button
                    key={skill.id}
                    type="button"
                    disabled={!currentUser || isMe}
                    onClick={() => void handleToggleSkillLike(skill.id, skill.viewerHasEndorsed)}
                    className={`inline-flex min-w-[148px] items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm font-medium transition-colors ${
                      skill.viewerHasEndorsed
                        ? 'border-primary-500 bg-primary-600 text-white'
                        : `${badgeStyle.chipClassName} hover:shadow-sm`
                    } ${!currentUser || isMe ? 'cursor-default' : ''}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-lg ${
                      skill.viewerHasEndorsed ? 'bg-white/15' : 'bg-white/70'
                    }`}>
                      {badgeStyle.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-start font-semibold">{skill.label}</span>
                      <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                        skill.viewerHasEndorsed ? 'bg-white/20 text-white' : badgeStyle.countClassName
                      }`}>
                        <ThumbsUp size={12} />
                        {skill.endorsementCount}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {lang === 'he' ? 'עדיין לא נוספו יכולות לפרופיל הזה.' : 'No skills have been added to this profile yet.'}
            </p>
          )}
        </ProfileSection>
      ) : null}

      {friendsList.length > 0 ? (
        <ProfileSection
          title={lang === 'he' ? 'קשרים' : 'Connections'}
          action={(
            <button
              type="button"
              onClick={() => navigate(`/profile/${profile.id}/friends`)}
              className="text-xs font-semibold text-primary-600 hover:underline"
            >
              {lang === 'he' ? 'צפה בהכל' : 'View all'}
            </button>
          )}
        >
          <div className="space-y-2">
            {visibleFriends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => navigate(`/profile/${friend.id}`)}
                className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 text-start transition-colors hover:bg-gray-100"
              >
                {friend.photoUrl ? (
                  <img src={friend.photoUrl} alt={friend.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${friend.avatarColor} text-xs font-bold text-white`}>
                    {friend.initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{friend.name}</p>
                  {friend.position ? <p className="text-xs text-gray-400">{friend.position}</p> : null}
                </div>
                <p className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-700">
                  <Trophy size={14} />
                  {friend.competitivePoints ?? 0}
                </p>
              </button>
            ))}
          </div>
        </ProfileSection>
      ) : null}

      {hasCompetitiveHistory ? (
        <ProfileSection
          title={lang === 'he' ? 'היסטוריית נקודות תחרות' : 'Competitive points history'}
          description={
            lang === 'he'
              ? `${competitivePointsTotal} נקודות תחרות • ${competitiveWins} ניצחונות • ${competitiveLosses} הפסדים • ${competitiveGamesPlayed > 0 ? competitivePointsPerGame.toFixed(1) : '0.0'} נק׳ למשחק`
              : `${competitivePointsTotal} competitive points • ${competitiveWins} wins • ${competitiveLosses} losses • ${competitiveGamesPlayed > 0 ? competitivePointsPerGame.toFixed(1) : '0.0'} pts/game`
          }
          aside={(
            <div className="rounded-2xl bg-primary-50 px-3 py-2 text-center">
              <p className="text-lg font-bold text-primary-700">{competitivePointsTotal}</p>
              <p className="text-[11px] text-primary-600">{lang === 'he' ? 'סה״כ' : 'Total'}</p>
            </div>
          )}
        >
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryChip label={lang === 'he' ? 'ניצחונות' : 'Wins'} value={`${competitiveWins}`} />
            <SummaryChip label={lang === 'he' ? 'הפסדים' : 'Losses'} value={`${competitiveLosses}`} />
            <SummaryChip
              label={lang === 'he' ? 'שינוי אחרון' : 'Latest change'}
              value={latestCompetitiveGain != null ? formatSignedPoints(latestCompetitiveGain) : '—'}
            />
            <SummaryChip
              label={lang === 'he' ? 'נק׳ למשחק' : 'Pts / game'}
              value={competitiveGamesPlayed > 0 ? competitivePointsPerGame.toFixed(1) : '—'}
            />
          </div>

          {loadingCompetitiveHistory ? (
            <p className="text-sm text-gray-500">{lang === 'he' ? 'טוען היסטוריית תחרות...' : 'Loading competitive history...'}</p>
          ) : competitiveHistory.length > 0 ? (
            <div className="space-y-3">
              {competitiveHistory.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => navigate(`/lobby/${entry.lobbyId}`)}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-start transition-colors hover:bg-gray-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50">
                        <Trophy size={16} className="text-primary-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{entry.lobbyTitle}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {new Date(entry.lobbyDate).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US')}
                          {entry.city ? ` • ${entry.city}` : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${teamColorClassName(entry.teamColor)}`} />
                          <span>
                            {lang === 'he'
                              ? `קבוצה ${getTeamColorLabel(entry.teamColor, lang)}`
                              : `${getTeamColorLabel(entry.teamColor, lang)} Team`}
                          </span>
                          <span>•</span>
                          <span>{formatRankLabel(entry.rank, lang)}</span>
                          <span>•</span>
                          <span>{entry.wins} {lang === 'he' ? 'ניצחונות' : 'wins'}</span>
                        </div>
                        {entry.notes ? (
                          <p className="mt-2 whitespace-pre-wrap text-xs text-amber-800">
                            {lang === 'he' ? 'הערת מארגן: ' : 'Organizer note: '}
                            {entry.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-sm font-semibold text-primary-700">{formatSignedPoints(entry.points)}</p>
                      <p className="text-xs text-gray-400">{lang === 'he' ? 'נקודות' : 'points'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {lang === 'he' ? 'עדיין אין היסטוריית נקודות תחרות.' : 'No competitive points history yet.'}
            </p>
          )}
        </ProfileSection>
      ) : null}

      {hasLobbyHistory ? (
        <ProfileSection
          title={lang === 'he' ? 'משחקים אחרונים' : 'Recent Games'}
          action={lobbyHistory.length > 0 ? (
            <button
              type="button"
              onClick={() => navigate(`/profile/${profile.id}/history`)}
              className="text-xs font-semibold text-primary-600 hover:underline"
            >
              {lang === 'he' ? 'צפה בהכל' : 'View all'}
            </button>
          ) : undefined}
        >
          {loadingLobbyHistory ? (
            <p className="text-sm text-gray-500">{lang === 'he' ? 'טוען היסטוריית משחקים...' : 'Loading game history...'}</p>
          ) : lobbyHistory.length > 0 ? (
            <div className="space-y-3">
              {visibleLobbyHistory.map((entry, index) => (
                <button
                  key={`${entry.lobbyId}-${index}`}
                  type="button"
                  onClick={() => navigate(`/lobby/${entry.lobbyId}`)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-start transition-colors hover:bg-gray-100"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50">
                    <MapPin size={15} className="text-primary-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{entry.lobbyTitle}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {new Date(entry.date).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US')}
                      {entry.city ? ` • ${entry.city}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-gray-400">
                    {lang === 'he' ? 'לצפייה בלובי' : 'Open lobby'}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {lang === 'he' ? 'עדיין אין היסטוריית משחקים.' : 'No recent games yet.'}
            </p>
          )}
        </ProfileSection>
      ) : null}

      {lightboxPhoto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightboxPhoto(null)}>
          <button
            type="button"
            onClick={() => setLightboxPhoto(null)}
            className="absolute end-4 top-4 rounded-full bg-black/40 p-2 text-white transition-colors hover:bg-black/60"
          >
            <X size={20} />
          </button>
          <img
            src={lightboxPhoto}
            alt={profile.name}
            className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </main>
  );
}

function ProfileSection({
  title,
  description,
  action,
  aside,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          {description ? <p className="mt-1 text-xs text-gray-500">{description}</p> : null}
        </div>
        {action ?? aside ?? null}
      </div>
      {children}
    </section>
  );
}

function StatBox({ value, label, color = 'text-gray-900' }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 px-4 py-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
