import { Bell, Check, Trash2, UserCheck, UserX } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import type { AppNotification } from '../lib/appNotifications';

type Props = {
  notifications: AppNotification[];
  unreadCount: number;
  loadingNotifications: boolean;
  notificationActionError: string;
  busyNotificationId: string;
  deletingNotificationId: string;
  clearingNotifications: boolean;
  handledRequestActions: Record<string, 'accept' | 'decline'>;
  handledLobbyRequestActions: Record<string, 'accept' | 'decline'>;
  handledWaitlistActions: Record<string, 'join' | 'pass'>;
  onOpenNotification: (notification: AppNotification) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onDeleteNotification: (notificationId: string) => Promise<void>;
  onClearAllNotifications: () => Promise<void>;
  onFriendRequestAction: (action: 'accept' | 'decline', notification: AppNotification) => Promise<void>;
  onLobbyJoinRequestAction: (action: 'accept' | 'decline', notification: AppNotification) => Promise<void>;
  onWaitlistAction: (action: 'join' | 'pass', notification: AppNotification) => Promise<void>;
};

export default function NotificationList({
  notifications,
  unreadCount,
  loadingNotifications,
  notificationActionError,
  busyNotificationId,
  deletingNotificationId,
  clearingNotifications,
  handledRequestActions,
  handledLobbyRequestActions,
  handledWaitlistActions,
  onOpenNotification,
  onMarkAllRead,
  onDeleteNotification,
  onClearAllNotifications,
  onFriendRequestAction,
  onLobbyJoinRequestAction,
  onWaitlistAction,
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
              {lang === 'he' ? 'סמן הכול כנקרא' : 'Mark all read'}
            </button>
            <button
              type="button"
              onClick={() => void onClearAllNotifications()}
              disabled={clearingNotifications}
              className="text-rose-500 hover:opacity-80 disabled:opacity-60"
            >
              {lang === 'he' ? 'נקה הכול' : 'Clear all'}
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
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <Bell size={22} />
            </div>
            <p className="mt-4 text-sm font-semibold text-[var(--text)]">
              {lang === 'he' ? 'אין התראות כרגע' : 'No notifications right now'}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {lang === 'he'
                ? 'כאן תראה בקשות, הזמנות, תוצאות ועדכונים חשובים.'
                : 'Requests, invites, results, and key updates will appear here.'}
            </p>
          </div>
        ) : (
          notifications.map((notification) => {
            const handledAction = handledRequestActions[notification.id];
            const handledLobbyRequestAction = handledLobbyRequestActions[notification.id];
            const handledWaitlistAction = handledWaitlistActions[notification.id];

            return (
              <div
                key={notification.id}
                className={`border-b border-[var(--app-border)] px-5 py-4 last:border-b-0 ${notification.isRead ? 'bg-transparent' : 'bg-[var(--accent-soft)]/50'}`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => void onOpenNotification(notification)}
                    className="min-w-0 flex-1 text-start"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${notification.isRead ? 'bg-[var(--app-border)]' : 'bg-[var(--accent)]'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--text)]">{notification.title}</p>
                          {notification.isRead && <Check size={14} className="shrink-0 text-[var(--muted)]" />}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{notification.message}</p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteNotification(notification.id)}
                    disabled={deletingNotificationId === notification.id}
                    className="rounded-xl p-2 text-[var(--muted)] transition-colors hover:bg-black/5 hover:text-rose-500 disabled:opacity-60"
                    aria-label={lang === 'he' ? 'מחק התראה' : 'Delete notification'}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {notification.kind === 'friend_request' && notification.requesterId && !handledAction && (
                  <div className="mt-4 flex items-center gap-2 ps-8">
                    <button
                      type="button"
                      onClick={() => void onFriendRequestAction('accept', notification)}
                      disabled={busyNotificationId === notification.id}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      <UserCheck size={13} />
                      {lang === 'he' ? 'אשר' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onFriendRequestAction('decline', notification)}
                      disabled={busyNotificationId === notification.id}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] px-3.5 py-2 text-xs font-semibold text-[var(--text)] disabled:opacity-60"
                    >
                      <UserX size={13} />
                      {lang === 'he' ? 'דחה' : 'Decline'}
                    </button>
                  </div>
                )}

                {notification.kind === 'friend_request' && handledAction && (
                  <div className="mt-4 ps-8 text-xs font-semibold text-[var(--muted)]">
                    {handledAction === 'accept'
                      ? (lang === 'he' ? 'בקשת החברות אושרה' : 'Friend request accepted')
                      : (lang === 'he' ? 'בקשת החברות נדחתה' : 'Friend request declined')}
                  </div>
                )}

                {notification.kind === 'lobby_join_request' && notification.requesterId && notification.lobbyId && !handledLobbyRequestAction && (
                  <div className="mt-4 flex items-center gap-2 ps-8">
                    <button
                      type="button"
                      onClick={() => void onLobbyJoinRequestAction('accept', notification)}
                      disabled={busyNotificationId === notification.id}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      <UserCheck size={13} />
                      {lang === 'he' ? 'אשר' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onLobbyJoinRequestAction('decline', notification)}
                      disabled={busyNotificationId === notification.id}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] px-3.5 py-2 text-xs font-semibold text-[var(--text)] disabled:opacity-60"
                    >
                      <UserX size={13} />
                      {lang === 'he' ? 'דחה' : 'Decline'}
                    </button>
                  </div>
                )}

                {notification.kind === 'lobby_join_request' && handledLobbyRequestAction && (
                  <div className="mt-4 ps-8 text-xs font-semibold text-[var(--muted)]">
                    {handledLobbyRequestAction === 'accept'
                      ? (lang === 'he' ? 'בקשת הכניסה אושרה' : 'Access request approved')
                      : (lang === 'he' ? 'בקשת הכניסה נדחתה' : 'Access request declined')}
                  </div>
                )}

                {notification.kind === 'waitlist_spot_opened' && notification.lobbyId && !handledWaitlistAction && (
                  <div className="mt-4 flex items-center gap-2 ps-8">
                    <button
                      type="button"
                      onClick={() => void onWaitlistAction('join', notification)}
                      disabled={busyNotificationId === notification.id}
                      className="rounded-xl bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {lang === 'he' ? 'הצטרף' : 'Join'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onWaitlistAction('pass', notification)}
                      disabled={busyNotificationId === notification.id}
                      className="rounded-xl border border-[var(--app-border)] px-3.5 py-2 text-xs font-semibold text-[var(--text)] disabled:opacity-60"
                    >
                      {lang === 'he' ? 'העבר לבא בתור' : 'Pass to next'}
                    </button>
                  </div>
                )}

                {notification.kind === 'waitlist_spot_opened' && handledWaitlistAction && (
                  <div className="mt-4 ps-8 text-xs font-semibold text-[var(--muted)]">
                    {handledWaitlistAction === 'join'
                      ? (lang === 'he' ? 'המקום אושר עבורך' : 'Spot confirmed')
                      : (lang === 'he' ? 'הועבר זמנית לבא בתור' : 'Passed to next')}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
