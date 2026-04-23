import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import {
  deleteAllNotifications,
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../lib/appNotifications';
import {
  approveLobbyJoinRequest,
  declineLobbyJoinRequest,
  passLobbyWaitlistSpot,
  upsertLobbyMembership,
} from '../lib/appData';
import { mapNotificationKindToPreference } from '../lib/preferences';
import { requireSupabase } from '../lib/supabase';

export function useNotificationCenter() {
  const instanceId = useId();
  const navigate = useNavigate();
  const { lang } = useLang();
  const { notificationPreferences } = useAppPreferences();
  const { currentUser, acceptFriendRequest, declineFriendRequest } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationActionError, setNotificationActionError] = useState('');
  const [busyNotificationId, setBusyNotificationId] = useState('');
  const [deletingNotificationId, setDeletingNotificationId] = useState('');
  const [clearingNotifications, setClearingNotifications] = useState(false);
  const [handledRequestActions, setHandledRequestActions] = useState<Record<string, 'accept' | 'decline'>>({});
  const [handledLobbyRequestActions, setHandledLobbyRequestActions] = useState<Record<string, 'accept' | 'decline'>>({});
  const [handledWaitlistActions, setHandledWaitlistActions] = useState<Record<string, 'join' | 'pass'>>({});

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
      .channel(`notifications:${currentUserId}:${instanceId}`)
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
      if (document.visibilityState === 'hidden') {
        return;
      }

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
  }, [currentUser, instanceId, lang]);

  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => notificationPreferences[mapNotificationKindToPreference(notification.kind)]),
    [notificationPreferences, notifications],
  );

  const unreadCount = visibleNotifications.filter((notification) => !notification.isRead).length;

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

  return {
    notifications: visibleNotifications,
    unreadCount,
    loadingNotifications,
    notificationActionError,
    busyNotificationId,
    deletingNotificationId,
    clearingNotifications,
    handledRequestActions,
    handledLobbyRequestActions,
    handledWaitlistActions,
    refreshNotifications,
    handleMarkAllRead,
    handleDeleteNotification,
    handleClearAllNotifications,
    openNotification,
    handleNotificationFriendRequest,
    handleLobbyJoinRequest,
    handleWaitlistNotificationAction,
  };
}
