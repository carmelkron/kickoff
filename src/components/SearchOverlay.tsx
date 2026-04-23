import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { fetchSearchResults } from '../lib/appData';
import type { SearchHistoryEntry, SearchResult } from '../types';

type Props = {
  open: boolean;
  onClose: () => void;
};

type ResultFilter = 'all' | 'lobbies' | 'people';

function HistoryRow({ entry, onSelect, lang }: { entry: SearchHistoryEntry; onSelect: () => void; lang: 'he' | 'en' }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-start transition-colors hover:bg-black/5"
    >
      <div>
        <p className="text-sm font-semibold text-[var(--text)]">{entry.label}</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          {entry.kind === 'query'
            ? (lang === 'he' ? 'שאילתת חיפוש' : 'Search query')
            : entry.kind === 'profile'
              ? (lang === 'he' ? 'אדם' : 'Person')
              : (lang === 'he' ? 'לובי' : 'Lobby')}
        </p>
      </div>
      <span className="text-xs text-[var(--muted)]">
        {new Date(entry.actedAt).toLocaleDateString()}
      </span>
    </button>
  );
}

function ResultCard({ result, onSelect }: { result: SearchResult; onSelect: () => void }) {
  if (result.kind === 'profile') {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-3 rounded-3xl border border-[var(--app-border)] bg-[var(--panel)] px-4 py-3 text-start transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(7,19,16,0.08)]"
      >
        {result.imageUrl ? (
          <img src={result.imageUrl} alt={result.title} className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${result.avatarColor} text-sm font-bold text-white`}>
            {result.initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text)]">{result.title}</p>
          {result.subtitle && <p className="mt-1 truncate text-xs text-[var(--muted)]">{result.subtitle}</p>}
        </div>
        <div className="text-end">
          <p className="text-xs font-semibold text-[var(--accent)]">
            {result.competitivePoints ?? 0} pts
          </p>
          {result.isFriend && <p className="text-[11px] text-emerald-600">Friend</p>}
          {!result.isFriend && result.pendingState === 'sent' && <p className="text-[11px] text-[var(--muted)]">Sent</p>}
          {!result.isFriend && result.pendingState === 'received' && <p className="text-[11px] text-[var(--muted)]">Received</p>}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-3xl border border-[var(--app-border)] bg-[var(--panel)] px-4 py-3 text-start transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(7,19,16,0.08)]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
        <Users size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--text)]">{result.title}</p>
        {result.subtitle && <p className="mt-1 truncate text-xs text-[var(--muted)]">{result.subtitle}</p>}
      </div>
      <div className="text-end text-[11px] text-[var(--muted)]">
        <p>{result.gameType === 'competitive' ? 'Competitive' : 'Friendly'}</p>
        <p>{result.joinedCount}/{result.maxPlayers}</p>
      </div>
    </button>
  );
}

export default function SearchOverlay({ open, onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { lang } = useLang();
  const { currentUser } = useAuth();
  const {
    searchHistory,
    addRecentSearchQuery,
    addRecentSearchTap,
    clearSearchHistory,
  } = useAppPreferences();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ResultFilter>('all');
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setFilter('all');
      return;
    }

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, [open]);

  useEffect(() => {
    if (!open || !deferredQuery.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchSearchResults(deferredQuery, currentUser?.id).then((nextResults) => {
      if (!cancelled) {
        setResults(nextResults);
      }
    }).catch(() => {
      if (!cancelled) {
        setResults([]);
      }
    }).finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, deferredQuery, open]);

  const filteredResults = useMemo(() => {
    if (filter === 'all') {
      return results;
    }

    return results.filter((result) => (filter === 'lobbies' ? result.kind === 'lobby' : result.kind === 'profile'));
  }, [filter, results]);

  const recentQueries = searchHistory.filter((entry) => entry.kind === 'query').slice(0, 8);
  const recentOpened = searchHistory.filter((entry) => entry.kind !== 'query').slice(0, 8);

  async function handleSelectResult(result: SearchResult) {
    if (query.trim()) {
      await addRecentSearchQuery(query);
    }
    await addRecentSearchTap({
      kind: result.kind,
      targetId: result.id,
      label: result.title,
    });
    onClose();
    navigate(result.kind === 'profile' ? `/profile/${result.id}` : `/lobby/${result.id}`);
  }

  async function handleSelectHistoryEntry(entry: SearchHistoryEntry) {
    if (entry.kind === 'query' && entry.queryText) {
      setQuery(entry.queryText);
      return;
    }

    onClose();
    if (entry.kind === 'profile' && entry.targetId) {
      navigate(`/profile/${entry.targetId}`);
    }
    if (entry.kind === 'lobby' && entry.targetId) {
      navigate(`/lobby/${entry.targetId}`);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/35 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col bg-[var(--panel)] px-4 pb-8 pt-6 sm:rounded-[32px] sm:pb-10 sm:pt-8">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={lang === 'he' ? 'חפש אנשים או לובים' : 'Search people or lobbies'}
              className="w-full rounded-full border border-[var(--app-border)] bg-[var(--surface)] ps-11 pe-5 py-3 text-sm text-[var(--text)] outline-none transition-shadow focus:shadow-[0_0_0_4px_rgba(15,127,84,0.12)]"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--app-border)] text-[var(--text)]"
            aria-label={lang === 'he' ? 'סגור חיפוש' : 'Close search'}
          >
            <X size={18} />
          </button>
        </div>

        {query.trim() ? (
          <>
            <div className="mt-5 flex items-center gap-2">
              {([
                ['all', lang === 'he' ? 'הכול' : 'All'],
                ['lobbies', lang === 'he' ? 'לובים' : 'Lobbies'],
                ['people', lang === 'he' ? 'אנשים' : 'People'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    filter === value
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--surface)] text-[var(--muted)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {loading ? (
                <p className="py-12 text-center text-sm text-[var(--muted)]">
                  {lang === 'he' ? 'מחפש...' : 'Searching...'}
                </p>
              ) : filteredResults.length > 0 ? (
                filteredResults.map((result) => (
                  <ResultCard key={`${result.kind}:${result.id}`} result={result} onSelect={() => void handleSelectResult(result)} />
                ))
              ) : (
                <p className="py-12 text-center text-sm text-[var(--muted)]">
                  {lang === 'he' ? 'לא נמצאו תוצאות' : 'No matching results'}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="mt-6 grid gap-6">
            <section className="rounded-[28px] border border-[var(--app-border)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text)]">
                    {lang === 'he' ? 'חיפושים אחרונים' : 'Recent searches'}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {lang === 'he' ? 'השאילתות האחרונות שחיפשת.' : 'Your latest search queries.'}
                  </p>
                </div>
                {searchHistory.length > 0 && (
                  <button type="button" onClick={() => void clearSearchHistory()} className="text-xs font-semibold text-[var(--accent)]">
                    {lang === 'he' ? 'נקה הכול' : 'Clear all'}
                  </button>
                )}
              </div>
              <div className="mt-4 space-y-2">
                {recentQueries.length > 0 ? (
                  recentQueries.map((entry) => (
                    <HistoryRow key={entry.id} entry={entry} lang={lang} onSelect={() => void handleSelectHistoryEntry(entry)} />
                  ))
                ) : (
                  <p className="rounded-2xl bg-[var(--panel)] px-4 py-4 text-sm text-[var(--muted)]">
                    {lang === 'he' ? 'עדיין אין חיפושים אחרונים.' : 'No recent searches yet.'}
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--app-border)] bg-[var(--surface)] p-4">
              <h2 className="text-sm font-semibold text-[var(--text)]">
                {lang === 'he' ? 'נפתחו דרך החיפוש' : 'Opened from search'}
              </h2>
              <div className="mt-4 space-y-2">
                {recentOpened.length > 0 ? (
                  recentOpened.map((entry) => (
                    <HistoryRow key={entry.id} entry={entry} lang={lang} onSelect={() => void handleSelectHistoryEntry(entry)} />
                  ))
                ) : (
                  <p className="rounded-2xl bg-[var(--panel)] px-4 py-4 text-sm text-[var(--muted)]">
                    {lang === 'he' ? 'כאן יופיעו תוצאות שפתחת דרך החיפוש.' : 'Results opened from search will show up here.'}
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
