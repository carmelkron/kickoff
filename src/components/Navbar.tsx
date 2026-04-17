import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Check, LogOut, Trash2, User, UserCheck, UserX } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import {
  deleteAllNotifications,
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../lib/appNotifications';
import { approveLobbyJoinRequest, declineLobbyJoinRequest, passLobbyWaitlistSpot, upsertLobbyMembership } from '../lib/appData';
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
  const [deletingNotificationId, setDeletingNotificationId] = useState('');
  const [clearingNotifications, setClearingNotifications] = useState(false);
  const [handledRequestActions, setHandledRequestActions] = useState<Record<string, 'accept' | 'decline'>>({});
  const [handledLobbyRequestActions, setHandledLobbyRequestActions] = useState<Record<string, 'accept' | 'decline'>>({});
  const [handledWaitlistActions, setHandledWaitlistActions] = useState<Record<string, 'join' | 'pass'>>({});
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
      setHandledRequestActions({});
      setHandledLobbyRequestActions({});
      setHandledWaitlistActions({});
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

  async function handleDeleteNotification(notificationId: string) {
    setDeletingNotificationId(notificationId);
    setNotificationActionError('');
    try {
      await deleteNotification(notificationId);
      setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
      setHandledRequestActions((current) => {
        const next = { ...current };
        delete next[notificationId];
        return next;
      });
      setHandledLobbyRequestActions((current) => {
        const next = { ...current };
        delete next[notificationId];
        return next;
      });
      setHandledWaitlistActions((current) => {
        const next = { ...current };
        delete next[notificationId];
        return next;
      });
    } catch (error) {
      setNotificationActionError(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setDeletingNotificationId('');
    }
  }

  async function handleClearAllNotifications() {
    if (!currentUser) {
      return;
    }

    setClearingNotifications(true);
    setNotificationActionError('');
    try {
      await deleteAllNotifications(currentUser.id);
      setNotifications([]);
      setHandledRequestActions({});
      setHandledLobbyRequestActions({});
      setHandledWaitlistActions({});
    } catch (error) {
      setNotificationActionError(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setClearingNotifications(false);
    }
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
      setHandledRequestActions((current) => ({
        ...current,
        [notification.id]: action,
      }));
      await refreshNotifications();
    } catch (error) {
      setNotificationActionError(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setBusyNotificationId('');
    }
  }

  async function handleLobbyJoinRequest(action: 'accept' | 'decline', notification: AppNotification) {
    if (!currentUser || !notification.lobbyId || !notification.requesterId) {
      return;
    }

    setBusyNotificationId(notification.id);
    setNotificationActionError('');
    try {
      if (action === 'accept') {
        await approveLobbyJoinRequest(notification.lobbyId, notification.requesterId, currentUser.id);
      } else {
        await declineLobbyJoinRequest(notification.lobbyId, notification.requesterId, currentUser.id);
      }
      setHandledLobbyRequestActions((current) => ({
        ...current,
        [notification.id]: action,
      }));
      await refreshNotifications();
    } catch (error) {
      setNotificationActionError(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setBusyNotificationId('');
    }
  }

  async function handleWaitlistNotificationAction(action: 'join' | 'pass', notification: AppNotification) {
    if (!currentUser || !notification.lobbyId) {
      return;
    }

    setBusyNotificationId(notification.id);
    setNotificationActionError('');
    try {
      if (action === 'join') {
        await upsertLobbyMembership(notification.lobbyId, currentUser.id, 'joined');
      } else {
        await passLobbyWaitlistSpot(notification.lobbyId, currentUser.id);
      }
      setHandledWaitlistActions((current) => ({
        ...current,
        [notification.id]: action,
      }));
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
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => void handleMarkAllRead()}
                            className="text-xs text-primary-600 hover:underline"
                          >
                            {t.nav.markAllRead}
                          </button>
                          <button
                            onClick={() => void handleClearAllNotifications()}
                            disabled={clearingNotifications}
                            className="text-xs text-red-500 hover:underline disabled:opacity-60"
                          >
                            {t.nav.clearAllNotifications}
                          </button>
                        </div>
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
                          const handledAction = handledRequestActions[notification.id];
                          const handledLobbyRequestAction = handledLobbyRequestActions[notification.id];
                          const handledWaitlistAction = handledWaitlistActions[notification.id];
                          return (
                            <div
                              key={notification.id}
                              className={`px-4 py-3 border-b border-gray-100 last:border-b-0 ${notification.isRead ? 'bg-white' : 'bg-primary-50/60'}`}
                            >
                              <div className="flex items-start gap-2">
                                <button
                                  onClick={() => void openNotification(notification)}
                                  className="min-w-0 flex-1 text-start"
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
                                <button
                                  type="button"
                                  title={t.nav.deleteNotification}
                                  aria-label={t.nav.deleteNotification}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleDeleteNotification(notification.id);
                                  }}
                                  disabled={deletingNotificationId === notification.id}
                                  className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 disabled:opacity-60"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              {notification.kind === 'friend_request' && notification.requesterId && !handledAction && (
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

                              {notification.kind === 'friend_request' && handledAction && (
                                <div className="mt-3 ms-5">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${
                                      handledAction === 'accept'
                                        ? 'bg-green-50 text-green-700 border border-green-200'
                                        : 'bg-gray-50 text-gray-600 border border-gray-200'
                                    }`}
                                  >
                                    <Check size={13} />
                                    {handledAction === 'accept' ? t.nav.requestAccepted : t.nav.requestDeclined}
                                  </span>
                                </div>
                              )}

                              {notification.kind === 'lobby_join_request' && notification.requesterId && notification.lobbyId && !handledLobbyRequestAction && (
                                <div className="mt-3 ms-5 flex items-center gap-2">
                                  <button
                                    onClick={() => void handleLobbyJoinRequest('accept', notification)}
                                    disabled={busyNotificationId === notification.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors"
                                  >
                                    <UserCheck size={13} />
                                    {lang === 'he' ? 'אשר' : 'Approve'}
                                  </button>
                                  <button
                                    onClick={() => void handleLobbyJoinRequest('decline', notification)}
                                    disabled={busyNotificationId === notification.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-60 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
                                  >
                                    <UserX size={13} />
                                    {lang === 'he' ? 'דחה' : 'Decline'}
                                  </button>
                                </div>
                              )}

                              {notification.kind === 'lobby_join_request' && handledLobbyRequestAction && (
                                <div className="mt-3 ms-5">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${
                                      handledLobbyRequestAction === 'accept'
                                        ? 'bg-green-50 text-green-700 border border-green-200'
                                        : 'bg-gray-50 text-gray-600 border border-gray-200'
                                    }`}
                                  >
                                    <Check size={13} />
                                    {handledLobbyRequestAction === 'accept'
                                      ? (lang === 'he' ? 'בקשת הכניסה אושרה' : 'Access request approved')
                                      : (lang === 'he' ? 'בקשת הכניסה נדחתה' : 'Access request declined')}
                                  </span>
                                </div>
                              )}

                              {notification.kind === 'waitlist_spot_opened' && notification.lobbyId && !handledWaitlistAction && (
                                <div className="mt-3 ms-5 flex items-center gap-2">
                                  <button
                                    onClick={() => void handleWaitlistNotificationAction('join', notification)}
                                    disabled={busyNotificationId === notification.id}
                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors"
                                  >
                                    {lang === 'he' ? 'כנס' : 'Join'}
                                  </button>
                                  <button
                                    onClick={() => void handleWaitlistNotificationAction('pass', notification)}
                                    disabled={busyNotificationId === notification.id}
                                    className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-60 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
                                  >
                                    {lang === 'he' ? 'העבר לבא בתור' : 'Pass to next'}
                                  </button>
                                </div>
                              )}

                              {notification.kind === 'waitlist_spot_opened' && handledWaitlistAction && (
                                <div className="mt-3 ms-5">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${
                                      handledWaitlistAction === 'join'
                                        ? 'bg-green-50 text-green-700 border border-green-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}
                                  >
                                    <Check size={13} />
                                    {handledWaitlistAction === 'join'
                                      ? (lang === 'he' ? 'המקום אושר' : 'Spot confirmed')
                                      : (lang === 'he' ? 'הועבר לבא בתור' : 'Passed to next')}
                                  </span>
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
