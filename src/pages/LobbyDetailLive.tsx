import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, ChevronLeft, Clock, ExternalLink, Handshake, Lock, MapPin, Pencil, ShieldCheck, Star, Trash2, Trophy, Users } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import RatingDisplay, { RatingBadge } from '../components/RatingDisplay';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { deleteLobby, deleteLobbyMembership, fetchContributions, fetchLobbyById, toggleContribution, upsertLobbyMembership } from '../lib/appData';
import { getJoinLobbyError } from '../lib/validation';
import type { ContributionType, Lobby } from '../types';
import { formatDateTime } from '../utils/format';
import { getDistanceSourceText, loadSessionDistancePreference } from '../utils/distanceSource';
import { haversineKm } from '../utils/geo';
import { formatLocationLabel } from '../utils/location';
import LocationPreviewMap from '../components/LocationPreviewMap';

type MyStatus = 'none' | 'joined' | 'waitlisted' | 'pending_confirm';

function avgRating(players: { rating: number }[]) {
  if (!players.length) {
    return null;
  }

  return players.reduce((sum, player) => sum + player.rating, 0) / players.length;
}

export default function LobbyDetailLive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const { currentUser } = useAuth();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [contributions, setContributions] = useState<{ profileId: string; type: ContributionType }[]>([]);
  const [distancePreference, setDistancePreference] = useState(() => loadSessionDistancePreference());

  async function loadLobby() {
    if (!id) {
      setLobby(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const [nextLobby, nextContributions] = await Promise.all([
        fetchLobbyById(id),
        fetchContributions(id),
      ]);
      setLobby(nextLobby);
      setContributions(nextContributions);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load game');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLobby();
  }, [id]);

  useEffect(() => {
    setDistancePreference(loadSessionDistancePreference());
  }, []);

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

  const isFull = resolvedLobby.players.length >= resolvedLobby.maxPlayers;
  const dateStr = formatDateTime(resolvedLobby.datetime, lang, t.common.today, t.common.tomorrow);
  const avg = avgRating(resolvedLobby.players);
  const isCompetitive = resolvedLobby.gameType === 'competitive';
  const isCreator = currentUser?.id === resolvedLobby.createdBy;
  const isLobbyActive = resolvedLobby.status === 'active';
  const isLobbyExpired = resolvedLobby.status === 'expired';
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
  const gameHasPassed = new Date(resolvedLobby.datetime) < new Date();
  const ratingWindowOpen = isCompetitive && gameHasPassed && (new Date().getTime() - new Date(resolvedLobby.datetime).getTime()) < 24 * 60 * 60 * 1000;
  const iAmParticipant = currentUser ? resolvedLobby.players.some((p) => p.id === currentUser.id) : false;
  const canRate = ratingWindowOpen && iAmParticipant;
  const myWaitlistIndex = currentUser ? resolvedLobby.waitlist.findIndex((player) => player.id === currentUser.id) : -1;
  const isFirstWaitlisted = myWaitlistIndex === 0;

  const myStatus: MyStatus = (() => {
    if (!currentUser) {
      return 'none';
    }
    if (lobby.players.some((player) => player.id === currentUser.id)) {
      return 'joined';
    }
    if (myWaitlistIndex >= 0) {
      return !isFull && isFirstWaitlisted ? 'pending_confirm' : 'waitlisted';
    }
    return 'none';
  })();

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

    const joinError = getJoinLobbyError(resolvedLobby, currentUser);
    if (joinError) {
      setError(joinError);
      return;
    }

    void runMembershipAction(() =>
      upsertLobbyMembership(lobbyId, currentUser.id, isFull ? 'waitlisted' : 'joined'),
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
              <RatingBadge rating={avg} />
              <p className="text-xs text-gray-400 mt-1">{lang === 'he' ? 'ממוצע שחקנים' : 'avg rating'}</p>
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
            <span className="text-gray-400">{lang === 'he' ? 'דירוג מינימלי:' : 'Min rating:'}</span>
            <RatingDisplay rating={lobby.minRating} size="sm" />
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {lobby.fieldType && (
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
              {lobby.fieldType === 'grass' ? '🌿' : lobby.fieldType === 'asphalt' ? '⬛' : '🏟️'}
              {' '}{lobby.fieldType === 'grass' ? (lang === 'he' ? 'דשא' : 'Grass') : lobby.fieldType === 'asphalt' ? (lang === 'he' ? 'אספלט' : 'Asphalt') : (lang === 'he' ? 'אולם' : 'Indoor')}
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
                  {player.id === currentUser?.id && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{lang === 'he' ? 'אני' : 'me'}</span>
                  )}
                </div>
                {player.position && <p className="text-xs text-gray-400">{player.position}</p>}
              </div>
              <div className="shrink-0">
                <RatingDisplay rating={player.rating} size="sm" />
                <p className="text-xs text-gray-400 text-end">
                  {player.gamesPlayed} {t.lobby.gamesPlayed}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

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
                <span className="text-gray-700 flex-1">{player.name}</span>
                <RatingDisplay rating={player.rating} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {canRate && (
        <button
          onClick={() => navigate(`/lobby/${lobbyId}/rate`)}
          className="w-full py-4 rounded-2xl font-semibold text-base bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-md hover:shadow-lg mb-4 flex items-center justify-center gap-2"
        >
          <Star size={18} />
          {lang === 'he' ? 'דרג את המשחק' : 'Rate the game'}
        </button>
      )}

      {myStatus === 'pending_confirm' && isLobbyActive && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-4 text-center">
          <p className="font-semibold text-green-800 mb-1">{lang === 'he' ? 'יש לך מקום!' : 'A spot opened for you!'}</p>
          <p className="text-sm text-green-700 mb-3">
            {lang === 'he' ? 'אתה ראשון ברשימת ההמתנה. אשר כדי להיכנס.' : 'You are first on the waitlist. Confirm to claim the spot.'}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition-colors"
            >
              {lang === 'he' ? 'אשר הצטרפות' : 'Confirm'}
            </button>
            <button
              onClick={handleLeave}
              disabled={saving}
              className="px-5 py-2 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-60 text-gray-600 rounded-xl font-semibold text-sm transition-colors"
            >
              {lang === 'he' ? 'וותר' : 'Leave waitlist'}
            </button>
          </div>
        </div>
      )}

      {myStatus !== 'pending_confirm' && isLobbyActive && (
        <>
          {myStatus === 'none' && (
            <button
              onClick={handleJoin}
              disabled={saving}
              className={`w-full py-4 rounded-2xl font-semibold text-base transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 ${
                isFull ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
            >
              {isFull ? (lang === 'he' ? '+ הצטרף לרשימת ההמתנה' : '+ Join Waitlist') : t.lobby.join}
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
                {lang === 'he'
                  ? `אתה במקום #${myWaitlistIndex + 1} ברשימת ההמתנה`
                  : `You are #${myWaitlistIndex + 1} on the waitlist`}
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
