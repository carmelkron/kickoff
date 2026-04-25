import { useEffect, useState } from 'react';
import { Bell, Gift, Home, PlusSquare, Search, Trophy, Users } from 'lucide-react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { useNotificationCenter } from '../hooks/useNotificationCenter';
import { fetchPendingLobbyResultReminders } from '../lib/appData';
import {
  dismissLobbyResultReminderForSession,
  isLobbyResultReminderDismissedForSession,
  type PendingLobbyResultReminder,
} from '../lib/lobbyResultReminders';
import ProfileDrawer from './ProfileDrawer';
import SearchOverlay from './SearchOverlay';

const NAV_ITEMS = [
  { to: '/', icon: Home, key: 'home' },
  { to: '/network', icon: Users, key: 'network' },
  { to: '/create', icon: PlusSquare, key: 'create' },
  { to: '/raffles', icon: Gift, key: 'raffles' },
  { to: '/leaderboards', icon: Trophy, key: 'leaderboards' },
] as const;

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useLang();
  const { currentUser } = useAuth();
  const { unreadCount } = useNotificationCenter();
  const pendingNetworkRequests = currentUser?.pendingRequests.length ?? 0;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingResultReminder, setPendingResultReminder] = useState<PendingLobbyResultReminder | null>(null);

  if (currentUser?.onboardingStatus && currentUser.onboardingStatus !== 'complete') {
    return <Navigate to="/register" replace />;
  }

  useEffect(() => {
    if (!currentUser) {
      setPendingResultReminder(null);
      return;
    }

    const currentUserId = currentUser.id;
    let cancelled = false;

    async function loadReminder() {
      try {
        const reminders = await fetchPendingLobbyResultReminders(currentUserId);
        const nextReminder = reminders.find((reminder) =>
          !isLobbyResultReminderDismissedForSession(reminder.lobbyId)
          && location.pathname !== `/lobby/${reminder.lobbyId}`,
        ) ?? null;

        if (!cancelled) {
          setPendingResultReminder(nextReminder);
        }
      } catch {
        if (!cancelled) {
          setPendingResultReminder(null);
        }
      }
    }

    void loadReminder();
    const intervalId = window.setInterval(() => {
      void loadReminder();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [currentUser, location.pathname]);

  function handleDismissResultReminder() {
    if (!pendingResultReminder) {
      return;
    }

    dismissLobbyResultReminderForSession(pendingResultReminder.lobbyId);
    setPendingResultReminder(null);
  }

  function handleOpenReminderLobby() {
    if (!pendingResultReminder) {
      return;
    }

    const lobbyId = pendingResultReminder.lobbyId;
    setPendingResultReminder(null);
    navigate(`/lobby/${lobbyId}`);
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text)]">
      {currentUser && pendingResultReminder && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[30px] bg-[var(--panel)] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-600">
                  {lang === 'he' ? 'תזכורת למארגן' : 'Organizer reminder'}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--text)]">
                  {lang === 'he' ? 'הלובי הזה עדיין מחכה לתוצאה' : 'This lobby still needs a result'}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleDismissResultReminder}
                className="rounded-2xl border border-[var(--app-border)] px-3 py-1.5 text-sm font-medium text-[var(--muted)]"
              >
                {lang === 'he' ? 'אחר כך' : 'Later'}
              </button>
            </div>
            <div className="mt-4 rounded-[22px] border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{pendingResultReminder.lobbyTitle}</p>
              <p className="mt-1">
                {lang === 'he'
                  ? 'עבר מספיק זמן מאז המשחק. פתח את הלובי ודווח את התוצאה כדי לחלק נקודות.'
                  : 'Enough time has passed since kickoff. Open the lobby and report the result so points can be awarded.'}
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleDismissResultReminder}
                className="rounded-2xl border border-[var(--app-border)] px-4 py-2.5 text-sm font-semibold text-[var(--muted)]"
              >
                {lang === 'he' ? 'הזכר לי אחר כך' : 'Remind me later'}
              </button>
              <button
                type="button"
                onClick={handleOpenReminderLobby}
                className="rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white"
              >
                {lang === 'he' ? 'פתח לובי' : 'Open lobby'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--app-border)] bg-[var(--panel)]/95 backdrop-blur-xl">
        <div dir="ltr" className="mx-auto flex h-20 w-full max-w-5xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className={`relative flex h-11 w-11 items-center justify-center rounded-full border ${
              location.pathname === '/notifications'
                ? 'border-primary-600 bg-primary-50 text-primary-600'
                : 'border-[var(--app-border)] bg-[var(--surface)] text-[var(--text)]'
            }`}
            aria-label={lang === 'he' ? 'התראות' : 'Notifications'}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                aria-label={lang === 'he' ? `${unreadCount} התראות לא נקראו` : `${unreadCount} unread notifications`}
                className="absolute -end-1 -top-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-[18px] text-white"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            dir={lang === 'he' ? 'rtl' : 'ltr'}
            className="flex flex-1 items-center gap-3 rounded-full border border-[var(--app-border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)] shadow-sm"
          >
            <Search size={18} />
            <span>{lang === 'he' ? 'חיפוש' : 'Search'}</span>
          </button>

          <button
            type="button"
            onClick={() => (currentUser ? setDrawerOpen(true) : navigate('/login'))}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--surface)]"
            aria-label={lang === 'he' ? 'פרופיל' : 'Profile'}
          >
            {currentUser?.photoUrl ? (
              <img src={currentUser.photoUrl} alt={currentUser.name} className="h-11 w-11 rounded-full object-cover" />
            ) : currentUser ? (
              <div className={`flex h-11 w-11 items-center justify-center rounded-full ${currentUser.avatarColor} text-sm font-bold text-white`}>
                {currentUser.initials}
              </div>
            ) : (
              <Users size={18} />
            )}
          </button>
        </div>
      </header>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ProfileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--app-border)] bg-[var(--panel)]/96 backdrop-blur-xl">
        <div className="mx-auto grid max-w-5xl grid-cols-5 gap-1 px-2 py-2">
          {NAV_ITEMS.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-[var(--muted)]'
                }`
              }
            >
              {key === 'network' && pendingNetworkRequests > 0 && (
                <span
                  aria-label={lang === 'he' ? `${pendingNetworkRequests} בקשות חברות ממתינות` : `${pendingNetworkRequests} pending friend requests`}
                  className="absolute end-1 top-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-[18px] text-white"
                >
                  {pendingNetworkRequests > 9 ? '9+' : pendingNetworkRequests}
                </span>
              )}
              <Icon size={18} />
              <span>{getNavLabel(key, lang)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function getNavLabel(
  key: 'home' | 'network' | 'create' | 'raffles' | 'leaderboards',
  lang: 'he' | 'en',
) {
  if (lang === 'he') {
    if (key === 'home') return 'דף הבית';
    if (key === 'network') return 'הרשת שלי';
    if (key === 'create') return 'לובי חדש';
    if (key === 'raffles') return 'הגרלות';
    return 'לוח הישגים';
  }

  if (key === 'home') return 'Home';
  if (key === 'network') return 'My Network';
  if (key === 'create') return 'Create';
  if (key === 'raffles') return 'Raffles';
  return 'Leaderboards';
}
