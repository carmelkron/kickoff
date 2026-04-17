import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, ChevronLeft, Clock, ExternalLink, Handshake, LoaderCircle, Lock, MapPin, Pencil, ShieldCheck, Trash2, Trophy, Users } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { approveLobbyJoinRequest, assignLobbyOrganizer, createLobbyInvite, declineLobbyJoinRequest, deleteLobby, deleteLobbyMembership, fetchContributions, fetchLobbyById, fetchLobbyInvites, fetchLobbyJoinRequests, fetchLobbyResult, fetchLobbyTeams, generateLobbyTeams, passLobbyWaitlistSpot, removeLobbyOrganizer, requestLobbyAccess, submitCompetitiveLobbyResult, swapLobbyTeamPlayers, toggleContribution, upsertLobbyMembership } from '../lib/appData';
import { canSubmitLobbyResult, getLobbyResultReminderTime } from '../lib/lobbyResultReminders';
import { canManageLobby } from '../lib/lobbyRoles';
import { getJoinLobbyError, getJoinLobbyTargetStatus } from '../lib/validation';
import type { ContributionType, Lobby, LobbyInvite, LobbyJoinRequest, LobbyResultSummary, LobbyTeamAssignment, TeamColor } from '../types';
import { formatDateTime } from '../utils/format';
import { formatAgeRange } from '../utils/age';
import { getDistanceSourceText, loadSessionDistancePreference } from '../utils/distanceSource';
import { haversineKm } from '../utils/geo';
import { formatLocationLabel } from '../utils/location';
import LocationPreviewMap from '../components/LocationPreviewMap';
import LobbyChat from '../components/LobbyChat';
import { getPreferredPositionLabel, getTeamColorLabel, normalizePreferredPosition } from '../lib/teamAssignment';
import { calculateCompetitiveStandings } from '../lib/competitiveResults';

type MyStatus = 'none' | 'joined' | 'waitlisted' | 'pending_confirm';

function avgCompetitivePoints(players: Array<{ competitivePoints?: number }>) {
  if (!players.length) {
    return null;
  }

  return players.reduce((sum, player) => sum + (player.competitivePoints ?? 0), 0) / players.length;
}

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

export default function LobbyDetailLive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const { currentUser, getAllUsers } = useAuth();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [contributions, setContributions] = useState<{ profileId: string; type: ContributionType }[]>([]);
  const [invites, setInvites] = useState<LobbyInvite[]>([]);
  const [joinRequests, setJoinRequests] = useState<LobbyJoinRequest[]>([]);
  const [teams, setTeams] = useState<LobbyTeamAssignment[]>([]);
  const [distancePreference, setDistancePreference] = useState(() => loadSessionDistancePreference());
  const [generatingTeams, setGeneratingTeams] = useState(false);
  const [selectedSwapPlayer, setSelectedSwapPlayer] = useState<{ profileId: string; teamId: string } | null>(null);
  const [swappingTeams, setSwappingTeams] = useState(false);
  const [swappingPairLabel, setSwappingPairLabel] = useState<{ fromName: string; toName: string } | null>(null);
  const [lobbyResult, setLobbyResult] = useState<LobbyResultSummary | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultWins, setResultWins] = useState<Record<string, number>>({});
  const [resultNotes, setResultNotes] = useState('');
  const [submittingResult, setSubmittingResult] = useState(false);
  const [resultModalDismissed, setResultModalDismissed] = useState(false);
  const [invitingProfileId, setInvitingProfileId] = useState('');

  async function loadLobby() {
    if (!id) {
      setLobby(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const [nextLobby, nextContributions, nextTeams, nextResult] = await Promise.all([
        fetchLobbyById(id),
        fetchContributions(id),
        fetchLobbyTeams(id),
        fetchLobbyResult(id),
      ]);
      const nextInvites =
        nextLobby && currentUser?.id === nextLobby.createdBy
          ? await fetchLobbyInvites(id)
          : [];
      const nextJoinRequests =
        nextLobby && currentUser && canManageLobby(nextLobby, currentUser.id) && nextLobby.accessType === 'locked'
          ? await fetchLobbyJoinRequests(id)
          : [];
      setLobby(nextLobby);
      setContributions(nextContributions);
      setInvites(nextLobby?.accessType === 'locked' ? nextInvites : []);
      setJoinRequests(nextJoinRequests.filter((request) => request.status === 'pending'));
      setTeams(nextTeams);
      setLobbyResult(nextResult);
      setResultNotes(nextResult?.notes ?? '');
      setResultModalDismissed(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load game');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLobby();
  }, [id, currentUser?.id]);

  useEffect(() => {
    setDistancePreference(loadSessionDistancePreference());
  }, []);

  const canSubmitResult =
    Boolean(lobby && canManageLobby(lobby, currentUser?.id))
    && lobby?.gameType === 'competitive'
    && (lobby ? canSubmitLobbyResult(lobby.datetime) : false)
    && teams.length > 0
    && lobbyResult == null;

  useEffect(() => {
    if (!showResultModal || teams.length === 0) {
      return;
    }

    setResultWins((current) => {
      const nextEntries = teams.map((assignment) => [assignment.team.id, current[assignment.team.id] ?? 0] as const);
      return Object.fromEntries(nextEntries);
    });
  }, [showResultModal, teams]);

  useEffect(() => {
    if (!canSubmitResult || showResultModal || resultModalDismissed) {
      return;
    }

    setShowResultModal(true);
  }, [canSubmitResult, resultModalDismissed, showResultModal]);

  if (!id) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-20 text-center text-gray-500">{lang === 'he' ? 'טוען משחק...' : 'Loading game...'}</div>;
  }

  if (!lobby) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500 text-lg">{error || (lang === 'he' ? 'המשחק לא נמצא' : 'Game not found')}</p>
        <button onClick={() => navigate('/')} className="mt-4 text-primary-600 underline">
          {t.lobby.back}
        </button>
      </div>
    );
  }

  const resolvedLobby = lobby;
  const lobbyId = resolvedLobby.id;
  const allUsers = getAllUsers();

  const isFull = resolvedLobby.players.length >= resolvedLobby.maxPlayers;
  const dateStr = formatDateTime(resolvedLobby.datetime, lang, t.common.today, t.common.tomorrow);
  const avg = avgCompetitivePoints(resolvedLobby.players);
  const isCompetitive = resolvedLobby.gameType === 'competitive';
  const isCreator = currentUser?.id === resolvedLobby.createdBy;
  const canManageCurrentLobby = canManageLobby(resolvedLobby, currentUser?.id);
  const isLobbyActive = resolvedLobby.status === 'active';
  const isLobbyExpired = resolvedLobby.status === 'expired';
  const viewerJoinRequestStatus = resolvedLobby.viewerJoinRequestStatus ?? null;
  const viewerCanRequestAccess =
    resolvedLobby.accessType === 'locked'
    && !resolvedLobby.viewerHasAccess
    && !canManageCurrentLobby;
  const hasCoords = resolvedLobby.latitude != null && resolvedLobby.longitude != null;
  const hasCurrentLocation =
    distancePreference.locationMode === 'current' && distancePreference.currentCoords != null;
  const refPoint =
    hasCurrentLocation
      ? distancePreference.currentCoords
      : currentUser?.homeLatitude != null && currentUser?.homeLongitude != null
        ? { lat: currentUser.homeLatitude, lng: currentUser.homeLongitude }
        : null;
  const distanceFromUserKm =
    refPoint && hasCoords
      ? haversineKm(refPoint.lat, refPoint.lng, resolvedLobby.latitude!, resolvedLobby.longitude!)
      : null;
  const distanceSourceText = getDistanceSourceText(hasCurrentLocation ? 'current' : 'home', lang, 'full');
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${resolvedLobby.latitude},${resolvedLobby.longitude}`
    : `https://maps.google.com/?q=${encodeURIComponent(formatLocationLabel(resolvedLobby.address, resolvedLobby.city))}`;
  const wazeUrl = hasCoords
    ? `https://waze.com/ul?ll=${resolvedLobby.latitude},${resolvedLobby.longitude}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(formatLocationLabel(resolvedLobby.address, resolvedLobby.city))}&navigate=yes`;
  const ballContributors = new Set(contributions.filter((c) => c.type === 'ball').map((c) => c.profileId));
  const speakerContributors = new Set(contributions.filter((c) => c.type === 'speaker').map((c) => c.profileId));
  const resultReminderAt = getLobbyResultReminderTime(resolvedLobby.datetime);
  const resultReminderDateStr = formatDateTime(
    resultReminderAt.toISOString(),
    lang,
    t.common.today,
    t.common.tomorrow,
  );
  const resultSubmissionOpen = canSubmitLobbyResult(resolvedLobby.datetime);
  const resultSubmittedAtStr = lobbyResult
    ? formatDateTime(lobbyResult.submittedAt, lang, t.common.today, t.common.tomorrow)
    : '';
  const resultReporterText = lobbyResult
    ? (
        lobbyResult.submittedByProfileName
          ? (
              lang === 'he'
                ? `דווח על ידי ${lobbyResult.submittedByProfileName} ב-${resultSubmittedAtStr}`
                : `Reported by ${lobbyResult.submittedByProfileName} on ${resultSubmittedAtStr}`
            )
          : (
              lang === 'he'
                ? `דווח ב-${resultSubmittedAtStr}`
                : `Reported on ${resultSubmittedAtStr}`
            )
      )
    : '';
  const hasMissingPreferredPosition = resolvedLobby.players.some((player) => !normalizePreferredPosition(player.position));
  const canGenerateTeams =
    canManageCurrentLobby
    && isLobbyActive
    && Boolean(resolvedLobby.numTeams && resolvedLobby.playersPerTeam)
    && resolvedLobby.players.length === resolvedLobby.maxPlayers
    && !hasMissingPreferredPosition
    && teams.length === 0;
  const resultPreview =
    teams.length > 0
      ? calculateCompetitiveStandings(
          teams.map((assignment) => ({
            teamId: assignment.team.id,
            color: assignment.team.color,
            teamNumber: assignment.team.teamNumber,
            wins: resultWins[assignment.team.id] ?? 0,
          })),
        )
      : [];
  const myWaitlistIndex = currentUser ? resolvedLobby.waitlist.findIndex((player) => player.id === currentUser.id) : -1;
  const pendingWaitlistIds = resolvedLobby.pendingWaitlistIds ?? [];
  const passedWaitlistIds = resolvedLobby.passedWaitlistIds ?? [];
  const isPendingWaitlistSpot = currentUser ? pendingWaitlistIds.includes(currentUser.id) : false;
  const hasPassedWaitlistSpot = currentUser ? passedWaitlistIds.includes(currentUser.id) : false;
  const inviteCandidateIds = new Set(invites.map((invite) => invite.invitedProfileId));
  const inviteCandidates =
    currentUser
      ? currentUser.friends
          .flatMap((friendId) => {
            const user = allUsers.find((candidate) => candidate.id === friendId);
            return user ? [user] : [];
          })
          .filter((user) => !resolvedLobby.players.some((player) => player.id === user.id))
          .filter((user) => !resolvedLobby.waitlist.some((player) => player.id === user.id))
          .filter((user) => !inviteCandidateIds.has(user.id))
      : [];
  const secondaryOrganizerPlayers = resolvedLobby.players.filter((player) => resolvedLobby.organizerIds.includes(player.id));
  const organizerCandidatePlayers = resolvedLobby.players.filter((player) => (
    player.id !== resolvedLobby.createdBy && !resolvedLobby.organizerIds.includes(player.id)
  ));
  const ageRangeLabel = formatAgeRange(resolvedLobby.minAge, resolvedLobby.maxAge, lang);

  const myStatus: MyStatus = (() => {
    if (!currentUser) {
      return 'none';
    }
    if (lobby.players.some((player) => player.id === currentUser.id)) {
      return 'joined';
    }
    if (isPendingWaitlistSpot) {
      return 'pending_confirm';
    }
    if (myWaitlistIndex >= 0) {
      return 'waitlisted';
    }
    return 'none';
  })();
  const myTeamAssignment =
    currentUser
      ? teams.find((assignment) => assignment.players.some((player) => player.id === currentUser.id)) ?? null
      : null;
  const canViewLobbyChat = Boolean(currentUser && (isCreator || myStatus !== 'none'));
  const canSendLobbyChat = canViewLobbyChat;
  const myTeamResult =
    myTeamAssignment && lobbyResult
      ? lobbyResult.teamResults.find((teamResult) => teamResult.lobbyTeamId === myTeamAssignment.team.id) ?? null
      : null;

  async function runMembershipAction(action: () => Promise<void>) {
    setSaving(true);
    setError('');
    try {
      await action();
      await loadLobby();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to update membership');
    } finally {
      setSaving(false);
    }
  }

  function handleJoin() {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    if (!isLobbyActive) {
      setError(lang === 'he' ? 'לא ניתן להצטרף ללובי שפג תוקפו.' : 'You cannot join an expired lobby.');
      return;
    }

    if (viewerCanRequestAccess) {
      void runMembershipAction(() => requestLobbyAccess(lobbyId, currentUser.id));
      return;
    }

    const joinError = getJoinLobbyError(resolvedLobby, currentUser);
    if (joinError) {
      setError(joinError);
      return;
    }

    void runMembershipAction(() =>
      upsertLobbyMembership(lobbyId, currentUser.id, getJoinLobbyTargetStatus(resolvedLobby)),
    );
  }

  function handleLeave() {
    if (!currentUser) {
      return;
    }

    void runMembershipAction(() => deleteLobbyMembership(lobbyId, currentUser.id));
  }

  function handleConfirm() {
    if (!currentUser) {
      return;
    }

    void runMembershipAction(() => upsertLobbyMembership(lobbyId, currentUser.id, 'joined'));
  }

  function handlePassToNext() {
    if (!currentUser) {
      return;
    }

    void runMembershipAction(() => passLobbyWaitlistSpot(lobbyId, currentUser.id));
  }

  async function handleDeleteLobby() {
    if (!currentUser || !isCreator) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      await deleteLobby(lobbyId);
      navigate('/', { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to delete game');
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleToggleContribution(type: ContributionType) {
    if (!currentUser) return;
    const currentlyActive = type === 'ball' ? ballContributors.has(currentUser.id) : speakerContributors.has(currentUser.id);
    try {
      await toggleContribution(lobbyId, currentUser.id, type, currentlyActive);
      const nextContributions = await fetchContributions(lobbyId);
      setContributions(nextContributions);
    } catch {
      // silent fail
    }
  }

  async function handleGenerateTeams() {
    if (!currentUser || !canManageCurrentLobby) {
      return;
    }

    setGeneratingTeams(true);
    setError('');
    try {
      const nextTeams = await generateLobbyTeams(lobbyId, currentUser.id);
      setTeams(nextTeams);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to generate teams');
    } finally {
      setGeneratingTeams(false);
    }
  }

  async function handleInvitePlayer(profileId: string) {
    if (!currentUser) {
      return;
    }

    setInvitingProfileId(profileId);
    setError('');
    try {
      await createLobbyInvite(lobbyId, currentUser.id, profileId);
      const nextInvites = await fetchLobbyInvites(lobbyId);
      setInvites(nextInvites);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to send invite');
    } finally {
      setInvitingProfileId('');
    }
  }

  async function handleJoinRequestAction(action: 'approve' | 'decline', requesterProfileId: string) {
    if (!currentUser || !canManageCurrentLobby) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (action === 'approve') {
        await approveLobbyJoinRequest(lobbyId, requesterProfileId, currentUser.id);
      } else {
        await declineLobbyJoinRequest(lobbyId, requesterProfileId, currentUser.id);
      }
      await loadLobby();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to update access request');
    } finally {
      setSaving(false);
    }
  }

  async function handleSwapPlayers(targetProfileId: string, targetTeamId: string) {
    if (!currentUser || !selectedSwapPlayer || !canManageCurrentLobby) {
      return;
    }

    if (selectedSwapPlayer.profileId === targetProfileId) {
      setSelectedSwapPlayer(null);
      return;
    }

    if (selectedSwapPlayer.teamId === targetTeamId) {
      setSelectedSwapPlayer({ profileId: targetProfileId, teamId: targetTeamId });
      return;
    }

    const allTeamPlayers = teams.flatMap((assignment) => assignment.players);
    const sourcePlayer = allTeamPlayers.find((player) => player.id === selectedSwapPlayer.profileId);
    const targetPlayer = allTeamPlayers.find((player) => player.id === targetProfileId);

    setSwappingTeams(true);
    setSwappingPairLabel(
      sourcePlayer && targetPlayer
        ? { fromName: sourcePlayer.name, toName: targetPlayer.name }
        : null,
    );
    setError('');
    try {
      const nextTeams = await swapLobbyTeamPlayers(
        lobbyId,
        currentUser.id,
        selectedSwapPlayer.profileId,
        targetProfileId,
      );
      setTeams(nextTeams);
      setSelectedSwapPlayer(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to swap players');
    } finally {
      setSwappingTeams(false);
      setSwappingPairLabel(null);
    }
  }

  function changeTeamWins(teamId: string, delta: number) {
    setResultWins((current) => {
      const nextValue = Math.max(0, (current[teamId] ?? 0) + delta);
      return {
        ...current,
        [teamId]: nextValue,
      };
    });
  }

  async function handleSubmitResult() {
    if (!currentUser || !canManageCurrentLobby) {
      return;
    }

    setSubmittingResult(true);
    setError('');
    try {
      const nextResult = await submitCompetitiveLobbyResult(
        lobbyId,
        currentUser.id,
        resultWins,
        resultNotes.trim().slice(0, 500) || undefined,
      );
      setLobbyResult(nextResult);
      setResultNotes(nextResult.notes ?? '');
      setShowResultModal(false);
      await loadLobby();
    } catch (nextError) {
      const nextMessage = nextError instanceof Error ? nextError.message : 'Failed to submit result';
      if (nextMessage === 'Another organizer already submitted the result for this lobby.') {
        await loadLobby();
        setShowResultModal(false);
        setResultModalDismissed(false);
        setError(
          lang === 'he'
            ? 'מארגן אחר כבר דיווח את התוצאה. רעננו עבורך את התוצאה השמורה.'
            : 'Another organizer already submitted the result. I refreshed the saved result for you.',
        );
      } else {
        setError(nextMessage);
      }
    } finally {
      setSubmittingResult(false);
    }
  }

  async function handleAssignOrganizer(profileId: string) {
    if (!currentUser || !isCreator) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      await assignLobbyOrganizer(lobbyId, currentUser.id, profileId);
      await loadLobby();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to assign organizer');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveOrganizer(profileId: string) {
    if (!currentUser || !isCreator) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      await removeLobbyOrganizer(lobbyId, currentUser.id, profileId);
      await loadLobby();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to remove organizer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition-colors">
          <ChevronLeft size={16} />
          {t.lobby.back}
        </button>
        {isCreator && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/lobby/${lobbyId}/edit`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 border border-primary-200 hover:bg-primary-50 rounded-xl transition-colors"
            >
              <Pencil size={14} />
              {lang === 'he' ? 'ערוך' : 'Edit'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-60 rounded-xl transition-colors"
            >
              <Trash2 size={14} />
              {t.lobby.delete}
            </button>
          </div>
        )}
      </div>

      {isCreator && showDeleteConfirm && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{t.lobby.deleteConfirm}</p>
          <p className="mt-1 text-xs text-red-600">{t.lobby.deleteWarning}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void handleDeleteLobby()}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {t.lobby.deleteApprove}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 text-sm font-medium text-gray-700 transition-colors"
            >
              {t.lobby.deleteCancel}
            </button>
          </div>
        </div>
      )}

      {resolvedLobby.accessType === 'locked' && (
        <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-gray-900 p-2 text-white">
              <Lock size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {lang === 'he' ? 'לובי נעול' : 'Locked lobby'}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {lang === 'he'
                  ? 'כולם יכולים לראות את הלובי. כדי להיכנס צריך גישה: משתתפים, מוזמנים, חברים של מי שכבר בפנים, או אישור מהמארגן.'
                  : 'Everyone can view this lobby. Entering requires access: participants, invited players, friends of current participants, or organizer approval.'}
              </p>
              {(resolvedLobby.viewerIsInvited || resolvedLobby.viewerHasFriendInside) && (
                <p className="mt-2 text-xs font-medium text-primary-700">
                  {resolvedLobby.viewerIsInvited
                    ? (lang === 'he' ? 'יש לכם הזמנה פעילה ללובי הזה.' : 'You have an active invitation to this lobby.')
                    : (lang === 'he' ? 'יש לכם חבר/ה שכבר בפנים, ולכן הלובי פתוח עבורכם.' : 'A friend of yours is already inside, so this lobby is available to you.')}
                </p>
              )}
              {viewerCanRequestAccess && viewerJoinRequestStatus === 'pending' && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  {lang === 'he' ? 'כבר שלחתם בקשת כניסה. מחכים לאישור המארגן.' : 'You already sent an access request. Waiting for organizer approval.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {isCreator && (
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {lang === 'he' ? 'מארגנים משניים' : 'Secondary organizers'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {lang === 'he'
                  ? 'מארגנים משניים יכולים לאשר בקשות כניסה, לסדר הרכבים, ולדווח תוצאות בסוף המשחק.'
                  : 'Secondary organizers can approve access requests, manage teams, and report results after the match.'}
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
              {lang === 'he' ? `${secondaryOrganizerPlayers.length} פעילים` : `${secondaryOrganizerPlayers.length} active`}
            </span>
          </div>

          {secondaryOrganizerPlayers.length > 0 ? (
            <div className="mt-4 space-y-2">
              {secondaryOrganizerPlayers.map((player) => (
                <div key={player.id} className="flex items-center gap-3 rounded-2xl bg-gray-50 px-3 py-2">
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt={player.name} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ${player.avatarColor} text-xs font-bold text-white`}>
                      {player.initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{player.name}</p>
                    <p className="text-xs text-gray-400">
                      {lang === 'he' ? 'יכול/ה לנהל בקשות, הרכבים ותוצאות' : 'Can manage requests, teams, and results'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemoveOrganizer(player.id)}
                    disabled={saving}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
                  >
                    {lang === 'he' ? 'הסר' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-gray-50 px-3 py-3 text-sm text-gray-500">
              {lang === 'he'
                ? 'עדיין לא הוגדרו מארגנים משניים ללובי הזה.'
                : 'No secondary organizers were assigned to this lobby yet.'}
            </p>
          )}

          <div className="mt-4 space-y-2">
            {organizerCandidatePlayers.length > 0 ? (
              organizerCandidatePlayers.map((player) => (
                <div key={player.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 px-3 py-2">
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt={player.name} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ${player.avatarColor} text-xs font-bold text-white`}>
                      {player.initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{player.name}</p>
                    <p className="text-xs text-gray-400">
                      {lang === 'he' ? 'משתתף/ת בלובי כרגע' : 'Currently joined in this lobby'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleAssignOrganizer(player.id)}
                    disabled={saving}
                    className="rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
                  >
                    {lang === 'he' ? 'הפוך למארגן משני' : 'Make organizer'}
                  </button>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-gray-50 px-3 py-3 text-sm text-gray-500">
                {lang === 'he'
                  ? 'אין כרגע משתתפים נוספים שאפשר להפוך למארגנים משניים.'
                  : 'There are no other joined players available to promote right now.'}
              </p>
            )}
          </div>
        </div>
      )}

      {canManageCurrentLobby && (
        <div className="mb-4 rounded-2xl border border-primary-100 bg-primary-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary-800">
                {lang === 'he' ? 'הרכבים ללובי' : 'Lobby lineups'}
              </p>
              <p className="mt-1 text-xs text-primary-700">
                {teams.length > 0
                  ? (lang === 'he' ? 'ההרכבים כבר ננעלו ונשלחה התראה לכל המשתתפים.' : 'Teams are locked and all participants were notified.')
                  : canGenerateTeams
                    ? (lang === 'he' ? 'הלובי מלא. אפשר ליצור עכשיו קבוצות מאוזנות ולשלוח לכולם שיבוץ.' : 'The lobby is full. You can create balanced teams now and notify everyone.')
                    : (lang === 'he' ? 'כדי ליצור קבוצות צריך לובי מלא עם כל העמדות מוגדרות.' : 'Teams can be created once the lobby is full and every player has a preferred position.')}
              </p>
            </div>
            <button
              onClick={() => void handleGenerateTeams()}
              disabled={!canGenerateTeams || generatingTeams}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {generatingTeams
                ? (lang === 'he' ? 'יוצר הרכבים...' : 'Creating teams...')
                : (lang === 'he' ? 'צור הרכבים' : 'Create teams')}
            </button>
          </div>
        </div>
      )}

      {isCreator && resolvedLobby.accessType === 'locked' && (
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {lang === 'he' ? 'הזמנת חברים ללובי' : 'Invite friends to this lobby'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {lang === 'he'
                  ? 'מוזמנים יקבלו התראה ויוכלו לפתוח את הלובי גם אם הוא נעול.'
                  : 'Invited players will get a notification and will be able to open this locked lobby.'}
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
              {lang === 'he' ? `${invites.length} מוזמנים` : `${invites.length} invited`}
            </span>
          </div>

          {invites.length > 0 && (
            <div className="mt-4 space-y-2">
              {invites.map((invite) => (
                <div key={invite.id} className="flex items-center gap-3 rounded-2xl bg-gray-50 px-3 py-2">
                  {invite.invitedPlayer.photoUrl ? (
                    <img src={invite.invitedPlayer.photoUrl} alt={invite.invitedPlayer.name} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ${invite.invitedPlayer.avatarColor} text-xs font-bold text-white`}>
                      {invite.invitedPlayer.initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{invite.invitedPlayer.name}</p>
                    <p className="text-xs text-gray-400">
                      {invite.status === 'accepted'
                        ? (lang === 'he' ? 'כבר נכנס ללובי' : 'Already joined from invite')
                        : (lang === 'he' ? 'הזמנה פעילה' : 'Invitation pending')}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-primary-700">🏆 {invite.invitedPlayer.competitivePoints ?? 0}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 space-y-2">
            {inviteCandidates.length > 0 ? (
              inviteCandidates.map((player) => (
                <div key={player.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 px-3 py-2">
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt={player.name} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ${player.avatarColor} text-xs font-bold text-white`}>
                      {player.initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{player.name}</p>
                    {player.position && <p className="text-xs text-gray-400">{player.position}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleInvitePlayer(player.id)}
                    disabled={invitingProfileId === player.id}
                    className="rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
                  >
                    {invitingProfileId === player.id
                      ? (lang === 'he' ? 'שולח...' : 'Sending...')
                      : (lang === 'he' ? 'הזמן' : 'Invite')}
                  </button>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-gray-50 px-3 py-3 text-sm text-gray-500">
                {lang === 'he'
                  ? 'אין כרגע חברים פנויים שאפשר להזמין ללובי הזה.'
                  : 'There are no available friends to invite to this lobby right now.'}
              </p>
            )}
          </div>
        </div>
      )}

      {canManageCurrentLobby && resolvedLobby.accessType === 'locked' && joinRequests.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {lang === 'he' ? 'בקשות כניסה ללובי' : 'Lobby access requests'}
              </p>
              <p className="mt-1 text-xs text-amber-700">
                {lang === 'he'
                  ? 'שחקנים שאין להם גישה ללובי יכולים לשלוח בקשה, ואתם מאשרים או דוחים מכאן.'
                  : 'Players without access can send requests here, and you can approve or decline them from this panel.'}
              </p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-700">
              {lang === 'he' ? `${joinRequests.length} ממתינים` : `${joinRequests.length} pending`}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {joinRequests.map((request) => (
              <div key={request.id} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2">
                {request.requester.photoUrl ? (
                  <img src={request.requester.photoUrl} alt={request.requester.name} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${request.requester.avatarColor} text-xs font-bold text-white`}>
                    {request.requester.initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{request.requester.name}</p>
                  <p className="text-xs text-gray-400">
                    {lang === 'he' ? 'מבקש/ת גישה ללובי' : 'Requested access to this lobby'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleJoinRequestAction('approve', request.requesterProfileId)}
                    disabled={saving}
                    className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                  >
                    {lang === 'he' ? 'אשר' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleJoinRequestAction('decline', request.requesterProfileId)}
                    disabled={saving}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
                  >
                    {lang === 'he' ? 'דחה' : 'Decline'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {canManageCurrentLobby && isCompetitive && teams.length > 0 && (
        <div className={`mb-4 rounded-2xl border p-4 ${lobbyResult ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={`text-sm font-semibold ${lobbyResult ? 'text-emerald-800' : 'text-amber-800'}`}>
                {lang === 'he' ? 'תוצאות הלובי התחרותי' : 'Competitive lobby result'}
              </p>
              <p className={`mt-1 text-xs ${lobbyResult ? 'text-emerald-700' : 'text-amber-700'}`}>
                {lobbyResult
                  ? (lang === 'he' ? 'התוצאה נשמרה והנקודות כבר חולקו לשחקנים.' : 'The result was saved and points were already awarded.')
                  : resultSubmissionOpen
                    ? (lang === 'he' ? 'הזינו כמה ניצחונות היו לכל קבוצה כדי לחלק נקודות.' : 'Enter the number of wins for each team to award points.')
                    : (
                        lang === 'he'
                          ? `אפשר יהיה להזין תוצאה בערך שעתיים אחרי שעת הפתיחה המתוכננת (${resultReminderDateStr}).`
                          : `You will be able to submit the result about two hours after kickoff (${resultReminderDateStr}).`
                      )}
              </p>
              {lobbyResult && (
                <p className="mt-1 text-xs text-emerald-700">
                  {resultReporterText}
                </p>
              )}
            </div>
            {!lobbyResult && (
              <button
                onClick={() => {
                  setResultModalDismissed(false);
                  setShowResultModal(true);
                }}
                disabled={!canSubmitResult}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {lang === 'he' ? 'הזן תוצאה' : 'Submit result'}
              </button>
            )}
          </div>
        </div>
      )}

      {isLobbyExpired && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {lang === 'he' ? 'הלובי הזה פג תוקף ולכן לא ניתן יותר להצטרף אליו.' : 'This lobby has expired, so joining is no longer available.'}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {lobby.isPrivate && <Lock size={14} className="text-gray-400" />}
              <h1 className="text-2xl font-bold text-gray-900">{lobby.title}</h1>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${isCompetitive ? 'bg-primary-100 text-primary-700' : 'bg-green-100 text-green-700'}`}>
                {isCompetitive ? <Trophy size={11} /> : <Handshake size={11} />}
                {isCompetitive ? (lang === 'he' ? 'תחרותי' : 'Competitive') : (lang === 'he' ? 'ידידותי' : 'Friendly')}
              </span>
            </div>
            {lobby.city && <p className="text-gray-500">{lobby.city}</p>}
          </div>
          {avg !== null && isCompetitive && (
            <div className="text-end">
              <div className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-700">
                <Trophy size={13} />
                {Math.round(avg)}
              </div>
              <p className="text-xs text-gray-400 mt-1">{lang === 'he' ? 'ממוצע נק׳ תחרות' : 'avg comp. points'}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <InfoRow icon={<MapPin size={15} />} label={t.lobby.location}>
            <span>
              {formatLocationLabel(lobby.address, lobby.city)}
            </span>
            {distanceFromUserKm != null && (
              <span className="text-gray-400 block text-xs mb-1">
                {distanceFromUserKm.toFixed(1)} {t.common.km} {t.common.away}
              </span>
            )}
            {distanceFromUserKm != null && (
              <span className="text-gray-400 block text-[11px] mb-1">
                {distanceSourceText}
              </span>
            )}
            <div className="flex gap-2 mt-1">
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors font-medium">
                <ExternalLink size={11} />
                Google Maps
              </a>
              <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors font-medium">
                <ExternalLink size={11} />
                Waze
              </a>
            </div>
          </InfoRow>
          <InfoRow icon={<Clock size={15} />} label={t.lobby.dateTime}>
            {dateStr}
          </InfoRow>
          <InfoRow icon={<Users size={15} />} label={t.lobby.players}>
            <span className={isFull ? 'text-red-500 font-semibold' : 'text-primary-600 font-semibold'}>
              {lobby.players.length} / {lobby.maxPlayers}
            </span>
            {lobby.numTeams && lobby.playersPerTeam && (
              <span className="text-gray-400 text-xs block">
                {lobby.numTeams} {lang === 'he' ? 'קבוצות' : 'teams'} × {lobby.playersPerTeam} {lang === 'he' ? 'שחקנים' : 'players'}
              </span>
            )}
          </InfoRow>
          <InfoRow icon={<ShieldCheck size={15} />} label={t.lobby.price}>
            {lobby.price && lobby.price > 0 ? `${lobby.price} ${t.lobby.perPerson}` : <span className="text-primary-600 font-semibold">{t.lobby.free}</span>}
          </InfoRow>
        </div>

        {lobby.minRating && isCompetitive && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <span className="text-gray-400">{lang === 'he' ? 'מינימום נק׳ תחרות:' : 'Min competitive points:'}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
              <Trophy size={11} />
              {Math.round(lobby.minRating)}
            </span>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {lobby.fieldType && (
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
              {lobby.fieldType === 'grass' ? '🌿' : lobby.fieldType === 'asphalt' ? '⬛' : '🏟️'}
              {' '}{lobby.fieldType === 'grass' ? (lang === 'he' ? 'דשא' : 'Grass') : lobby.fieldType === 'asphalt' ? (lang === 'he' ? 'אספלט' : 'Asphalt') : (lang === 'he' ? 'אולם' : 'Indoor')}
            </span>
          )}
          {ageRangeLabel && (
            <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
              {ageRangeLabel}
            </span>
          )}
          {lobby.genderRestriction !== 'none' && (
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
              {lobby.genderRestriction === 'male' ? '👨 ' : '👩 '}
              {lobby.genderRestriction === 'male' ? (lang === 'he' ? 'גברים בלבד' : 'Men only') : (lang === 'he' ? 'נשים בלבד' : 'Women only')}
            </span>
          )}
        </div>

        {lobby.description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 font-medium mb-1">{t.lobby.description}</p>
            <p className="text-sm text-gray-700">{lobby.description}</p>
          </div>
        )}
      </div>

      {teams.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4" aria-busy={swappingTeams}>
          <h2 className="font-semibold text-gray-900 mb-4">
            {lang === 'he' ? 'הקבוצות שנקבעו' : 'Assigned teams'}
          </h2>
          {canManageCurrentLobby && (
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-xs text-gray-500">
                {selectedSwapPlayer
                  ? (lang === 'he'
                      ? 'בחרו עכשיו שחקן מקבוצה אחרת כדי להחליף ביניהם.'
                      : 'Now choose a player from another team to swap them.')
                  : (lang === 'he'
                      ? 'כחלק מצוות המארגנים אפשר לבחור שחקן ואז שחקן מקבוצה אחרת כדי להחליף ביניהם.'
                      : 'As part of the organizer team, select a player and then a player from another team to swap them.')}
              </p>
              {selectedSwapPlayer && (
                <button
                  onClick={() => setSelectedSwapPlayer(null)}
                  disabled={swappingTeams}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 text-sm font-medium text-gray-700 transition-colors"
                >
                  {lang === 'he' ? 'בטל בחירה' : 'Cancel selection'}
                </button>
              )}
            </div>
          )}
          {swappingTeams && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
              <LoaderCircle size={18} className="shrink-0 animate-spin" />
              <div>
                <p className="font-semibold">
                  {lang === 'he' ? 'מחליף שחקנים בין הקבוצות...' : 'Swapping players between teams...'}
                </p>
                <p className="text-xs text-primary-700">
                  {swappingPairLabel
                    ? (
                      lang === 'he'
                        ? `${swappingPairLabel.fromName} ו-${swappingPairLabel.toName} מתעדכנים עכשיו.`
                        : `${swappingPairLabel.fromName} and ${swappingPairLabel.toName} are being updated now.`
                    )
                    : (
                      lang === 'he'
                        ? 'עוד רגע ההרכבים יתעדכנו כאן.'
                        : 'The lineups will refresh here in a moment.'
                    )}
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map((assignment) => (
              <div key={assignment.team.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-3 w-3 rounded-full ${teamColorClassName(assignment.team.color)}`} />
                    <p className="font-semibold text-gray-900">
                      {lang === 'he'
                        ? `קבוצה ${getTeamColorLabel(assignment.team.color, lang)}`
                        : `${getTeamColorLabel(assignment.team.color, lang)} Team`}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {assignment.players.length} {lang === 'he' ? 'שחקנים' : 'players'}
                  </span>
                </div>
                <div className="space-y-2">
                  {assignment.players.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      disabled={!canManageCurrentLobby || swappingTeams}
                      onClick={() => {
                        if (!canManageCurrentLobby) {
                          return;
                        }

                        if (
                          selectedSwapPlayer
                          && selectedSwapPlayer.profileId === player.id
                          && selectedSwapPlayer.teamId === assignment.team.id
                        ) {
                          setSelectedSwapPlayer(null);
                          return;
                        }

                        if (!selectedSwapPlayer) {
                          setSelectedSwapPlayer({ profileId: player.id, teamId: assignment.team.id });
                          return;
                        }

                        void handleSwapPlayers(player.id, assignment.team.id);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2 text-start transition-colors ${
                        canManageCurrentLobby ? 'hover:bg-primary-50 disabled:hover:bg-white' : ''
                      } ${
                        selectedSwapPlayer?.profileId === player.id && selectedSwapPlayer.teamId === assignment.team.id
                          ? 'ring-2 ring-primary-300 bg-primary-50'
                          : ''
                      } ${
                        swappingTeams ? 'opacity-60' : ''
                      }`}
                    >
                      {player.photoUrl ? (
                        <img src={player.photoUrl} alt={player.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className={`w-8 h-8 rounded-full ${player.avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                          {player.initials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{player.name}</p>
                        {player.position && (
                          <p className="text-xs text-gray-400">{getPreferredPositionLabel(player.position, lang)}</p>
                        )}
                      </div>
                      {selectedSwapPlayer?.profileId === player.id && selectedSwapPlayer.teamId === assignment.team.id && (
                        <span className="text-[11px] font-semibold text-primary-700">
                          {lang === 'he' ? 'נבחר' : 'Selected'}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-primary-700">🏆 {player.competitivePoints ?? 0}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lobbyResult && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-900">
              {lang === 'he' ? 'תוצאות ונקודות' : 'Results and points'}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {resultReporterText}
            </p>
          </div>
          {myTeamAssignment && myTeamResult && (
            <div className="mb-4 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
                    {lang === 'he' ? 'הסיכום האישי שלכם' : 'Your summary'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {lang === 'he'
                      ? `שיחקתם בקבוצה ${getTeamColorLabel(myTeamAssignment.team.color, lang)}`
                      : `You played on the ${getTeamColorLabel(myTeamAssignment.team.color, lang)} team`}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    {formatRankLabel(myTeamResult.rank, lang)} • {myTeamResult.wins} {lang === 'he' ? 'ניצחונות' : 'wins'}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-lg font-bold text-primary-700">+{myTeamResult.awardedPoints}</p>
                  <p className="text-xs text-primary-600">{lang === 'he' ? 'נקודות שקיבלתם' : 'points earned'}</p>
                </div>
              </div>
            </div>
          )}
          {lobbyResult.notes && (
            <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold text-amber-800">
                {lang === 'he' ? 'הערת מארגן' : 'Organizer note'}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{lobbyResult.notes}</p>
            </div>
          )}
          <div className="space-y-3">
            {lobbyResult.teamResults.map((teamResult) => (
              <div key={teamResult.lobbyTeamId} className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`inline-block h-3 w-3 rounded-full ${teamColorClassName(teamResult.teamColor)}`} />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {lang === 'he'
                        ? `קבוצה ${getTeamColorLabel(teamResult.teamColor, lang)}`
                        : `${getTeamColorLabel(teamResult.teamColor, lang)} Team`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatRankLabel(teamResult.rank, lang)} • {teamResult.wins} {lang === 'he' ? 'ניצחונות' : 'wins'}
                    </p>
                  </div>
                </div>
                <div className="text-end">
                  <p className="text-sm font-semibold text-primary-700">+{teamResult.awardedPoints}</p>
                  <p className="text-xs text-gray-500">{lang === 'he' ? 'נקודות לשחקן' : 'points per player'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasCoords && (
        <LocationPreviewMap
          latitude={resolvedLobby.latitude!}
          longitude={resolvedLobby.longitude!}
        />
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">
            {t.lobby.playerList} ({lobby.players.length}/{lobby.maxPlayers})
          </h2>
          {currentUser && lobby.players.some((p) => p.id === currentUser.id) && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleToggleContribution('ball')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium transition-colors border ${ballContributors.has(currentUser.id) ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'}`}
              >
                ⚽ <span>{ballContributors.size}</span>
              </button>
              <button
                onClick={() => void handleToggleContribution('speaker')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium transition-colors border ${speakerContributors.has(currentUser.id) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'}`}
              >
                🔊 <span>{speakerContributors.size}</span>
              </button>
            </div>
          )}
        </div>
        <div className="space-y-1">
          {lobby.players.map((player) => (
            <button
              key={player.id}
              onClick={() => navigate(`/profile/${player.id}`)}
              className="w-full flex items-center gap-3 p-2 rounded-xl transition-colors text-start hover:bg-gray-50"
            >
              {player.photoUrl ? (
                <img src={player.photoUrl} alt={player.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className={`w-9 h-9 rounded-full ${player.avatarColor} flex items-center justify-center text-white font-semibold text-xs shrink-0`}>
                  {player.initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-medium text-gray-900 text-sm">{player.name}</p>
                  {ballContributors.has(player.id) && <span className="text-xs">⚽</span>}
                  {speakerContributors.has(player.id) && <span className="text-xs">🔊</span>}
                  {player.id === lobby.createdBy && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">{t.lobby.organizer}</span>
                  )}
                  {resolvedLobby.organizerIds.includes(player.id) && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{lang === 'he' ? 'מארגן משני' : 'Co-organizer'}</span>}
                  {player.id === currentUser?.id && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{lang === 'he' ? 'אני' : 'me'}</span>
                  )}
                </div>
                {player.position && <p className="text-xs text-gray-400">{getPreferredPositionLabel(player.position, lang)}</p>}
              </div>
              <div className="shrink-0">
                <p className="text-sm font-semibold text-primary-700">🏆 {player.competitivePoints ?? 0}</p>
                <p className="text-xs text-gray-400 text-end">
                  {player.gamesPlayed} {t.lobby.gamesPlayed}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <LobbyChat
        lobbyId={lobbyId}
        currentUser={currentUser}
        canViewChat={canViewLobbyChat}
        canSendChat={canSendLobbyChat}
      />

      {lobby.waitlist.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5 mb-4">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <AlertCircle size={16} />
            {lang === 'he' ? `רשימת המתנה (${lobby.waitlist.length})` : `Waitlist (${lobby.waitlist.length})`}
          </h3>
          <div className="space-y-2">
            {lobby.waitlist.map((player, index) => (
              <div key={player.id} className="flex items-center gap-3 text-sm">
                <span className="text-amber-600 font-semibold w-5 text-center">{index + 1}</span>
                <div className={`w-7 h-7 rounded-full ${player.avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                  {player.initials}
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-gray-700">{player.name}</span>
                  {pendingWaitlistIds.includes(player.id) && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                      {lang === 'he' ? 'יכול להיכנס עכשיו' : 'Can join now'}
                    </span>
                  )}
                  {passedWaitlistIds.includes(player.id) && (
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      {lang === 'he' ? 'העביר זמנית לבא בתור' : 'Passed to next for now'}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-primary-700">🏆 {player.competitivePoints ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showResultModal && canSubmitResult && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {lang === 'he' ? 'דיווח תוצאות הלובי' : 'Report lobby results'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {lang === 'he'
                  ? 'הזינו כמה ניצחונות היו לכל קבוצה. הדירוג והנקודות יחושבו אוטומטית.'
                  : 'Enter the number of wins for each team. Ranking and points will be calculated automatically.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowResultModal(false);
                setResultModalDismissed(true);
              }}
              disabled={submittingResult}
              className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {lang === 'he' ? 'סגור' : 'Close'}
            </button>
          </div>

          <div className="space-y-3">
            {teams.map((assignment) => {
              const preview = resultPreview.find((item) => item.teamId === assignment.team.id);

              return (
                <div key={assignment.team.id} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`inline-block h-3 w-3 rounded-full ${teamColorClassName(assignment.team.color)}`} />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {lang === 'he'
                            ? `קבוצה ${getTeamColorLabel(assignment.team.color, lang)}`
                            : `${getTeamColorLabel(assignment.team.color, lang)} Team`}
                        </p>
                        {preview && (
                          <p className="text-xs text-gray-500">
                            {formatRankLabel(preview.rank, lang)} • +{preview.awardedPoints}{' '}
                            {lang === 'he' ? 'נקודות לשחקן' : 'points per player'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changeTeamWins(assignment.team.id, -1)}
                        disabled={submittingResult || (resultWins[assignment.team.id] ?? 0) <= 0}
                        className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-lg font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={lang === 'he' ? 'הפחת ניצחונות' : 'Decrease wins'}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={resultWins[assignment.team.id] ?? 0}
                        onChange={(event) => {
                          const nextValue = Number.parseInt(event.target.value || '0', 10);
                          setResultWins((current) => ({
                            ...current,
                            [assignment.team.id]: Number.isNaN(nextValue) ? 0 : Math.max(0, nextValue),
                          }));
                        }}
                        disabled={submittingResult}
                        className="h-10 w-20 rounded-xl border border-gray-200 bg-white px-3 text-center text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-primary-400"
                      />
                      <button
                        type="button"
                        onClick={() => changeTeamWins(assignment.team.id, 1)}
                        disabled={submittingResult}
                        className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-lg font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
                        aria-label={lang === 'he' ? 'הגדל ניצחונות' : 'Increase wins'}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="result-notes" className="text-sm font-medium text-gray-700">
                {lang === 'he' ? 'הערת מארגן אופציונלית' : 'Optional organizer note'}
              </label>
              <span className="text-xs text-gray-400">{resultNotes.length}/500</span>
            </div>
            <textarea
              id="result-notes"
              value={resultNotes}
              onChange={(event) => setResultNotes(event.target.value.slice(0, 500))}
              disabled={submittingResult}
              rows={3}
              placeholder={lang === 'he' ? 'למשל: היה משחק צמוד מאוד, כל הקבוצות התחלפו יפה.' : 'For example: very close game, all teams rotated well.'}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-primary-400 disabled:opacity-60"
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              {lang === 'he'
                ? 'אחרי השמירה, כל השחקנים בלובי יקבלו את הנקודות של הקבוצה שלהם.'
                : 'Once saved, all players in the lobby will receive their team points.'}
            </p>
            <button
              type="button"
              onClick={() => void handleSubmitResult()}
              disabled={submittingResult}
              className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingResult
                ? (lang === 'he' ? 'שומר...' : 'Saving...')
                : (lang === 'he' ? 'שמור תוצאה וחלק נקודות' : 'Save result and award points')}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {myStatus === 'pending_confirm' && isLobbyActive && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-4 text-center">
          <p className="font-semibold text-green-800 mb-1">{lang === 'he' ? 'יש לך מקום!' : 'A spot opened for you!'}</p>
          <p className="text-sm text-green-700 mb-3">
            {lang === 'he'
              ? 'התפנה מקום עבורך. אפשר להיכנס עכשיו או להעביר זמנית לבא בתור בלי לאבד את המיקום שלך ברשימת ההעדפה.'
              : 'A spot opened for you. You can join now or temporarily pass it to the next player without losing your priority.'}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition-colors"
            >
              {lang === 'he' ? 'כנס' : 'Join'}
            </button>
            <button
              onClick={handlePassToNext}
              disabled={saving}
              className="px-5 py-2 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-60 text-gray-700 rounded-xl font-semibold text-sm transition-colors"
            >
              {lang === 'he' ? 'העבר לבא בתור' : 'Pass to next'}
            </button>
            <button
              onClick={handleLeave}
              disabled={saving}
              className="px-5 py-2 bg-transparent hover:bg-white/70 disabled:opacity-60 text-green-700 rounded-xl font-medium text-sm transition-colors"
            >
              {lang === 'he' ? 'צא מרשימת ההמתנה' : 'Leave waitlist'}
            </button>
          </div>
        </div>
      )}

      {myStatus !== 'pending_confirm' && isLobbyActive && (
        <>
          {myStatus === 'none' && (
            <button
              onClick={handleJoin}
              disabled={saving || (viewerCanRequestAccess && (viewerJoinRequestStatus === 'pending' || viewerJoinRequestStatus === 'declined'))}
              className={`w-full py-4 rounded-2xl font-semibold text-base transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 ${
                viewerCanRequestAccess
                  ? 'bg-gray-900 hover:bg-black text-white'
                  : isFull ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
            >
              {viewerCanRequestAccess
                ? (
                  viewerJoinRequestStatus === 'pending'
                    ? (lang === 'he' ? 'בקשת הכניסה נשלחה' : 'Access request sent')
                    : viewerJoinRequestStatus === 'declined'
                      ? (lang === 'he' ? 'בקשת הכניסה נדחתה' : 'Access request declined')
                    : (lang === 'he' ? 'בקש להיכנס ללובי' : 'Request lobby access')
                )
                : isFull ? (lang === 'he' ? '+ הצטרף לרשימת ההמתנה' : '+ Join Waitlist') : t.lobby.join}
            </button>
          )}

          {myStatus === 'joined' && (
            <button
              onClick={handleLeave}
              disabled={saving}
              className="w-full py-4 rounded-2xl font-semibold text-base bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white transition-colors"
            >
              {t.lobby.leave}
            </button>
          )}

          {myStatus === 'waitlisted' && (
            <div className="space-y-2">
              <div className="w-full py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 font-medium text-sm text-center">
                {hasPassedWaitlistSpot
                  ? (
                    lang === 'he'
                      ? `אתה במקום #${myWaitlistIndex + 1} ברשימת ההמתנה. העברת זמנית את המקום שנפתח לבא בתור.`
                      : `You are #${myWaitlistIndex + 1} on the waitlist. You temporarily passed the current opening to the next player.`
                  )
                  : (
                    lang === 'he'
                      ? `אתה במקום #${myWaitlistIndex + 1} ברשימת ההמתנה`
                      : `You are #${myWaitlistIndex + 1} on the waitlist`
                  )}
              </div>
              <button
                onClick={handleLeave}
                disabled={saving}
                className="w-full py-3 rounded-2xl font-medium text-sm bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-60 text-gray-500 transition-colors"
              >
                {lang === 'he' ? 'הסר אותי מהרשימה' : 'Remove me from waitlist'}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-gray-400 text-xs mb-0.5">{label}</p>
        <div className="text-gray-800">{children}</div>
      </div>
    </div>
  );
}
