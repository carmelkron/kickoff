import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Check, LogOut, User, UserCheck, UserX } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification } from '../lib/appNotifications';
import { requireSupabase } from '../lib/supabase';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang, toggleLanguage } = useLang();
  const { currentUser, logout, acceptFriendRequest, declineFriendRequest } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationActionError, setNotificationActionError] = useState('');
  const [busyNotificationId, setBusyNotificationId] = useState('');
  const notificationRef = useRef<HTMLDivElement | null>(null);

  const isActive = (path: string) => location.pathname === path;
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    const supabase = requireSupabase();
    const currentUserId = currentUser.id;
    let cancelled = false;

    async function loadNotifications(showSpinner = true) {
      try {
        if (showSpinner) {
          setLoadingNotifications(true);
        }
        const nextNotifications = await fetchNotifications(currentUserId, lang);
        if (!cancelled) {
          setNotifications(nextNotifications);
        }
      } catch {
        if (!cancelled) {
          setNotifications([]);
        }
      } finally {
        if (!cancelled && showSpinner) {
          setLoadingNotifications(false);
        }
      }
    }

    void loadNotifications();
    const intervalId = window.setInterval(() => {
      void loadNotifications(false);
    }, 60000);
    const channel = supabase
      .channel(`notifications:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${currentUserId}`,
        },
        () => {
          void loadNotifications(false);
        },
      )
      .subscribe();

    function handleWindowFocus() {
      void loadNotifications(false);
    }

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleWindowFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleWindowFocus);
      void supabase.removeChannel(channel);
    };
  }, [currentUser, lang]);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }

    void refreshNotifications();
  }, [notificationsOpen]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  async function refreshNotifications(showSpinner = false) {
    if (!currentUser) {
      return;
    }

    try {
      if (showSpinner) {
        setLoadingNotifications(true);
      }
      const nextNotifications = await fetchNotifications(currentUser.id, lang);
      setNotifications(nextNotifications);
    } finally {
      if (showSpinner) {
        setLoadingNotifications(false);
      }
    }
  }

  async function handleMarkAllRead() {
    if (!currentUser) {
      return;
    }

    await markAllNotificationsRead(currentUser.id);
    await refreshNotifications();
  }

  async function openNotification(notification: AppNotification) {
    if (!notification.isRead) {
      await markNotificationRead(notification.id);
      await refreshNotifications();
    }

    setNotificationsOpen(false);

    if (notification.profileId) {
      navigate(`/profile/${notification.profileId}`);
      return;
    }

    if (notification.lobbyId) {
      navigate(`/lobby/${notification.lobbyId}`);
    }
  }

  async function handleNotificationFriendRequest(action: 'accept' | 'decline', notification: AppNotification) {
    if (!notification.requesterId) {
      return;
    }

    setBusyNotificationId(notification.id);
    setNotificationActionError('');
    try {
      if (action === 'accept') {
        await acceptFriendRequest(notification.requesterId);
      } else {
        await declineFriendRequest(notification.requesterId);
      }
      await refreshNotifications();
    } catch (error) {
      setNotificationActionError(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setBusyNotificationId('');
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 font-bold text-xl text-gray-900 hover:text-primary-600 transition-colors"
        >
          <span className="text-2xl">⚽</span>
          <span>{t.app.name}</span>
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={toggleLanguage}
            className="text-sm font-medium text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {lang === 'he' ? 'EN' : 'עב'}
          </button>

          {!isActive('/') && (
            <button
              onClick={() => navigate('/')}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors hidden sm:block"
            >
              {t.nav.home}
            </button>
          )}

          {currentUser ? (
            <>
              <div ref={notificationRef} className="relative">
                <button
                  onClick={() => setNotificationsOpen((open) => !open)}
                  className="relative text-gray-500 hover:text-gray-900 p-2 rounded-xl hover:bg-gray-100 transition-colors"
                  title={t.nav.notifications}
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute end-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{t.nav.notifications}</p>
                        {unreadCount > 0 && (
                          <p className="text-xs text-gray-400">
                            {lang === 'he' ? `${unreadCount} חדשות` : `${unreadCount} new`}
                          </p>
                        )}
                      </div>
                      {notifications.length > 0 && (
                        <button
                          onClick={() => void handleMarkAllRead()}
                          className="text-xs text-primary-600 hover:underline"
                        >
                          {t.nav.markAllRead}
                        </button>
                      )}
                    </div>

                    {notificationActionError && (
                      <p className="px-4 pt-3 text-sm text-red-500">{notificationActionError}</p>
                    )}

                    <div className="max-h-[24rem] overflow-y-auto">
                      {loadingNotifications ? (
                        <p className="px-4 py-6 text-sm text-gray-400 text-center">{t.nav.loadingNotifications}</p>
                      ) : notifications.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-gray-400 text-center">{t.nav.noNotifications}</p>
                      ) : (
                        notifications.map((notification) => {
                          return (
                            <div
                              key={notification.id}
                              className={`px-4 py-3 border-b border-gray-100 last:border-b-0 ${notification.isRead ? 'bg-white' : 'bg-primary-50/60'}`}
                            >
                              <button
                                onClick={() => void openNotification(notification)}
                                className="w-full text-start"
                              >
                                <div className="flex items-start gap-3">
                                  <span className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${notification.isRead ? 'bg-gray-200' : 'bg-primary-600'}`} />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                                      {notification.isRead && <Check size={14} className="text-gray-300 shrink-0" />}
                                    </div>
                                    <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                                  </div>
                                </div>
                              </button>

                              {notification.kind === 'friend_request' && notification.requesterId && (
                                <div className="mt-3 ms-5 flex items-center gap-2">
                                  <button
                                    onClick={() => void handleNotificationFriendRequest('accept', notification)}
                                    disabled={busyNotificationId === notification.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors"
                                  >
                                    <UserCheck size={13} />
                                    {lang === 'he' ? 'אשר' : 'Accept'}
                                  </button>
                                  <button
                                    onClick={() => void handleNotificationFriendRequest('decline', notification)}
                                    disabled={busyNotificationId === notification.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-60 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
                                  >
                                    <UserX size={13} />
                                    {lang === 'he' ? 'דחה' : 'Decline'}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile button */}
              <button
                onClick={() => navigate(`/profile/${currentUser.id}`)}
                className="flex items-center gap-2 hover:bg-gray-100 rounded-xl px-2 py-1.5 transition-colors"
              >
                {currentUser.photoUrl ? (
                  <img src={currentUser.photoUrl} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className={`w-8 h-8 rounded-full ${currentUser.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                    {currentUser.initials}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700 hidden sm:block">{currentUser.name.split(' ')[0]}</span>
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                title={lang === 'he' ? 'התנתק' : 'Log out'}
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <User size={15} />
              {lang === 'he' ? 'כניסה' : 'Login'}
            </button>
          )}

          {/* Create game */}
          <button
            onClick={() => navigate('/create')}
            className="text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl transition-colors"
          >
            {t.nav.createGame}
          </button>
        </div>
      </div>
    </header>
  );
}
