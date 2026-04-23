import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import NotificationsPage from './NotificationsPage';

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
  }),
}));

vi.mock('../hooks/useNotificationCenter', () => ({
  useNotificationCenter: () => ({
    notifications: [
      {
        id: 'notif-1',
        kind: 'friend_request',
        title: 'Friend request',
        message: 'Dana sent you a request',
        isRead: false,
        createdAt: '2026-04-23T10:00:00.000Z',
        profileId: 'user-2',
        requesterId: 'user-2',
      },
    ],
    unreadCount: 1,
    loadingNotifications: false,
    notificationActionError: '',
    busyNotificationId: '',
    deletingNotificationId: '',
    clearingNotifications: false,
    handledRequestActions: {},
    handledLobbyRequestActions: {},
    handledWaitlistActions: {},
    openNotification: vi.fn(),
    handleMarkAllRead: vi.fn(),
    handleDeleteNotification: vi.fn(),
    handleClearAllNotifications: vi.fn(),
    handleNotificationFriendRequest: vi.fn(),
    handleLobbyJoinRequest: vi.fn(),
    handleWaitlistNotificationAction: vi.fn(),
  }),
}));

describe('NotificationsPage', () => {
  it('renders the dedicated notifications page and its list content', async () => {
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Everything that needs your attention')).toBeInTheDocument();
    expect(screen.getByText('Friend request')).toBeInTheDocument();
    expect(screen.getByText('Dana sent you a request')).toBeInTheDocument();
  });
});
