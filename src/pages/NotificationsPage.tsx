import NotificationList from '../components/NotificationList';
import { useLang } from '../contexts/LanguageContext';
import { useNotificationCenter } from '../hooks/useNotificationCenter';

export default function NotificationsPage() {
  const { lang } = useLang();
  const notificationCenter = useNotificationCenter();

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          {lang === 'he' ? 'התראות' : 'Notifications'}
        </p>
      </div>

      <NotificationList
        notifications={notificationCenter.notifications}
        unreadCount={notificationCenter.unreadCount}
        loadingNotifications={notificationCenter.loadingNotifications}
        notificationActionError={notificationCenter.notificationActionError}
        clearingNotifications={notificationCenter.clearingNotifications}
        onOpenNotification={notificationCenter.openNotification}
        onMarkAllRead={notificationCenter.handleMarkAllRead}
        onClearAllNotifications={notificationCenter.handleClearAllNotifications}
      />
    </section>
  );
}
