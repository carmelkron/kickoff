import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { translations } from '../i18n/translations';
import Navbar from './Navbar';

const approveLobbyJoinRequestMock = vi.fn();
const declineLobbyJoinRequestMock = vi.fn();
const deleteAllNotificationsMock = vi.fn();
const deleteNotificationMock = vi.fn();
const dismissLobbyResultReminderForSessionMock = vi.fn();
const fetchNotificationsMock = vi.fn();
const fetchPendingLobbyResultRemindersMock = vi.fn();
const isLobbyResultReminderDismissedForSessionMock = vi.fn();
const markAllNotificationsReadMock = vi.fn();
const markNotificationReadMock = vi.fn();
const passLobbyWaitlistSpotMock = vi.fn();
const upsertLobbyMembershipMock = vi.fn();
const removeChannelMock = vi.fn();
const channelOnMock = vi.fn();
const channelSubscribeMock = vi.fn();

const logoutMock = vi.fn();
const acceptFriendRequestMock = vi.fn();
const declineFriendRequestMock = vi.fn();

let currentUser:
  | {
      id: string;
      name: string;
      initials: string;
      avatarColor: string;
      photoUrl?: string;
    }
  | null = null;

let notificationsResponse: Array<{
  id: string;
  kind: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  lobbyId?: string;
  profileId?: string;
  requesterId?: string;
}> = [];

let remindersResponse: Array<{
  lobbyId: string;
  lobbyTitle: string;
  lobbyDatetime: string;
  remindAt: string;
}> = [];

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
    t: translations.en,
    toggleLanguage: vi.fn(),
    isRTL: false,
  }),
}));

vi.mock('../contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({
    currentUser,
    logout: (...args: unknown[]) => logoutMock(...args),
    acceptFriendRequest: (...args: unknown[]) => acceptFriendRequestMock(...args),
    declineFriendRequest: (...args: unknown[]) => declineFriendRequestMock(...args),
  }),
}));

vi.mock('../lib/appNotifications', () => ({
  fetchNotifications: (...args: unknown[]) => fetchNotificationsMock(...args),
  markAllNotificationsRead: (...args: unknown[]) => markAllNotificationsReadMock(...args),
  markNotificationRead: (...args: unknown[]) => markNotificationReadMock(...args),
  deleteNotification: (...args: unknown[]) => deleteNotificationMock(...args),
  deleteAllNotifications: (...args: unknown[]) => deleteAllNotificationsMock(...args),
}));

vi.mock('../lib/appData', () => ({
  approveLobbyJoinRequest: (...args: unknown[]) => approveLobbyJoinRequestMock(...args),
  declineLobbyJoinRequest: (...args: unknown[]) => declineLobbyJoinRequestMock(...args),
  fetchPendingLobbyResultReminders: (...args: unknown[]) => fetchPendingLobbyResultRemindersMock(...args),
  passLobbyWaitlistSpot: (...args: unknown[]) => passLobbyWaitlistSpotMock(...args),
  upsertLobbyMembership: (...args: unknown[]) => upsertLobbyMembershipMock(...args),
}));

vi.mock('../lib/lobbyResultReminders', () => ({
  dismissLobbyResultReminderForSession: (...args: unknown[]) => dismissLobbyResultReminderForSessionMock(...args),
  isLobbyResultReminderDismissedForSession: (...args: unknown[]) => isLobbyResultReminderDismissedForSessionMock(...args),
}));

vi.mock('../lib/supabase', () => ({
  requireSupabase: () => ({
    channel: () => ({
      on: (...args: unknown[]) => {
        channelOnMock(...args);
        return {
          subscribe: (...subscribeArgs: unknown[]) => {
            channelSubscribeMock(...subscribeArgs);
            return {};
          },
        };
      },
    }),
    removeChannel: (...args: unknown[]) => removeChannelMock(...args),
  }),
}));

function renderNavbar(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="*" element={<Navbar />} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/create" element={<div>Create Page</div>} />
        <Route path="/profile/:id" element={<div>Profile Page</div>} />
        <Route path="/lobby/:id" element={<div>Lobby Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Navbar', () => {
  beforeEach(() => {
    currentUser = null;
    notificationsResponse = [];
    remindersResponse = [];
    fetchNotificationsMock.mockReset().mockImplementation(async () => notificationsResponse);
    fetchPendingLobbyResultRemindersMock.mockReset().mockImplementation(async () => remindersResponse);
    isLobbyResultReminderDismissedForSessionMock.mockReset().mockReturnValue(false);
    markAllNotificationsReadMock.mockReset().mockResolvedValue(undefined);
    markNotificationReadMock.mockReset().mockResolvedValue(undefined);
    deleteNotificationMock.mockReset().mockResolvedValue(undefined);
    deleteAllNotificationsMock.mockReset().mockResolvedValue(undefined);
    approveLobbyJoinRequestMock.mockReset().mockResolvedValue(undefined);
    declineLobbyJoinRequestMock.mockReset().mockResolvedValue(undefined);
    passLobbyWaitlistSpotMock.mockReset().mockResolvedValue(undefined);
    upsertLobbyMembershipMock.mockReset().mockResolvedValue(undefined);
    logoutMock.mockReset();
    acceptFriendRequestMock.mockReset().mockResolvedValue(undefined);
    declineFriendRequestMock.mockReset().mockResolvedValue(undefined);
    dismissLobbyResultReminderForSessionMock.mockReset();
    removeChannelMock.mockReset();
    channelOnMock.mockReset();
    channelSubscribeMock.mockReset();
  });

  it('lets guests navigate to login and create pages', async () => {
    const user = userEvent.setup();
    renderNavbar('/');

    await user.click(screen.getByRole('button', { name: /login/i }));
    expect(await screen.findByText('Login Page')).toBeInTheDocument();

    cleanup();
    renderNavbar('/');
    await user.click(screen.getByRole('button', { name: '+ Create Game' }));
    expect(await screen.findByText('Create Page')).toBeInTheDocument();
  });

  it('lets signed-in users open their profile and log out', async () => {
    currentUser = {
      id: 'viewer-1',
      name: 'Viewer User',
      initials: 'VU',
      avatarColor: 'bg-blue-500',
    };
    const user = userEvent.setup();
    renderNavbar('/');

    await user.click(screen.getByRole('button', { name: /viewer/i }));
    expect(await screen.findByText('Profile Page')).toBeInTheDocument();

    cleanup();
    renderNavbar('/');
    await user.click(screen.getByTitle('Log out'));
    expect(logoutMock).toHaveBeenCalled();
  });

  it('shows the organizer reminder modal and supports later or open-lobby actions', async () => {
    currentUser = {
      id: 'viewer-1',
      name: 'Viewer User',
      initials: 'VU',
      avatarColor: 'bg-blue-500',
    };
    remindersResponse = [
      {
        lobbyId: 'lobby-1',
        lobbyTitle: 'Late Night Match',
        lobbyDatetime: '2026-04-23T18:00:00.000Z',
        remindAt: '2026-04-23T20:00:00.000Z',
      },
    ];

    const user = userEvent.setup();
    renderNavbar('/');

    expect(await screen.findByText('This lobby still needs a result')).toBeInTheDocument();
    expect(screen.getByText('Late Night Match')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(dismissLobbyResultReminderForSessionMock).toHaveBeenCalledWith('lobby-1');

    dismissLobbyResultReminderForSessionMock.mockReset();
    cleanup();
    renderNavbar('/');
    expect(await screen.findByText('This lobby still needs a result')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open lobby' }));
    expect(await screen.findByText('Lobby Page')).toBeInTheDocument();
  });

  it('loads notifications and handles friend, lobby, and waitlist actions', async () => {
    currentUser = {
      id: 'viewer-1',
      name: 'Viewer User',
      initials: 'VU',
      avatarColor: 'bg-blue-500',
    };
    notificationsResponse = [
      {
        id: 'notif-friend',
        kind: 'friend_request',
        title: 'Friend request',
        message: 'Alex wants to connect',
        isRead: false,
        createdAt: '2026-04-23T10:00:00.000Z',
        requesterId: 'friend-1',
        profileId: 'friend-1',
      },
      {
        id: 'notif-lobby-request',
        kind: 'lobby_join_request',
        title: 'Join request',
        message: 'Sam wants access',
        isRead: false,
        createdAt: '2026-04-23T10:05:00.000Z',
        requesterId: 'player-2',
        lobbyId: 'lobby-2',
      },
      {
        id: 'notif-waitlist',
        kind: 'waitlist_spot_opened',
        title: 'Spot opened',
        message: 'A spot opened for you',
        isRead: false,
        createdAt: '2026-04-23T10:10:00.000Z',
        lobbyId: 'lobby-3',
      },
    ];

    const user = userEvent.setup();
    renderNavbar('/');

    await user.click(screen.getByTitle('Notifications'));
    expect(await screen.findByText('Friend request')).toBeInTheDocument();
    expect(screen.getByText('3 new')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => {
      expect(acceptFriendRequestMock).toHaveBeenCalledWith('friend-1');
    });

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => {
      expect(approveLobbyJoinRequestMock).toHaveBeenCalledWith('lobby-2', 'player-2', 'viewer-1');
    });

    await user.click(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() => {
      expect(upsertLobbyMembershipMock).toHaveBeenCalledWith('lobby-3', 'viewer-1', 'joined');
    });
  });

  it('marks notifications read, clears them, deletes one, and opens linked destinations', async () => {
    currentUser = {
      id: 'viewer-1',
      name: 'Viewer User',
      initials: 'VU',
      avatarColor: 'bg-blue-500',
    };
    notificationsResponse = [
      {
        id: 'notif-profile',
        kind: 'friend_request_accepted',
        title: 'Accepted',
        message: 'Dana accepted',
        isRead: false,
        createdAt: '2026-04-23T10:00:00.000Z',
        profileId: 'profile-1',
      },
      {
        id: 'notif-lobby',
        kind: 'team_assigned',
        title: 'Team assigned',
        message: 'Your team is ready',
        isRead: true,
        createdAt: '2026-04-23T10:05:00.000Z',
        lobbyId: 'lobby-4',
      },
    ];

    const user = userEvent.setup();
    renderNavbar('/');

    await user.click(screen.getByTitle('Notifications'));
    expect(await screen.findByText('Accepted')).toBeInTheDocument();

    await user.click(screen.getByText('Mark all as read'));
    expect(markAllNotificationsReadMock).toHaveBeenCalledWith('viewer-1');

    await user.click(screen.getAllByLabelText('Delete notification')[0]);
    await waitFor(() => {
      expect(deleteNotificationMock).toHaveBeenCalledWith('notif-profile');
    });

    notificationsResponse = [
      {
        id: 'notif-profile',
        kind: 'friend_request_accepted',
        title: 'Accepted',
        message: 'Dana accepted',
        isRead: false,
        createdAt: '2026-04-23T10:00:00.000Z',
        profileId: 'profile-1',
      },
      {
        id: 'notif-lobby',
        kind: 'team_assigned',
        title: 'Team assigned',
        message: 'Your team is ready',
        isRead: true,
        createdAt: '2026-04-23T10:05:00.000Z',
        lobbyId: 'lobby-4',
      },
    ];
    cleanup();
    renderNavbar('/');
    await user.click(screen.getByTitle('Notifications'));
    await user.click(screen.getByText('Accepted'));
    await waitFor(() => {
      expect(markNotificationReadMock).toHaveBeenCalledWith('notif-profile');
    });
    expect(await screen.findByText('Profile Page')).toBeInTheDocument();

    cleanup();
    renderNavbar('/');
    await user.click(screen.getByTitle('Notifications'));
    await user.click(screen.getByText('Clear all'));
    expect(deleteAllNotificationsMock).toHaveBeenCalledWith('viewer-1');
  });
});
