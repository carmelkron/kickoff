import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Clock, MapPin, Pencil, Trophy, UserCheck, UserPlus, UserX, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { fetchCompetitivePointHistory, fetchProfileLobbyHistory } from '../lib/appData';
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

function formatRankLabel(rank: number, lang: 'he' | 'en') {
  const roundedRank = Number.isInteger(rank) ? `${rank}` : rank.toFixed(1);
  return lang === 'he' ? `מקום ${roundedRank}` : `Place ${roundedRank}`;
}

type HistoryView = 'competitive' | 'games';

export default function ProfileLive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lang } = useLang();
  const { currentUser, getAllUsers, sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend } = useAuth();
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [competitiveHistory, setCompetitiveHistory] = useState<CompetitivePointHistoryEntry[]>([]);
  const [loadingCompetitiveHistory, setLoadingCompetitiveHistory] = useState(false);
  const [lobbyHistory, setLobbyHistory] = useState<LobbyHistoryEntry[]>([]);
  const [loadingLobbyHistory, setLoadingLobbyHistory] = useState(false);
  const [historyView, setHistoryView] = useState<HistoryView>('competitive');

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

  const pendingRequests = useMemo(() => {
    if (!isMe || !currentUser) {
      return [];
    }

    return currentUser.pendingRequests
      .map((requesterId) => allUsers.find((user) => user.id === requesterId))
      .filter((user): user is AuthUser => Boolean(user));
  }, [allUsers, currentUser, isMe]);

  const friendsList = useMemo(() => {
    if (!isMe || !currentUser) {
      return [];
    }

    return currentUser.friends
      .map((friendId) => allUsers.find((user) => user.id === friendId))
      .filter((user): user is AuthUser => Boolean(user));
  }, [allUsers, currentUser, isMe]);

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
      setActionError(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setBusyAction('');
    }
  }

  if (!profile && allUsers.length === 0) {
    return <div className="max-w-2xl mx-auto px-4 py-20 text-center text-gray-500">{lang === 'he' ? 'טוען פרופיל...' : 'Loading profile...'}</div>;
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500">{lang === 'he' ? 'משתמש לא נמצא' : 'User not found'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary-600 underline">
          {lang === 'he' ? 'חזרה' : 'Back'}
        </button>
      </div>
    );
  }

  const competitivePointsTotal =
    competitiveHistory.length > 0
      ? competitiveHistory.reduce((sum, entry) => sum + entry.points, 0)
      : profile.competitivePoints ?? 0;
  const hasCompetitiveHistory = loadingCompetitiveHistory || competitiveHistory.length > 0 || competitivePointsTotal > 0;
  const hasLobbyHistory = loadingLobbyHistory || lobbyHistory.length > 0;
  const latestCompetitiveGain = competitiveHistory[0]?.points ?? null;

  const historyTabs = [
    hasCompetitiveHistory
      ? { id: 'competitive' as const, label: lang === 'he' ? 'תחרותי' : 'Competitive' }
      : null,
    hasLobbyHistory
      ? { id: 'games' as const, label: lang === 'he' ? 'משחקים' : 'Games' }
      : null,
  ].filter((tab): tab is { id: HistoryView; label: string } => Boolean(tab));

  useEffect(() => {
    if (historyTabs.length === 0) {
      return;
    }

    if (!historyTabs.some((tab) => tab.id === historyView)) {
      setHistoryView(historyTabs[0].id);
    }
  }, [historyTabs, historyView]);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-6 transition-colors">
        <ChevronLeft size={16} />
        {lang === 'he' ? 'חזרה' : 'Back'}
      </button>

      {pendingRequests.length > 0 && (
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5 mb-4">
          <h3 className="font-semibold text-blue-800 mb-3">
            {lang === 'he' ? `בקשות חברות (${pendingRequests.length})` : `Friend Requests (${pendingRequests.length})`}
          </h3>
          <div className="space-y-3">
            {pendingRequests.map((requester) => (
              <div key={requester.id} className="flex items-center gap-3">
                {requester.photoUrl ? (
                  <img src={requester.photoUrl} alt={requester.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className={`w-9 h-9 rounded-full ${requester.avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {requester.initials}
                  </div>
                )}
                <span className="flex-1 text-sm font-medium text-gray-800">{requester.name}</span>
                <button
                  onClick={() => void runAction(`accept-${requester.id}`, () => acceptFriendRequest(requester.id))}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {lang === 'he' ? 'אשר' : 'Accept'}
                </button>
                <button
                  onClick={() => void runAction(`decline-${requester.id}`, () => declineFriendRequest(requester.id))}
                  className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
                >
                  {lang === 'he' ? 'דחה' : 'Decline'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex items-start gap-5">
          <div className="shrink-0">
            {profile.photoUrl ? (
              <button
                type="button"
                onClick={() => setLightboxPhoto(profile.photoUrl!)}
                className="block cursor-zoom-in"
              >
                <img src={profile.photoUrl} alt={profile.name} className="w-20 h-20 rounded-full object-cover hover:opacity-90 transition-opacity" />
              </button>
            ) : (
              <div className={`w-20 h-20 rounded-full ${profile.avatarColor} flex items-center justify-center text-white text-2xl font-bold`}>
                {profile.initials}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
                {profile.position && <p className="text-sm text-gray-500 mt-0.5">{profile.position}</p>}
                {profile.gender && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {profile.gender === 'male' ? '👨 ' : profile.gender === 'female' ? '👩 ' : '⚧ '}
                    {profile.gender === 'male' ? (lang === 'he' ? 'זכר' : 'Male') : profile.gender === 'female' ? (lang === 'he' ? 'נקבה' : 'Female') : (lang === 'he' ? 'אחר' : 'Other')}
                  </p>
                )}
                {isMe && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                      {lang === 'he' ? 'הפרופיל שלי' : 'My Profile'}
                    </span>
                    <button
                      onClick={() => navigate(`/profile/${currentUser!.id}/edit`)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 transition-colors"
                    >
                      <Pencil size={12} />
                      {lang === 'he' ? 'ערוך' : 'Edit'}
                    </button>
                  </div>
                )}
              </div>
              <div className="rounded-2xl bg-primary-50 p-3 text-center">
                <p className="text-2xl font-bold text-primary-700">🏆 {competitivePointsTotal}</p>
                <p className="text-xs text-gray-500 mt-0.5">{lang === 'he' ? 'נק׳ תחרות' : 'Comp. points'}</p>
              </div>
            </div>

            {profile.bio && <p className="text-sm text-gray-600 mt-3">{profile.bio}</p>}

            {!isMe && currentUser && (
              <div className="mt-3">
                {friendStatus === 'none' && (
                  <button
                    onClick={() => void runAction(`send-${profile.id}`, () => sendFriendRequest(profile.id))}
                    disabled={busyAction !== ''}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    <UserPlus size={14} />
                    {lang === 'he' ? 'שלח בקשת חברות' : 'Send Friend Request'}
                  </button>
                )}

                {friendStatus === 'sent' && (
                  <div className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-500 text-sm font-medium rounded-xl">
                    <Clock size={14} />
                    {lang === 'he' ? 'בקשה נשלחה' : 'Request sent'}
                  </div>
                )}

                {friendStatus === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void runAction(`accept-${profile.id}`, () => acceptFriendRequest(profile.id))}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      <UserCheck size={14} />
                      {lang === 'he' ? 'אשר חברות' : 'Accept'}
                    </button>
                    <button
                      onClick={() => void runAction(`decline-${profile.id}`, () => declineFriendRequest(profile.id))}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <UserX size={14} />
                      {lang === 'he' ? 'דחה' : 'Decline'}
                    </button>
                  </div>
                )}

                {friendStatus === 'friend' && (
                  <button
                    onClick={() => void runAction(`remove-${profile.id}`, () => removeFriend(profile.id))}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-50 hover:bg-red-50 text-green-700 hover:text-red-600 text-sm font-semibold rounded-xl border border-green-200 hover:border-red-200 transition-colors"
                  >
                    <UserCheck size={14} />
                    {lang === 'he' ? 'חבר ✓' : 'Friends ✓'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {actionError && <p className="text-red-500 text-sm mt-4">{actionError}</p>}

        <div className="grid grid-cols-2 gap-4 mt-5 border-t border-gray-100 pt-5 sm:grid-cols-4">
          <StatBox value={profile.gamesPlayed} label={lang === 'he' ? 'משחקים' : 'Games'} />
          <StatBox value={competitivePointsTotal} label={lang === 'he' ? 'נק׳ תחרות' : 'Comp. points'} color="text-primary-700" />
          <StatBox
            value={
              latestCompetitiveGain != null
                ? `+${latestCompetitiveGain}`
                : '—'
            }
            label={lang === 'he' ? 'רווח אחרון' : 'Latest gain'}
            color={latestCompetitiveGain != null ? 'text-green-600' : 'text-gray-400'}
          />
        </div>
      </div>

      {historyTabs.length > 0 && (
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {historyTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHistoryView(tab.id)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  historyView === tab.id
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasCompetitiveHistory && historyView === 'competitive' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">
                {lang === 'he' ? 'נקודות תחרות והיסטוריה' : 'Competitive points history'}
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                {lang === 'he'
                  ? `סה״כ ${competitivePointsTotal} נקודות תחרות`
                  : `${competitivePointsTotal} total competitive points`}
              </p>
            </div>
            <div className="rounded-2xl bg-primary-50 px-3 py-2 text-center">
              <p className="text-lg font-bold text-primary-700">{competitivePointsTotal}</p>
              <p className="text-[11px] text-primary-600">{lang === 'he' ? 'סה״כ' : 'Total'}</p>
            </div>
          </div>

          {loadingCompetitiveHistory ? (
            <p className="text-sm text-gray-500">{lang === 'he' ? 'טוען היסטוריה תחרותית...' : 'Loading competitive history...'}</p>
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
                        {entry.notes && (
                          <p className="mt-2 whitespace-pre-wrap text-xs text-amber-800">
                            {lang === 'he' ? 'הערת מארגן: ' : 'Organizer note: '}
                            {entry.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-sm font-semibold text-primary-700">+{entry.points}</p>
                      <p className="text-xs text-gray-400">{lang === 'he' ? 'נקודות' : 'points'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {lang === 'he' ? 'אין עדיין היסטוריית נקודות תחרות.' : 'No competitive points history yet.'}
            </p>
          )}
        </div>
      )}

      {isMe && friendsList.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <h2 className="font-semibold text-gray-900 mb-4">
            {lang === 'he' ? `חברים (${friendsList.length})` : `Friends (${friendsList.length})`}
          </h2>
          <div className="space-y-2">
            {friendsList.map((friend) => (
              <button
                key={friend.id}
                onClick={() => navigate(`/profile/${friend.id}`)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors text-start"
              >
                {friend.photoUrl ? (
                  <img src={friend.photoUrl} alt={friend.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className={`w-9 h-9 rounded-full ${friend.avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {friend.initials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{friend.name}</p>
                  {friend.position && <p className="text-xs text-gray-400">{friend.position}</p>}
                </div>
                <div className="shrink-0 text-end">
                  <p className="text-sm font-semibold text-primary-700">🏆 {friend.competitivePoints ?? 0}</p>
                  <p className="text-xs text-gray-400">{friend.gamesPlayed} {lang === 'he' ? 'משחקים' : 'games'}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {hasLobbyHistory && historyView === 'games' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">{lang === 'he' ? 'משחקים אחרונים' : 'Recent Games'}</h2>
          <div className="space-y-3">
            {lobbyHistory.map((entry, index) => (
              <button
                key={`${entry.lobbyId}-${index}`}
                type="button"
                onClick={() => navigate(`/lobby/${entry.lobbyId}`)}
                className="flex w-full items-center gap-3 rounded-xl border-b border-gray-50 py-2 text-start transition-colors hover:bg-gray-50 last:border-0"
              >
                <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">
                  <MapPin size={15} className="text-primary-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{entry.lobbyTitle}</p>
                  <p className="text-xs text-gray-400">{entry.city}</p>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-xs text-gray-400">{new Date(entry.date).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US')}</p>
                  <span className="text-xs font-medium text-gray-400">
                    {lang === 'he' ? 'לצפייה בלובי' : 'Open lobby'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-4 end-4 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors"
          >
            <X size={20} />
          </button>
          <img
            src={lightboxPhoto}
            alt={profile.name}
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}

function StatBox({ value, label, color = 'text-gray-900' }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
