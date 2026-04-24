import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';

const fetchPendingLobbyResultRemindersMock = vi.fn();

let currentUser: {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  pendingRequests: string[];
  photoUrl?: string;
} | null = null;

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
  }),
}));

vi.mock('../contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({
    currentUser,
  }),
}));

vi.mock('../hooks/useNotificationCenter', () => ({
  useNotificationCenter: () => ({
    unreadCount: 3,
  }),
}));

vi.mock('../lib/appData', () => ({
  fetchPendingLobbyResultReminders: (...args: unknown[]) => fetchPendingLobbyResultRemindersMock(...args),
}));

vi.mock('./SearchOverlay', () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) => (open ? <div>Search Overlay</div> : null),
}));

vi.mock('./ProfileDrawer', () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) => (open ? <div>Profile Drawer</div> : null),
}));

function renderShell(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<div>Home Route</div>} />
          <Route path="/notifications" element={<div>Notifications Route</div>} />
          <Route path="/network" element={<div>Network Route</div>} />
          <Route path="/create" element={<div>Create Route</div>} />
          <Route path="/raffles" element={<div>Raffles Route</div>} />
          <Route path="/leaderboards" element={<div>Leaderboards Route</div>} />
          <Route path="/lobby/:id" element={<div>Lobby Route</div>} />
        </Route>
        <Route path="/login" element={<div>Login Route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    currentUser = {
      id: 'viewer-1',
      name: 'Viewer User',
      initials: 'VU',
      avatarColor: 'bg-blue-500',
      pendingRequests: ['user-2', 'user-3'],
    };
    fetchPendingLobbyResultRemindersMock.mockReset().mockResolvedValue([]);
  });

  it('opens the search overlay and profile drawer from the top bar', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: /profile/i }));
    expect(screen.getByText('Profile Drawer')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Search/i }));
    expect(screen.getByText('Search Overlay')).toBeInTheDocument();
  });

  it('navigates to notifications and shows the unread badge', async () => {
    const user = userEvent.setup();
    renderShell();

    expect(screen.getByLabelText('3 unread notifications')).toBeInTheDocument();
    expect(screen.getByLabelText('2 pending friend requests')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Notifications/i }));
    expect(await screen.findByText('Notifications Route')).toBeInTheDocument();
  });
});
