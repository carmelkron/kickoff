import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  clearRecentSearchHistory as clearRecentSearchHistoryRemote,
  fetchRecentSearchEntries,
  fetchUserPreferences,
  saveRecentSearchQuery,
  saveRecentSearchTap,
  saveUserPreferences,
} from '../lib/appData';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  LOCAL_PREFERENCES_KEY,
  LOCAL_SEARCH_HISTORY_KEY,
  SEARCH_HISTORY_LIMIT,
  getInitialThemeMode,
  normalizeNotificationPreferences,
  resolveThemeMode,
} from '../lib/preferences';
import { requireSupabase } from '../lib/supabase';
import type {
  NotificationPreferenceKey,
  NotificationPreferences,
  SearchHistoryEntry,
  ThemeMode,
} from '../types';

type StoredPreferences = {
  language: 'he' | 'en';
  themeMode: ThemeMode;
  notificationPreferences: NotificationPreferences;
};

type AppPreferencesContextValue = {
  language: 'he' | 'en';
  setLanguage: (language: 'he' | 'en') => void;
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setThemeMode: (themeMode: ThemeMode) => void;
  notificationPreferences: NotificationPreferences;
  setNotificationPreference: (key: NotificationPreferenceKey, value: boolean) => void;
  searchHistory: SearchHistoryEntry[];
  addRecentSearchQuery: (query: string) => Promise<void>;
  addRecentSearchTap: (input: { kind: 'profile' | 'lobby'; targetId: string; label: string }) => Promise<void>;
  clearSearchHistory: () => Promise<void>;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

function readStoredPreferences(): StoredPreferences {
  if (typeof window === 'undefined') {
    return {
      language: 'he',
      themeMode: getInitialThemeMode(),
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    };
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_PREFERENCES_KEY);
    if (!raw) {
      return {
        language: 'he',
        themeMode: getInitialThemeMode(),
        notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
      };
    }

    const parsed = JSON.parse(raw) as Partial<StoredPreferences>;
    return {
      language: parsed.language === 'en' ? 'en' : 'he',
      themeMode: parsed.themeMode ?? getInitialThemeMode(),
      notificationPreferences: normalizeNotificationPreferences(parsed.notificationPreferences),
    };
  } catch {
    return {
      language: 'he',
      themeMode: getInitialThemeMode(),
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    };
  }
}

function readStoredSearchHistory(): SearchHistoryEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_SEARCH_HISTORY_KEY);
    if (!raw) {
      return [];
    }

    return JSON.parse(raw) as SearchHistoryEntry[];
  } catch {
    return [];
  }
}

function dedupeSearchHistory(entries: SearchHistoryEntry[]) {
  const queryEntries: SearchHistoryEntry[] = [];
  const openedEntries: SearchHistoryEntry[] = [];
  const querySeen = new Set<string>();
  const openedSeen = new Set<string>();

  for (const entry of entries) {
    if (entry.kind === 'query') {
      const key = entry.queryText?.trim().toLocaleLowerCase();
      if (!key || querySeen.has(key) || queryEntries.length >= SEARCH_HISTORY_LIMIT) {
        continue;
      }

      querySeen.add(key);
      queryEntries.push(entry);
      continue;
    }

    const key = `${entry.kind}:${entry.targetId}`;
    if (!entry.targetId || openedSeen.has(key) || openedEntries.length >= SEARCH_HISTORY_LIMIT) {
      continue;
    }

    openedSeen.add(key);
    openedEntries.push(entry);
  }

  return [...queryEntries, ...openedEntries].sort((left, right) =>
    new Date(right.actedAt).getTime() - new Date(left.actedAt).getTime(),
  );
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const supabase = requireSupabase();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [language, setLanguageState] = useState<'he' | 'en'>(() => readStoredPreferences().language);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => readStoredPreferences().themeMode);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    () => readStoredPreferences().notificationPreferences,
  );
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>(() => readStoredSearchHistory());
  const didHydrateRemote = useRef(false);
  const resolvedTheme = resolveThemeMode(themeMode);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify({
      language,
      themeMode,
      notificationPreferences,
    } satisfies StoredPreferences));
  }, [language, themeMode, notificationPreferences]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(LOCAL_SEARCH_HISTORY_KEY, JSON.stringify(dedupeSearchHistory(searchHistory)));
  }, [searchHistory]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
    document.body.style.backgroundColor = resolvedTheme === 'dark' ? '#071310' : '#f3f6f3';
  }, [resolvedTheme]);

  useEffect(() => {
    let active = true;

    async function loadPreferences(authProfileId: string | null) {
      didHydrateRemote.current = false;
      setProfileId(authProfileId);

      if (!authProfileId) {
        didHydrateRemote.current = true;
        return;
      }

      const [remotePreferences, remoteSearchHistory] = await Promise.all([
        fetchUserPreferences(authProfileId),
        fetchRecentSearchEntries(authProfileId),
      ]);

      if (!active) {
        return;
      }

      const localPreferences = readStoredPreferences();
      const localSearchHistory = readStoredSearchHistory();

      setLanguageState(remotePreferences?.language ?? localPreferences.language);
      setThemeModeState(remotePreferences?.themeMode ?? localPreferences.themeMode);
      setNotificationPreferences(
        normalizeNotificationPreferences(
          remotePreferences?.notificationPreferences ?? localPreferences.notificationPreferences,
        ),
      );

      const nextSearchHistory = remoteSearchHistory.length > 0 ? remoteSearchHistory : localSearchHistory;
      setSearchHistory(dedupeSearchHistory(nextSearchHistory));

      didHydrateRemote.current = true;
    }

    void supabase.auth.getUser().then(({ data }) => {
      void loadPreferences(data.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadPreferences(session?.user.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function persistPreferences(next: {
    language?: 'he' | 'en';
    themeMode?: ThemeMode;
    notificationPreferences?: NotificationPreferences;
  }) {
    if (!profileId || !didHydrateRemote.current) {
      return;
    }

    await saveUserPreferences(profileId, {
      language: next.language ?? language,
      themeMode: next.themeMode ?? themeMode,
      notificationPreferences: next.notificationPreferences ?? notificationPreferences,
    });
  }

  const setLanguage = (nextLanguage: 'he' | 'en') => {
    setLanguageState(nextLanguage);
    void persistPreferences({ language: nextLanguage });
  };

  const setThemeMode = (nextThemeMode: ThemeMode) => {
    setThemeModeState(nextThemeMode);
    void persistPreferences({ themeMode: nextThemeMode });
  };

  const setNotificationPreference = (key: NotificationPreferenceKey, value: boolean) => {
    const nextPreferences = {
      ...notificationPreferences,
      [key]: value,
    };
    setNotificationPreferences(nextPreferences);
    void persistPreferences({ notificationPreferences: nextPreferences });
  };

  const addRecentSearchQuery = async (query: string) => {
    const normalized = query.trim();
    if (!normalized) {
      return;
    }

    const entry: SearchHistoryEntry = {
      id: `local-query:${Date.now()}`,
      kind: 'query',
      queryText: normalized,
      label: normalized,
      actedAt: new Date().toISOString(),
    };

    setSearchHistory((current) => dedupeSearchHistory([entry, ...current]));
    if (profileId) {
      await saveRecentSearchQuery(profileId, normalized);
      const remoteEntries = await fetchRecentSearchEntries(profileId);
      setSearchHistory(dedupeSearchHistory(remoteEntries));
    }
  };

  const addRecentSearchTap = async (input: { kind: 'profile' | 'lobby'; targetId: string; label: string }) => {
    const entry: SearchHistoryEntry = {
      id: `local-${input.kind}:${input.targetId}:${Date.now()}`,
      kind: input.kind,
      targetId: input.targetId,
      label: input.label,
      actedAt: new Date().toISOString(),
    };

    setSearchHistory((current) => dedupeSearchHistory([entry, ...current]));
    if (profileId) {
      await saveRecentSearchTap(profileId, input);
      const remoteEntries = await fetchRecentSearchEntries(profileId);
      setSearchHistory(dedupeSearchHistory(remoteEntries));
    }
  };

  const clearSearchHistory = async () => {
    setSearchHistory([]);
    if (profileId) {
      await clearRecentSearchHistoryRemote(profileId);
    }
  };

  const value = useMemo<AppPreferencesContextValue>(() => ({
    language,
    setLanguage,
    themeMode,
    resolvedTheme,
    setThemeMode,
    notificationPreferences,
    setNotificationPreference,
    searchHistory,
    addRecentSearchQuery,
    addRecentSearchTap,
    clearSearchHistory,
  }), [language, themeMode, resolvedTheme, notificationPreferences, searchHistory]);

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);
  if (!context) {
    throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  }

  return context;
}
