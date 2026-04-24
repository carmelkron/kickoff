import { Bell, Check } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import type { AppNotification } from '../lib/appNotifications';

type Props = {
  notifications: AppNotification[];
  unreadCount: number;
  loadingNotifications: boolean;
  notificationActionError: string;
  clearingNotifications: boolean;
  onOpenNotification: (notification: AppNotification) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onClearAllNotifications: () => Promise<void>;
};

export default function NotificationList({
  notifications,
  unreadCount,
  loadingNotifications,
  notificationActionError,
  clearingNotifications,
  onOpenNotification,
  onMarkAllRead,
  onClearAllNotifications,
}: Props) {
  const { lang } = useLang();

  return (
    <div className="overflow-hidden rounded-[28px] border border-[var(--app-border)] bg-[var(--panel)] shadow-[0_24px_70px_rgba(7,19,16,0.08)]">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--app-border)] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Bell size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">
              {lang === 'he' ? 'התראות' : 'Notifications'}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {unreadCount > 0
                ? (lang === 'he' ? `${unreadCount} חדשות` : `${unreadCount} unread`)
                : (lang === 'he' ? 'הכול מעודכן' : 'All caught up')}
            </p>
          </div>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-3 text-xs font-semibold">
            <button type="button" onClick={() => void onMarkAllRead()} className="text-[var(--accent)] hover:opacity-80">
              {lang === 'he' ? 'סמן כנקרא' : 'Mark all read'}
            </button>
            <button
              type="button"
              onClick={() => void onClearAllNotifications()}
              disabled={clearingNotifications}
              className="text-rose-500 hover:opacity-80 disabled:opacity-60"
            >
              {lang === 'he' ? 'נקה' : 'Clear'}
            </button>
          </div>
        )}
      </div>

      {notificationActionError && (
        <p className="px-5 pt-4 text-sm text-rose-500">{notificationActionError}</p>
      )}

      <div className="max-h-[calc(100vh-18rem)] overflow-y-auto">
        {loadingNotifications ? (
          <p className="px-5 py-12 text-center text-sm text-[var(--muted)]">
            {lang === 'he' ? 'טוען התראות...' : 'Loading notifications...'}
          </p>
        ) : notifications.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-semibold text-[var(--text)]">
              {lang === 'he' ? 'אין התראות כרגע' : 'No notifications right now'}
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => void onOpenNotification(notification)}
              className={`block w-full border-b border-[var(--app-border)] px-5 py-4 text-start last:border-b-0 ${notification.isRead ? 'bg-transparent' : 'bg-[var(--accent-soft)]/50'}`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notification.isRead ? 'bg-[var(--app-border)]' : 'bg-[var(--accent)]'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-[var(--text)]">{notification.title}</p>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--muted)]">
                      <span>{formatNotificationTimestamp(notification.createdAt, lang)}</span>
                      {notification.isRead && <Check size={14} className="shrink-0" />}
                    </div>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{notification.message}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function formatNotificationTimestamp(createdAt: string, lang: 'he' | 'en') {
  return new Date(createdAt).toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
