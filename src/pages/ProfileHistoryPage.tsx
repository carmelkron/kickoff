import { MapPin, Trophy, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { fetchProfileLobbyHistory } from '../lib/appData';
import type { GameType, LobbyHistoryEntry } from '../types';

type GameTypeFilter = 'all' | GameType;
type DateRangeFilter = 'all' | '30' | '90';
type SortMode = 'newest' | 'oldest';

const PAGE_SIZE = 10;

function applyDateRange(items: LobbyHistoryEntry[], range: DateRangeFilter) {
  if (range === 'all') {
    return items;
  }

  const days = Number(range);
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return items.filter((item) => new Date(item.date).getTime() >= threshold);
}

function sortByDate(items: LobbyHistoryEntry[], sortMode: SortMode) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.date).getTime();
    const rightTime = new Date(right.date).getTime();
    return sortMode === 'newest' ? rightTime - leftTime : leftTime - rightTime;
  });
}

function LobbyTypeBadge({ gameType, lang }: { gameType: GameType; lang: 'he' | 'en' }) {
  const isCompetitive = gameType === 'competitive';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
      isCompetitive ? 'bg-primary-50 text-primary-700' : 'bg-green-50 text-green-700'
    }`}>
      {isCompetitive ? <Trophy size={12} /> : <Users size={12} />}
      {isCompetitive
        ? (lang === 'he' ? 'תחרותי' : 'Competitive')
        : (lang === 'he' ? 'ידידותי' : 'Friendly')}
    </span>
  );
}

export default function ProfileHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lang } = useLang();
  const { getAllUsers, currentUser } = useAuth();
  const [gameTypeFilter, setGameTypeFilter] = useState<GameTypeFilter>('all');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [lobbyHistory, setLobbyHistory] = useState<LobbyHistoryEntry[]>([]);
  const [loadingLobbyHistory, setLoadingLobbyHistory] = useState(false);

  const allUsers = getAllUsers();
  const profile = allUsers.find((user) => user.id === id) ?? null;
  const isMe = currentUser?.id === id;

  useEffect(() => {
    if (!profile) {
      setLobbyHistory([]);
      return;
    }

    const profileId = profile.id;
    let cancelled = false;

    async function loadHistory() {
      setLoadingLobbyHistory(true);

      try {
        const nextLobbyHistory = await fetchProfileLobbyHistory(profileId);
        if (!cancelled) {
          setLobbyHistory(nextLobbyHistory);
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

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const filteredLobbyHistory = useMemo(() => {
    const byType = gameTypeFilter === 'all'
      ? lobbyHistory
      : lobbyHistory.filter((entry) => (entry.gameType ?? 'friendly') === gameTypeFilter);

    return sortByDate(applyDateRange(byType, dateRange), sortMode);
  }, [dateRange, gameTypeFilter, lobbyHistory, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filteredLobbyHistory.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [gameTypeFilter, dateRange, sortMode]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const visibleEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredLobbyHistory.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredLobbyHistory]);

  if (!profile && allUsers.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-gray-500">
        {lang === 'he' ? 'טוען היסטוריה...' : 'Loading history...'}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-gray-500">{lang === 'he' ? 'המשתמש לא נמצא' : 'User not found'}</p>
        <div className="mt-4">
          <BackButton onClick={() => navigate(-1)} />
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <BackButton onClick={() => navigate(-1)} className="mb-6" />

      <section className="mb-4 rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {lang === 'he'
                ? isMe ? 'כל היסטוריית הלובים שלי' : `היסטוריית הלובים של ${profile.name}`
                : isMe ? 'My lobby history' : `${profile.name}'s lobby history`}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {lang === 'he'
                ? `${filteredLobbyHistory.length} לובים`
                : `${filteredLobbyHistory.length} lobbies`}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {([
            ['all', lang === 'he' ? 'הכל' : 'All'],
            ['friendly', lang === 'he' ? 'ידידותי' : 'Friendly'],
            ['competitive', lang === 'he' ? 'תחרותי' : 'Competitive'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setGameTypeFilter(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                gameTypeFilter === value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {([
            ['all', lang === 'he' ? 'כל הזמנים' : 'All time'],
            ['30', lang === 'he' ? '30 ימים' : '30 days'],
            ['90', lang === 'he' ? '90 ימים' : '90 days'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDateRange(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                dateRange === value ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setSortMode((current) => current === 'newest' ? 'oldest' : 'newest')}
            className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-200"
          >
            {sortMode === 'newest'
              ? (lang === 'he' ? 'מהחדש לישן' : 'Newest first')
              : (lang === 'he' ? 'מהישן לחדש' : 'Oldest first')}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">{lang === 'he' ? 'היסטוריית לובים' : 'Lobby history'}</h2>
          <span className="text-xs font-medium text-gray-400">
            {filteredLobbyHistory.length}
          </span>
        </div>

        {loadingLobbyHistory ? (
          <p className="text-sm text-gray-500">{lang === 'he' ? 'טוען היסטוריית לובים...' : 'Loading lobby history...'}</p>
        ) : visibleEntries.length > 0 ? (
          <>
            <div className="space-y-3">
              {visibleEntries.map((entry, index) => (
                <button
                  key={`${entry.lobbyId}-${index}`}
                  type="button"
                  onClick={() => navigate(`/lobby/${entry.lobbyId}`)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-start transition-colors hover:bg-gray-100"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50">
                    <MapPin size={16} className="text-primary-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">{entry.lobbyTitle}</p>
                      <LobbyTypeBadge gameType={entry.gameType ?? 'friendly'} lang={lang} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(entry.date).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US')}
                      {entry.city ? ` • ${entry.city}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {totalPages > 1 ? (
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                  disabled={currentPage === 1}
                  className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {lang === 'he' ? 'הקודם' : 'Previous'}
                </button>

                <p className="text-sm font-medium text-gray-500">
                  {lang === 'he'
                    ? `עמוד ${currentPage} מתוך ${totalPages}`
                    : `Page ${currentPage} of ${totalPages}`}
                </p>

                <button
                  type="button"
                  onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {lang === 'he' ? 'הבא' : 'Next'}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-gray-500">
            {lang === 'he' ? 'אין לובים להצגה במסנן הזה.' : 'No lobbies match this filter.'}
          </p>
        )}
      </section>
    </main>
  );
}
