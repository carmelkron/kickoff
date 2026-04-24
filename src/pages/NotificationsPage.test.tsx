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
        kind: 'lobby_invite',
        title: 'Locked lobby invite',
        message: 'Dana invited you to Sunset Match',
        isRead: false,
        createdAt: '2026-04-23T10:00:00.000Z',
        lobbyId: 'lobby-1',
      },
    ],
    unreadCount: 1,
    loadingNotifications: false,
    notificationActionError: '',
    clearingNotifications: false,
    openNotification: vi.fn(),
    handleMarkAllRead: vi.fn(),
    handleClearAllNotifications: vi.fn(),
  }),
}));

describe('NotificationsPage', () => {
  it('renders the dedicated notifications page and its list content', async () => {
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('Notifications')).toHaveLength(2);
    expect(screen.getByText('Locked lobby invite')).toBeInTheDocument();
    expect(screen.getByText('Dana invited you to Sunset Match')).toBeInTheDocument();
    expect(screen.queryByText('Everything that needs your attention')).not.toBeInTheDocument();
  });
});
