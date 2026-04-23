import { useEffect, useState, type ReactNode } from 'react';
import {
  Clock3,
  Filter,
  Locate,
  Lock,
  MapPin,
  Search,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PlayerAvatarStack from '../components/PlayerAvatarStack';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { fetchLobbies, requestLobbyAccess, upsertLobbyMembership } from '../lib/appData';
import type { FieldType, GameType, Lobby, Player } from '../types';
import { formatAgeRange } from '../utils/age';
import { HOME_FILTERS_SESSION_KEY, type Coords, type LocationMode, getDistanceSourceText } from '../utils/distanceSource';
import { formatDateTime } from '../utils/format';
import { haversineKm } from '../utils/geo';
import { formatLocationLabel } from '../utils/location';

type Tab = 'all' | 'friends';
type RadiusOption = 5 | 10 | 20 | 50 | 999;
type SortOption = 'recommended' | 'nearest' | 'soonest' | 'friends';

type FilterState = {
  query: string;
  showFilters: boolean;
  gameTypeFilter: GameType | 'all';
  filterFieldType: FieldType | 'all';
  filterNumTeams: number | 'all';
  minAvgCompetitivePoints: string;
  radiusKm: RadiusOption;
  tab: Tab;
  sortBy: SortOption;
  locationMode: LocationMode;
  currentCoords: Coords | null;
};

const RADIUS_OPTIONS: { value: RadiusOption; labelHe: string; labelEn: string }[] = [
  { value: 5, labelHe: '5 ק"מ', labelEn: '5 km' },
  { value: 10, labelHe: '10 ק"מ', labelEn: '10 km' },
  { value: 20, labelHe: '20 ק"מ', labelEn: '20 km' },
  { value: 50, labelHe: '50 ק"מ', labelEn: '50 km' },
  { value: 999, labelHe: 'הכול', labelEn: 'Any' },
];

const SORT_OPTIONS: Array<{ value: SortOption; labelHe: string; labelEn: string }> = [
  { value: 'recommended', labelHe: 'מומלץ', labelEn: 'Recommended' },
  { value: 'nearest', labelHe: 'קרוב אליי', labelEn: 'Nearest' },
  { value: 'soonest', labelHe: 'מתחיל בקרוב', labelEn: 'Soonest' },
  { value: 'friends', labelHe: 'עם יותר חברים', labelEn: 'Most friends' },
];

function avgCompetitivePoints(lobby: Lobby) {
  if (lobby.players.length === 0) {
    return null;
  }

  return lobby.players.reduce((sum, player) => sum + (player.competitivePoints ?? 0), 0) / lobby.players.length;
}

function loadFilters(): FilterState {
  const defaults: FilterState = {
    query: '',
    showFilters: false,
    gameTypeFilter: 'all',
    filterFieldType: 'all',
    filterNumTeams: 'all',
    minAvgCompetitivePoints: '',
    radiusKm: 999,
    tab: 'all',
    sortBy: 'recommended',
    locationMode: 'home',
    currentCoords: null,
  };

  try {
    const raw = window.sessionStorage.getItem(HOME_FILTERS_SESSION_KEY);
    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw) as Partial<FilterState>;
    return {
      ...defaults,
      ...parsed,
      minAvgCompetitivePoints: typeof parsed.minAvgCompetitivePoints === 'string' ? parsed.minAvgCompetitivePoints : '',
    };
  } catch {
    return defaults;
  }
}

function saveFilters(next: FilterState) {
  try {
    window.sessionStorage.setItem(HOME_FILTERS_SESSION_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
}

function getLobbyPrimaryActionLabel(lobby: Lobby, lang: 'he' | 'en') {
  const isFull = lobby.players.length >= lobby.maxPlayers;

  if (lobby.viewerJoinRequestStatus === 'pending') {
    return lang === 'he' ? 'בקשה נשלחה' : 'Request sent';
  }

  if (isFull) {
    return lang === 'he' ? 'מלא' : 'Full';
  }

  if (lobby.accessType === 'locked' && !lobby.viewerHasAccess) {
    return lang === 'he' ? 'בקש גישה' : 'Request access';
  }

  return lang === 'he' ? 'הצטרף ללובי' : 'Join lobby';
}

function getFieldTypeLabel(fieldType: FieldType | undefined, lang: 'he' | 'en') {
  if (!fieldType) {
    return null;
  }

  if (lang === 'he') {
    if (fieldType === 'grass') return 'דשא';
    if (fieldType === 'asphalt') return 'אספלט';
    return 'אולם';
  }

  if (fieldType === 'grass') return 'Grass';
  if (fieldType === 'asphalt') return 'Asphalt';
  return 'Indoor';
}

function getFieldTypeIcon(fieldType: FieldType | undefined) {
  if (!fieldType) {
    return null;
  }

  if (fieldType === 'grass') return '🌿';
  if (fieldType === 'asphalt') return '⬛';
  return '🏟️';
}

function getFriendCountInside(lobby: Lobby, friendIds: string[]) {
  if (friendIds.length === 0) {
    return 0;
  }

  return lobby.players.filter((player) => friendIds.includes(player.id)).length;
}

function sortLobbies(lobbies: Lobby[], sortBy: SortOption, friendIds: string[]) {
  return [...lobbies].sort((left, right) => {
    const leftFriendCount = getFriendCountInside(left, friendIds);
    const rightFriendCount = getFriendCountInside(right, friendIds);
    const leftDistance = typeof left.distanceKm === 'number' ? left.distanceKm : Number.POSITIVE_INFINITY;
    const rightDistance = typeof right.distanceKm === 'number' ? right.distanceKm : Number.POSITIVE_INFINITY;
    const leftTime = new Date(left.datetime).getTime();
    const rightTime = new Date(right.datetime).getTime();

    if (sortBy === 'nearest') {
      return leftDistance - rightDistance || leftTime - rightTime || left.title.localeCompare(right.title);
    }

    if (sortBy === 'soonest') {
      return leftTime - rightTime || rightFriendCount - leftFriendCount || leftDistance - rightDistance || left.title.localeCompare(right.title);
    }

    if (sortBy === 'friends') {
      return rightFriendCount - leftFriendCount || leftDistance - rightDistance || leftTime - rightTime || left.title.localeCompare(right.title);
    }

    const leftRecommendedScore =
      (leftFriendCount * 1000)
      + (Number.isFinite(leftDistance) ? Math.max(0, 200 - (leftDistance * 10)) : 0)
      + (left.accessType === 'open' ? 20 : 0);
    const rightRecommendedScore =
      (rightFriendCount * 1000)
      + (Number.isFinite(rightDistance) ? Math.max(0, 200 - (rightDistance * 10)) : 0)
      + (right.accessType === 'open' ? 20 : 0);

    return rightRecommendedScore - leftRecommendedScore
      || leftTime - rightTime
      || left.title.localeCompare(right.title);
  });
}

function getRequirements(lobby: Lobby, lang: 'he' | 'en') {
  const items: string[] = [];

  if (lobby.gameType === 'competitive') {
    if (lobby.minRating) {
      items.push(lang === 'he' ? `מינימום ${Math.round(lobby.minRating)} נק'` : `Min ${Math.round(lobby.minRating)} pts`);
    }
    if (lobby.minPointsPerGame != null) {
      items.push(
        lang === 'he'
          ? `מינימום ${lobby.minPointsPerGame.toFixed(1)} נק' למשחק`
          : `Min ${lobby.minPointsPerGame.toFixed(1)} pts/game`,
      );
    }
  }

  return items;
}

function getEntryTileContent(lobby: Lobby, lang: 'he' | 'en') {
  const requirements = getRequirements(lobby, lang);
  const baseValue =
    lobby.accessType === 'locked' && !lobby.viewerHasAccess
      ? (lang === 'he' ? 'באישור מארגן' : 'Approval required')
      : lobby.price && lobby.price > 0
        ? `₪${lobby.price}`
        : (lang === 'he' ? 'פתוח לכולם' : 'Open to all');

  const subvalue =
    requirements.length > 0
      ? requirements.join(' • ')
      : lobby.price && lobby.price > 0
        ? (lang === 'he' ? 'תשלום במגרש' : 'Paid at the field')
        : undefined;

  return {
    value: baseValue,
    subvalue,
  };
}

function HomeLobbyFeedCard({
  lobby,
  pendingActionId,
  onOpen,
  onPrimaryAction,
  friendIds,
}: {
  lobby: Lobby;
  pendingActionId: string;
  onOpen: () => void;
  onPrimaryAction: () => void;
  friendIds: string[];
}) {
  const { lang } = useLang();
  const isFull = lobby.players.length >= lobby.maxPlayers;
  const primaryLabel = getLobbyPrimaryActionLabel(lobby, lang);
  const primaryDisabled = pendingActionId === lobby.id || lobby.viewerJoinRequestStatus === 'pending' || isFull;
  const ageLabel = formatAgeRange(lobby.minAge, lobby.maxAge, lang);
  const fieldTypeLabel = getFieldTypeLabel(lobby.fieldType, lang);
  const fieldTypeIcon = getFieldTypeIcon(lobby.fieldType);
  const entryTile = getEntryTileContent(lobby, lang);
  const friendCountInside = getFriendCountInside(lobby, friendIds);
  const averageCompetitivePoints = avgCompetitivePoints(lobby);

  function handleCardOpen() {
    onOpen();
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleCardOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleCardOpen();
        }
      }}
      className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-300"
    >
      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                tone={lobby.gameType === 'competitive' ? 'primary' : 'green'}
                icon={lobby.gameType === 'competitive' ? <Trophy size={14} /> : <Users size={14} />}
                label={lobby.gameType === 'competitive' ? (lang === 'he' ? 'תחרותי' : 'Competitive') : (lang === 'he' ? 'ידידותי' : 'Friendly')}
              />
              {fieldTypeLabel && <StatusBadge tone="gray" icon={<span className="text-sm leading-none">{fieldTypeIcon}</span>} label={fieldTypeLabel} shape="tile" />}
              {lobby.accessType === 'locked' && (
                <StatusBadge tone="gray" icon={<Lock size={11} />} label={lang === 'he' ? 'נעול' : 'Locked'} />
              )}
              {friendCountInside > 0 && (
                <StatusBadge
                  tone="primary"
                  label={
                    lang === 'he'
                      ? `${friendCountInside} חבר${friendCountInside === 1 ? '' : 'ים'} בפנים`
                      : `${friendCountInside} friend${friendCountInside === 1 ? '' : 's'} inside`
                  }
                />
              )}
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">{lobby.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{lobby.city}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-3xl bg-gray-50 px-4 py-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                {lang === 'he' ? 'שחקנים' : 'Players'}
              </p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {lobby.players.length}/{lobby.maxPlayers}
              </p>
            </div>
            {lobby.gameType === 'competitive' && averageCompetitivePoints !== null && (
              <div className="rounded-3xl bg-primary-50 px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1 text-primary-700">
                  <span className="text-xl font-semibold">{Math.round(averageCompetitivePoints)}</span>
                  <Trophy size={16} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <InfoTile
            icon={<Clock3 size={16} className="text-primary-600" />}
            title={lang === 'he' ? 'מתי' : 'When'}
            value={formatDateTime(
              lobby.datetime,
              lang,
              lang === 'he' ? 'היום' : 'Today',
              lang === 'he' ? 'מחר' : 'Tomorrow',
            )}
          />
          <InfoTile
            icon={<MapPin size={16} className="text-primary-600" />}
            title={lang === 'he' ? 'איפה' : 'Where'}
            value={formatLocationLabel(lobby.address, lobby.city)}
            subvalue={typeof lobby.distanceKm === 'number' ? `${lobby.distanceKm} ${lang === 'he' ? 'ק"מ' : 'km'}` : undefined}
          />
          <InfoTile
            icon={<Lock size={16} className="text-primary-600" />}
            title={lang === 'he' ? 'תנאי כניסה' : 'Entry requirements'}
            value={entryTile.value}
            subvalue={entryTile.subvalue}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {ageLabel && <MetaChip label={ageLabel} />}
          {lobby.accessType === 'locked' && !lobby.viewerHasAccess && (
            <MetaChip label={lang === 'he' ? 'דורש אישור' : 'Approval required'} tone="amber" />
          )}
        </div>

        {lobby.description && (
          <p className="text-sm leading-7 text-gray-600">{lobby.description}</p>
        )}

        <div className="flex items-center justify-between gap-3 rounded-[24px] bg-gray-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              {lang === 'he' ? 'מי בפנים' : 'Who is inside'}
            </p>
            <div className="mt-2">
              <PlayerAvatarStack players={lobby.players as Player[]} size="md" />
            </div>
          </div>
          <div className="text-end">
            <p className="text-sm font-semibold text-gray-900">
              {friendCountInside > 0
                ? (
                    lang === 'he'
                      ? `${friendCountInside} חבר${friendCountInside === 1 ? '' : 'ים'} כבר בפנים`
                      : `${friendCountInside} friend${friendCountInside === 1 ? '' : 's'} already inside`
                  )
                : (lang === 'he' ? 'בלי חברים בפנים כרגע' : 'No friends inside yet')}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {lobby.accessType === 'locked'
                ? (lang === 'he' ? 'הצטרפות באישור המארגן' : 'Join by organizer approval')
                : (lang === 'he' ? 'אפשר להצטרף מיד' : 'Can join right away')}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPrimaryAction();
            }}
            disabled={primaryDisabled}
            className="flex-1 rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {pendingActionId === lobby.id ? (lang === 'he' ? 'שולח...' : 'Working...') : primaryLabel}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function HomeLive() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const { currentUser } = useAuth();
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pendingActionId, setPendingActionId] = useState('');
  const [filters, setFilters] = useState<FilterState>(() => loadFilters());
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');

  const {
    query,
    showFilters,
    gameTypeFilter,
    filterFieldType,
    filterNumTeams,
    minAvgCompetitivePoints,
    radiusKm,
    tab,
    sortBy,
    locationMode,
    currentCoords,
  } = filters;

  function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      saveFilters(next);
      return next;
    });
  }

  function resetFilters() {
    setFilters((current) => {
      const next = {
        ...current,
        query: '',
        gameTypeFilter: 'all' as const,
        filterFieldType: 'all' as const,
        filterNumTeams: 'all' as const,
        minAvgCompetitivePoints: '',
        radiusKm: 999 as RadiusOption,
      };
      saveFilters(next);
      return next;
    });
  }

  async function loadLobbies() {
    try {
      setLoading(true);
      setLoadError('');
      const nextLobbies = await fetchLobbies();
      setLobbies(nextLobbies.filter((lobby) => lobby.status === 'active'));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load lobbies');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLobbies();
  }, []);

  function requestCurrentLocation() {
    if (!navigator.geolocation) {
      setLocateError(lang === 'he' ? 'הדפדפן לא תומך במיקום' : 'Browser does not support geolocation');
      return;
    }

    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFilters((current) => {
          const next = {
            ...current,
            locationMode: 'current' as const,
            currentCoords: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
          };
          saveFilters(next);
          return next;
        });
        setLocating(false);
      },
      () => {
        setLocateError(lang === 'he' ? 'לא ניתן לקבל מיקום' : 'Could not get location');
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
    );
  }

  function handleUseHomeLocation() {
    setFilters((current) => {
      const next = {
        ...current,
        locationMode: 'home' as const,
      };
      saveFilters(next);
      return next;
    });
    setLocateError('');
  }

  const friendIds = currentUser?.friends ?? [];
  const hasHomeLocation = currentUser?.homeLatitude != null && currentUser?.homeLongitude != null;
  const homeCoords = hasHomeLocation
    ? { lat: currentUser.homeLatitude as number, lng: currentUser.homeLongitude as number }
    : null;
  const usingCurrentLocation = locationMode === 'current' && currentCoords != null;
  const referenceCoords = usingCurrentLocation ? currentCoords : homeCoords;

  const feedLobbies = lobbies.map((lobby) => ({
    ...lobby,
    distanceKm:
      referenceCoords && lobby.latitude != null && lobby.longitude != null
        ? Number(haversineKm(referenceCoords.lat, referenceCoords.lng, lobby.latitude, lobby.longitude).toFixed(1))
        : lobby.distanceKm,
  }));

  const friendLobbies = currentUser
    ? feedLobbies.filter((lobby) => getFriendCountInside(lobby, friendIds) > 0)
    : [];

  const sourceLobbies = tab === 'friends' ? friendLobbies : feedLobbies;
  const queryValue = query.trim().toLowerCase();
  const minAverage = minAvgCompetitivePoints ? Number(minAvgCompetitivePoints) : null;

  const filteredLobbies = sourceLobbies.filter((lobby) => {
    if (queryValue && !`${lobby.title} ${lobby.city} ${lobby.address}`.toLowerCase().includes(queryValue)) {
      return false;
    }
    if (gameTypeFilter !== 'all' && lobby.gameType !== gameTypeFilter) {
      return false;
    }
    if (filterFieldType !== 'all' && lobby.fieldType !== filterFieldType) {
      return false;
    }
    if (filterNumTeams !== 'all' && lobby.numTeams !== filterNumTeams) {
      return false;
    }
    if (minAverage != null && !Number.isNaN(minAverage)) {
      const average = avgCompetitivePoints(lobby);
      if (average == null || average < minAverage) {
        return false;
      }
    }
    if (
      radiusKm !== 999
      && referenceCoords
      && lobby.latitude != null
      && lobby.longitude != null
      && haversineKm(referenceCoords.lat, referenceCoords.lng, lobby.latitude, lobby.longitude) > radiusKm
    ) {
      return false;
    }
    return true;
  });

  const sortedLobbies = sortLobbies(filteredLobbies, sortBy, friendIds);

  const activeFilterCount = [
    query.trim().length > 0,
    gameTypeFilter !== 'all',
    filterFieldType !== 'all',
    filterNumTeams !== 'all',
    minAvgCompetitivePoints.trim().length > 0,
    radiusKm !== 999,
  ].filter(Boolean).length;

  const distanceSourceSummary = referenceCoords
    ? getDistanceSourceText(usingCurrentLocation ? 'current' : 'home', lang, 'full')
    : '';

  async function handlePrimaryAction(lobby: Lobby) {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    if (lobby.viewerJoinRequestStatus === 'pending' || lobby.players.length >= lobby.maxPlayers) {
      return;
    }

    setPendingActionId(lobby.id);
    try {
      if (lobby.accessType === 'locked' && !lobby.viewerHasAccess) {
        await requestLobbyAccess(lobby.id, currentUser.id);
      } else {
        await upsertLobbyMembership(lobby.id, currentUser.id, 'joined');
      }
      await loadLobbies();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setPendingActionId('');
    }
  }

  return (
    <section className="space-y-4 pb-4">
      <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setFilter('query', event.target.value)}
              placeholder={lang === 'he' ? 'סנן לפי שם לובי, עיר או כתובת' : 'Filter by lobby name, city, or address'}
              className="w-full rounded-xl border border-gray-200 bg-white ps-9 pe-10 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            {query && (
              <button
                type="button"
                onClick={() => setFilter('query', '')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                aria-label={lang === 'he' ? 'נקה חיפוש' : 'Clear search'}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <TabButton active={tab === 'all'} onClick={() => setFilter('tab', 'all')}>
              {lang === 'he' ? 'כל הלובים' : 'All lobbies'}
            </TabButton>
            <TabButton active={tab === 'friends'} onClick={() => setFilter('tab', 'friends')}>
              {lang === 'he' ? 'עם חברים' : 'With friends'}
            </TabButton>
            <label className="col-span-2 sm:col-span-1">
              <span className="sr-only">{lang === 'he' ? 'מיון לובים' : 'Sort lobbies'}</span>
              <select
                value={sortBy}
                onChange={(event) => setFilter('sortBy', event.target.value as SortOption)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {lang === 'he' ? option.labelHe : option.labelEn}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setFilter('showFilters', !showFilters)}
              className={`col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors sm:col-span-1 ${
                showFilters || activeFilterCount > 0
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300'
              }`}
            >
              <Filter size={15} />
              <span>{lang === 'he' ? 'פילטרים' : 'Filters'}</span>
              {activeFilterCount > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${showFilters ? 'bg-white text-primary-600' : 'bg-primary-50 text-primary-600'}`}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {(activeFilterCount > 0 || referenceCoords) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {activeFilterCount > 0 && (
              <button type="button" onClick={resetFilters} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-200">
                {lang === 'he' ? 'נקה הכול' : 'Clear all'}
              </button>
            )}
            {referenceCoords && (
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                {distanceSourceSummary}
              </span>
            )}
          </div>
        )}

        {showFilters && (
          <div className="mt-4 grid gap-4 rounded-[24px] border border-gray-100 bg-gray-50 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {lang === 'he' ? 'מרחק' : 'Distance'}
                </p>
                {!referenceCoords ? (
                  <button
                    type="button"
                    onClick={requestCurrentLocation}
                    disabled={locating}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 disabled:opacity-50"
                  >
                    <Locate size={12} />
                    {locating
                      ? (lang === 'he' ? 'מאתר...' : 'Locating...')
                      : (lang === 'he' ? 'השתמש במיקום נוכחי' : 'Use current location')}
                  </button>
                ) : usingCurrentLocation ? (
                  hasHomeLocation ? (
                    <button
                      type="button"
                      onClick={handleUseHomeLocation}
                      className="text-xs font-semibold text-primary-600"
                    >
                      {lang === 'he' ? 'חזור למיקום הבית' : 'Switch to home location'}
                    </button>
                  ) : null
                ) : (
                  <button
                    type="button"
                    onClick={requestCurrentLocation}
                    disabled={locating}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 disabled:opacity-50"
                  >
                    <Locate size={12} />
                    {lang === 'he' ? 'עדכן למיקום נוכחי' : 'Use current location'}
                  </button>
                )}
              </div>

              {!referenceCoords && (
                <p className="mb-2 text-xs text-amber-600">
                  {lang === 'he'
                    ? 'הוסף כתובת בית בפרופיל או אפשר מיקום נוכחי כדי לסנן לפי מרחק.'
                    : 'Add a home address or allow current location to filter by distance.'}
                </p>
              )}

              {locateError && <p className="mb-2 text-xs text-rose-500">{locateError}</p>}

              <div className="flex flex-wrap gap-2">
                {RADIUS_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.value}
                    active={radiusKm === option.value}
                    disabled={option.value !== 999 && !referenceCoords}
                    onClick={() => setFilter('radiusKm', option.value)}
                  >
                    {lang === 'he' ? option.labelHe : option.labelEn}
                  </FilterChip>
                ))}
              </div>
            </div>

            <FilterGroup title={lang === 'he' ? 'סוג משחק' : 'Game type'}>
              <FilterChip active={gameTypeFilter === 'all'} onClick={() => setFilter('gameTypeFilter', 'all')}>
                {lang === 'he' ? 'הכול' : 'All'}
              </FilterChip>
              <FilterChip active={gameTypeFilter === 'friendly'} onClick={() => setFilter('gameTypeFilter', 'friendly')}>
                {lang === 'he' ? 'ידידותי' : 'Friendly'}
              </FilterChip>
              <FilterChip active={gameTypeFilter === 'competitive'} onClick={() => setFilter('gameTypeFilter', 'competitive')}>
                {lang === 'he' ? 'תחרותי' : 'Competitive'}
              </FilterChip>
            </FilterGroup>

            <FilterGroup title={lang === 'he' ? 'סוג מגרש' : 'Field type'}>
              <FilterChip active={filterFieldType === 'all'} onClick={() => setFilter('filterFieldType', 'all')}>
                {lang === 'he' ? 'הכול' : 'All'}
              </FilterChip>
              <FilterChip active={filterFieldType === 'grass'} onClick={() => setFilter('filterFieldType', 'grass')}>
                {lang === 'he' ? 'דשא' : 'Grass'}
              </FilterChip>
              <FilterChip active={filterFieldType === 'asphalt'} onClick={() => setFilter('filterFieldType', 'asphalt')}>
                {lang === 'he' ? 'אספלט' : 'Asphalt'}
              </FilterChip>
              <FilterChip active={filterFieldType === 'indoor'} onClick={() => setFilter('filterFieldType', 'indoor')}>
                {lang === 'he' ? 'אולם' : 'Indoor'}
              </FilterChip>
            </FilterGroup>

            <FilterGroup title={lang === 'he' ? 'מספר קבוצות' : 'Teams'}>
              <FilterChip active={filterNumTeams === 'all'} onClick={() => setFilter('filterNumTeams', 'all')}>
                {lang === 'he' ? 'הכול' : 'All'}
              </FilterChip>
              {[2, 3, 4].map((count) => (
                <FilterChip key={count} active={filterNumTeams === count} onClick={() => setFilter('filterNumTeams', count)}>
                  {count}
                </FilterChip>
              ))}
            </FilterGroup>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                {lang === 'he' ? 'ממוצע תחרותי מינימלי בפנים' : 'Minimum competitive average inside'}
              </p>
              <input
                type="number"
                min="0"
                step="1"
                value={minAvgCompetitivePoints}
                onChange={(event) => setFilter('minAvgCompetitivePoints', event.target.value)}
                placeholder={lang === 'he' ? 'למשל 120' : 'e.g. 120'}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          </div>
        )}
      </div>

      {loadError && (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {loadError}
        </div>
      )}

      {loading ? (
        <p className="py-16 text-center text-sm text-[var(--muted)]">
          {lang === 'he' ? 'טוען לובים...' : 'Loading lobbies...'}
        </p>
      ) : sortedLobbies.length === 0 ? (
        <div className="rounded-[32px] border border-[var(--app-border)] bg-[var(--panel)] px-6 py-16 text-center shadow-sm">
          <p className="text-lg font-semibold text-[var(--text)]">
            {tab === 'friends'
              ? (lang === 'he' ? 'אין כרגע לובים עם חברים' : 'No current lobbies with friends')
              : (lang === 'he' ? 'לא נמצאו לובים שמתאימים לסינון' : 'No lobbies match these filters')}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {lang === 'he'
              ? 'נסה להרחיב קצת את הסינון או ליצור לובי חדש.'
              : 'Try widening the filters a bit or create a new lobby.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedLobbies.map((lobby) => (
            <HomeLobbyFeedCard
              key={lobby.id}
              lobby={lobby}
              pendingActionId={pendingActionId}
              friendIds={friendIds}
              onOpen={() => navigate(`/lobby/${lobby.id}`)}
              onPrimaryAction={() => void handlePrimaryAction(lobby)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        disabled
          ? 'cursor-not-allowed border-gray-200 bg-white text-gray-300'
          : active
            ? 'border-primary-600 bg-primary-600 text-white'
            : 'border-gray-200 bg-white text-gray-600 hover:border-primary-300 hover:text-primary-600'
      }`}
    >
      {children}
    </button>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? 'bg-primary-600 text-white'
          : 'border border-gray-200 bg-white text-gray-700 hover:border-primary-300'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({
  label,
  icon,
  tone = 'primary',
  shape = 'pill',
  hideLabel = false,
}: {
  label: string;
  icon?: ReactNode;
  tone?: 'primary' | 'green' | 'gray' | 'amber';
  shape?: 'pill' | 'tile';
  hideLabel?: boolean;
}) {
  const isLockBadge = label === 'Locked' || label === 'נעול';
  const isGameTypeBadge =
    label === 'Competitive'
    || label === 'Friendly'
    || label === 'תחרותי'
    || label === 'ידידותי';
  const resolvedShape = shape === 'tile' || isLockBadge || isGameTypeBadge ? 'tile' : 'pill';
  const resolvedHideLabel = hideLabel || isLockBadge;
  const resolvedTone = isLockBadge ? 'amber' : tone;
  const classes =
    resolvedTone === 'green'
      ? 'bg-green-50 text-green-700'
      : resolvedTone === 'gray'
        ? 'bg-gray-50 text-gray-700'
        : resolvedTone === 'amber'
          ? 'bg-amber-50 text-amber-700'
          : 'bg-primary-50 text-primary-700';

  if (resolvedShape === 'tile') {
    return (
      <div
        aria-label={label}
        className={`min-w-[78px] rounded-3xl px-4 py-3 text-center ${classes}`}
      >
        {icon ? <div className="flex items-center justify-center">{icon}</div> : null}
        {!resolvedHideLabel ? <p className="mt-1 text-sm font-semibold">{label}</p> : null}
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${classes}`}>
      {icon}
      <span>{label}</span>
    </span>
  );
}

function MetaChip({ label, tone = 'gray' }: { label: string; tone?: 'gray' | 'amber' }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        tone === 'amber'
          ? 'bg-amber-50 text-amber-700'
          : 'bg-gray-100 text-gray-700'
      }`}
    >
      {label}
    </span>
  );
}

function InfoTile({
  icon,
  title,
  value,
  subvalue,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div className="rounded-[22px] border border-gray-100 bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{title}</p>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-gray-900">{value}</p>
      {subvalue && <p className="mt-1 text-xs text-gray-500">{subvalue}</p>}
    </div>
  );
}
