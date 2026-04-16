import { useEffect, useRef, useState } from 'react';
import { Locate, Search, SlidersHorizontal, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import LobbyCard from '../components/LobbyCard';
import { fetchLobbies } from '../lib/appData';
import { Coords, HOME_FILTERS_SESSION_KEY, LocationMode, getDistanceSourceText } from '../utils/distanceSource';
import { haversineKm } from '../utils/geo';
import type { FieldType, GenderRestriction, GameType, Lobby, Player } from '../types';

type Tab = 'all' | 'friends';
type RadiusOption = 5 | 10 | 20 | 50 | 999;

const RADIUS_OPTIONS: { value: RadiusOption; label: string; labelEn: string }[] = [
  { value: 5, label: '5 ק"מ', labelEn: '5 km' },
  { value: 10, label: '10 ק"מ', labelEn: '10 km' },
  { value: 20, label: '20 ק"מ', labelEn: '20 km' },
  { value: 50, label: '50 ק"מ', labelEn: '50 km' },
  { value: 999, label: 'הכל', labelEn: 'Any' },
];

function competitivePoints(player: Player) {
  return player.competitivePoints ?? 0;
}

// --- Session storage helpers ---
type FilterState = {
  gameSearch: string;
  showFilters: boolean;
  gameTypeFilter: GameType | 'all';
  filterFieldType: FieldType | 'all';
  filterNumTeams: number | 'all';
  filterGender: GenderRestriction | 'all';
  minRating: number;
  canJoinOnly: boolean;
  radiusKm: RadiusOption;
  tab: Tab;
  locationMode: LocationMode;
  currentCoords: Coords | null;
};

function loadFilters(): FilterState {
  try {
    const raw = sessionStorage.getItem(HOME_FILTERS_SESSION_KEY);
    if (raw) return JSON.parse(raw) as FilterState;
  } catch {
    // ignore
  }
  return {
    gameSearch: '',
    showFilters: false,
    gameTypeFilter: 'all',
    filterFieldType: 'all',
    filterNumTeams: 'all',
    filterGender: 'all',
    minRating: 1,
    canJoinOnly: false,
    radiusKm: 999,
    tab: 'all',
    locationMode: 'home',
    currentCoords: null,
  };
}

function saveFilters(state: FilterState) {
  try {
    sessionStorage.setItem(HOME_FILTERS_SESSION_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export default function HomeLive() {
  const { t, lang } = useLang();
  const { currentUser, getAllUsers } = useAuth();
  const navigate = useNavigate();

  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load filters from sessionStorage
  const [filters, setFilters] = useState<FilterState>(loadFilters);

  const {
    gameSearch, showFilters, gameTypeFilter, filterFieldType,
    filterNumTeams, filterGender, radiusKm, tab, locationMode, currentCoords,
  } = filters;

  function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      saveFilters(next);
      return next;
    });
  }

  function resetFilters() {
    const reset: FilterState = {
      ...filters,
      gameTypeFilter: 'all',
      filterFieldType: 'all',
      filterNumTeams: 'all',
      filterGender: 'all',
      minRating: 1,
      canJoinOnly: false,
      radiusKm: 999,
    };
    setFilters(reset);
    saveFilters(reset);
  }

  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');

  // Friends search
  const [friendSearch, setFriendSearch] = useState('');
  const [showFriendResults, setShowFriendResults] = useState(false);
  const friendSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setLoadError(null);
        const next = await fetchLobbies();
        if (!cancelled) setLobbies(next);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Failed to load games');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (friendSearchRef.current && !friendSearchRef.current.contains(e.target as Node)) {
        setShowFriendResults(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function requestCurrentLocation() {
    if (!navigator.geolocation) {
      setLocateError(lang === 'he' ? 'הדפדפן לא תומך במיקום' : 'Browser does not support geolocation');
      return;
    }
    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFilters((prev) => {
          const next = {
            ...prev,
            locationMode: 'current' as const,
            currentCoords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
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

  useEffect(() => {
    if (locationMode === 'current') {
      requestCurrentLocation();
    }
  }, []);

  function handleLocate() {
    requestCurrentLocation();
  }

  function handleUseHomeLocation() {
    setFilters((prev) => {
      const next = {
        ...prev,
        locationMode: 'home' as const,
      };
      saveFilters(next);
      return next;
    });
    setLocateError('');
  }

  // Reference point for distance: current location > home location > none
  const hasHomeLocation = currentUser?.homeLatitude != null && currentUser?.homeLongitude != null;
  const homeRefPoint = hasHomeLocation
    ? { lat: currentUser!.homeLatitude!, lng: currentUser!.homeLongitude! }
    : null;
  const hasActiveCurrentLocation = locationMode === 'current' && currentCoords != null;
  const refPoint = hasActiveCurrentLocation
    ? { lat: currentCoords.lat, lng: currentCoords.lng }
    : homeRefPoint
      ? homeRefPoint
      : null;

  const futureLobbies = lobbies
    .filter((lobby) => lobby.status === 'active')
    .map((lobby) => ({
      ...lobby,
      distanceKm:
        refPoint && lobby.latitude != null && lobby.longitude != null
          ? Number(haversineKm(refPoint.lat, refPoint.lng, lobby.latitude, lobby.longitude).toFixed(1))
          : lobby.distanceKm,
    }));

  const allUsers = getAllUsers();
  const friendSearchResults = friendSearch.trim().length >= 1
    ? allUsers
        .filter((u) => u.name.toLowerCase().includes(friendSearch.toLowerCase()) && u.id !== currentUser?.id)
        .slice(0, 6)
    : [];

  const activeFilterCount = [
    gameTypeFilter !== 'all',
    filterFieldType !== 'all',
    filterNumTeams !== 'all',
    filterGender !== 'all',
    radiusKm !== 999,
  ].filter(Boolean).length;
  const activeDistanceMode = hasActiveCurrentLocation ? 'current' : 'home';
  const distanceSourceText = getDistanceSourceText(activeDistanceMode, lang, 'short');
  const distanceSourceSummary = getDistanceSourceText(activeDistanceMode, lang, 'full');

  const allFiltered = futureLobbies.filter((lobby) => {
    if (gameSearch.trim()) {
      const q = gameSearch.trim().toLowerCase();
      if (!`${lobby.title} ${lobby.city} ${lobby.address}`.toLowerCase().includes(q)) return false;
    }
    if (gameTypeFilter !== 'all' && lobby.gameType !== gameTypeFilter) return false;
    if (filterFieldType !== 'all' && lobby.fieldType !== filterFieldType) return false;
    if (filterNumTeams !== 'all' && lobby.numTeams !== filterNumTeams) return false;
    if (filterGender !== 'all' && lobby.genderRestriction !== filterGender) return false;
    if (radiusKm !== 999 && refPoint && lobby.latitude != null && lobby.longitude != null) {
      const dist = haversineKm(refPoint.lat, refPoint.lng, lobby.latitude, lobby.longitude);
      if (dist > radiusKm) return false;
    }
    return true;
  });

  const friendLobbies = currentUser
    ? futureLobbies.filter((lobby) => lobby.players.some((p) => currentUser.friends.includes(p.id)))
    : [];

  const displayed = tab === 'friends' ? friendLobbies : allFiltered;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t.home.title}</h1>
        <p className="text-gray-500 text-base">{t.home.subtitle}</p>
      </div>

      {/* Search bars */}
      <div className="max-w-xl mx-auto mb-5 space-y-2.5">
        {/* Games search */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={gameSearch}
              onChange={(e) => setFilter('gameSearch', e.target.value)}
              placeholder={lang === 'he' ? 'חפש משחק לפי שם, עיר, כתובת...' : 'Search games by name, city, address...'}
              className="w-full ps-9 pe-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent bg-white"
            />
            {gameSearch && (
              <button type="button" onClick={() => setFilter('gameSearch', '')} className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFilter('showFilters', !showFilters)}
            className={`relative flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all whitespace-nowrap ${
              showFilters || activeFilterCount > 0
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
            }`}
          >
            <SlidersHorizontal size={15} />
            {lang === 'he' ? 'פילטרים' : 'Filters'}
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-primary-600 text-xs font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Friends search */}
        <div ref={friendSearchRef} className="relative">
          <Users size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={friendSearch}
            onChange={(e) => { setFriendSearch(e.target.value); setShowFriendResults(true); }}
            onFocus={() => setShowFriendResults(true)}
            placeholder={lang === 'he' ? 'חפש שחקנים להוסיף כחברים...' : 'Find players to add as friends...'}
            className="w-full ps-9 pe-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent bg-white"
          />
          {friendSearch && (
            <button type="button" onClick={() => { setFriendSearch(''); setShowFriendResults(false); }} className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}

          {showFriendResults && friendSearchResults.length > 0 && (
            <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {friendSearchResults.map((user) => {
                const isFriend = currentUser?.friends.includes(user.id);
                const sentRequest = currentUser?.sentRequests.includes(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => { setShowFriendResults(false); setFriendSearch(''); navigate(`/profile/${user.id}`); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-start border-b border-gray-50 last:border-0"
                  >
                    {user.photoUrl ? (
                      <img src={user.photoUrl} alt={user.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className={`w-9 h-9 rounded-full ${user.avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{user.initials}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{user.name}</p>
                      {user.position && <p className="text-xs text-gray-400">{user.position}</p>}
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-xs font-semibold text-primary-700">🏆 {competitivePoints(user)}</p>
                      {isFriend && <span className="text-xs text-green-600">{lang === 'he' ? 'חבר ✓' : 'Friend ✓'}</span>}
                      {sentRequest && !isFriend && <span className="text-xs text-gray-400">{lang === 'he' ? 'נשלחה' : 'Sent'}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {showFriendResults && friendSearch.trim().length >= 1 && friendSearchResults.length === 0 && (
            <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400 text-center">
              {lang === 'he' ? 'לא נמצאו שחקנים' : 'No players found'}
            </div>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="max-w-xl mx-auto mb-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">{lang === 'he' ? 'פילטרים' : 'Filters'}</span>
            {activeFilterCount > 0 && (
              <button type="button" onClick={resetFilters} className="text-xs text-primary-600 hover:underline">
                {lang === 'he' ? 'נקה הכל' : 'Clear all'}
              </button>
            )}
          </div>

          {/* Radius filter */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-gray-500">{lang === 'he' ? 'רדיוס מחיפוש' : 'Search radius'}</p>
              {!refPoint && (
                <button
                  type="button"
                  onClick={handleLocate}
                  disabled={locating}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:underline disabled:opacity-50"
                >
                  <Locate size={11} />
                  {locating
                    ? (lang === 'he' ? 'מאתר...' : 'Locating...')
                    : (lang === 'he' ? 'השתמש במיקום הנוכחי' : 'Use current location')}
                </button>
              )}
              {refPoint && locationMode === 'current' && currentCoords && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-green-600">📍 {lang === 'he' ? 'מיקום נוכחי' : 'Current location'}</span>
                  {hasHomeLocation && (
                    <button
                      type="button"
                      onClick={handleUseHomeLocation}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      {lang === 'he' ? 'חזור למיקום הבית' : 'Switch back to home location'}
                    </button>
                  )}
                </div>
              )}
              {refPoint && locationMode !== 'current' && (
                <button
                  type="button"
                  onClick={handleLocate}
                  disabled={locating}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:underline disabled:opacity-50"
                >
                  <Locate size={11} />
                  {lang === 'he' ? 'עדכן למיקום נוכחי' : 'Use current location'}
                </button>
              )}
            </div>
            {!refPoint && (
              <p className="text-xs text-amber-600 mb-2">
                {lang === 'he'
                  ? 'הוסף כתובת בית בפרופיל שלך כדי להפעיל פילטר מרחק'
                  : 'Add home address in your profile to enable distance filter'}
              </p>
            )}
            {locateError && <p className="text-xs text-red-500 mb-1">{locateError}</p>}
            {refPoint && (
              <p className="text-xs text-gray-500 mb-2">{distanceSourceSummary}</p>
            )}
            <div className="flex gap-1.5 flex-wrap">
              {RADIUS_OPTIONS.map(({ value, label, labelEn }) => (
                <FilterChip
                  key={value}
                  active={radiusKm === value}
                  onClick={() => setFilter('radiusKm', value)}
                  disabled={value !== 999 && !refPoint}
                >
                  {lang === 'he' ? label : labelEn}
                </FilterChip>
              ))}
            </div>
          </div>

          {/* Game type */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">{lang === 'he' ? 'סוג משחק' : 'Game type'}</p>
            <div className="flex gap-1.5 flex-wrap">
              {([['all', lang === 'he' ? 'הכל' : 'All'], ['friendly', lang === 'he' ? '🤝 ידידותי' : '🤝 Friendly'], ['competitive', lang === 'he' ? '🏆 תחרותי' : '🏆 Competitive']] as const).map(([val, label]) => (
                <FilterChip key={val} active={gameTypeFilter === val} onClick={() => setFilter('gameTypeFilter', val)}>{label}</FilterChip>
              ))}
            </div>
          </div>

          {/* Field type */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">{lang === 'he' ? 'סוג מגרש' : 'Field type'}</p>
            <div className="flex gap-1.5 flex-wrap">
              {([['all', lang === 'he' ? 'הכל' : 'All'], ['grass', lang === 'he' ? '🌿 דשא' : '🌿 Grass'], ['asphalt', lang === 'he' ? '⬛ אספלט' : '⬛ Asphalt'], ['indoor', lang === 'he' ? '🏟️ אולם' : '🏟️ Indoor']] as const).map(([val, label]) => (
                <FilterChip key={val} active={filterFieldType === val} onClick={() => setFilter('filterFieldType', val)}>{label}</FilterChip>
              ))}
            </div>
          </div>

          {/* Num teams */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">{lang === 'he' ? 'מספר קבוצות' : 'Number of teams'}</p>
            <div className="flex gap-1.5 flex-wrap">
              {([['all', lang === 'he' ? 'הכל' : 'All'], [2, '2'], [3, '3'], [4, '4']] as const).map(([val, label]) => (
                <FilterChip key={String(val)} active={filterNumTeams === val} onClick={() => setFilter('filterNumTeams', val)}>{label}</FilterChip>
              ))}
            </div>
          </div>

          {/* Gender */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">{lang === 'he' ? 'מגדר' : 'Gender'}</p>
            <div className="flex gap-1.5 flex-wrap">
              {([['all', lang === 'he' ? 'כולם' : 'All'], ['none', lang === 'he' ? 'מעורב' : 'Mixed'], ['male', lang === 'he' ? '👨 גברים' : '👨 Men'], ['female', lang === 'he' ? '👩 נשים' : '👩 Women']] as const).map(([val, label]) => (
                <FilterChip key={val} active={filterGender === val} onClick={() => setFilter('filterGender', val)}>{label}</FilterChip>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 justify-center mb-4">
        <TabBtn active={tab === 'all'} onClick={() => setFilter('tab', 'all')}>
          {lang === 'he' ? 'כל המשחקים' : 'All Games'}
          {allFiltered.length > 0 && <span className="ms-1.5 text-xs opacity-60">({allFiltered.length})</span>}
        </TabBtn>
        <TabBtn active={tab === 'friends'} onClick={() => setFilter('tab', 'friends')}>
          <Users size={14} className="inline me-1" />
          {lang === 'he' ? 'משחקי חברים' : "Friends' Games"}
          {currentUser && friendLobbies.length > 0 && (
            <span className="ms-1.5 bg-primary-600 text-white text-xs rounded-full w-4 h-4 inline-flex items-center justify-center">
              {friendLobbies.length}
            </span>
          )}
        </TabBtn>
      </div>

      {tab === 'friends' && !currentUser && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-2">👥</p>
          <p className="text-lg">{lang === 'he' ? 'התחבר כדי לראות משחקי חברים' : "Log in to see friends' games"}</p>
        </div>
      )}

      {tab === 'friends' && currentUser && friendLobbies.length === 0 && !loading && !loadError && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-2">👥</p>
          <p>{lang === 'he' ? 'אין לחברים שלך משחקים קרובים' : 'No upcoming games from your friends'}</p>
          <p className="text-sm mt-1">{lang === 'he' ? 'מצא חברים בשדה החיפוש למעלה' : 'Find friends using the search bar above'}</p>
        </div>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-16 text-lg">{lang === 'he' ? 'טוען משחקים...' : 'Loading games...'}</p>
      ) : loadError ? (
        <p className="text-center text-red-500 py-16 text-lg">{loadError}</p>
      ) : displayed.length === 0 && tab === 'all' ? (
        <p className="text-center text-gray-400 py-16 text-lg">{t.home.noResults}</p>
      ) : displayed.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map((lobby) => (
            <LobbyCard
              key={lobby.id}
              lobby={lobby}
              distanceLabel={refPoint ? undefined : t.home.distanceUnavailable}
              distanceNote={refPoint ? distanceSourceText : undefined}
            />
          ))}
        </div>
      ) : null}
    </main>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${active ? 'bg-primary-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600'}`}>
      {children}
    </button>
  );
}

function FilterChip({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
        disabled ? 'opacity-40 cursor-not-allowed bg-white text-gray-400 border-gray-200' :
        active ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
      }`}>
      {children}
    </button>
  );
}
