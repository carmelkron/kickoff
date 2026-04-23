import NotificationList from '../components/NotificationList';
import { useLang } from '../contexts/LanguageContext';
import { useNotificationCenter } from '../hooks/useNotificationCenter';

export default function NotificationsPage() {
  const { lang } = useLang();
  const notificationCenter = useNotificationCenter();

  return (
    <section>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          {lang === 'he' ? 'מרכז ההתראות' : 'Notification Center'}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
          {lang === 'he' ? 'כל מה שצריך את תשומת הלב שלך' : 'Everything that needs your attention'}
        </h1>
      </div>

      <NotificationList
        notifications={notificationCenter.notifications}
        unreadCount={notificationCenter.unreadCount}
        loadingNotifications={notificationCenter.loadingNotifications}
        notificationActionError={notificationCenter.notificationActionError}
        busyNotificationId={notificationCenter.busyNotificationId}
        deletingNotificationId={notificationCenter.deletingNotificationId}
        clearingNotifications={notificationCenter.clearingNotifications}
        handledRequestActions={notificationCenter.handledRequestActions}
        handledLobbyRequestActions={notificationCenter.handledLobbyRequestActions}
        handledWaitlistActions={notificationCenter.handledWaitlistActions}
        onOpenNotification={notificationCenter.openNotification}
        onMarkAllRead={notificationCenter.handleMarkAllRead}
        onDeleteNotification={notificationCenter.handleDeleteNotification}
        onClearAllNotifications={notificationCenter.handleClearAllNotifications}
        onFriendRequestAction={notificationCenter.handleNotificationFriendRequest}
        onLobbyJoinRequestAction={notificationCenter.handleLobbyJoinRequest}
        onWaitlistAction={notificationCenter.handleWaitlistNotificationAction}
      />
    </section>
  );
}
