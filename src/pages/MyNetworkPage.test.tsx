import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MyNetworkPage from './MyNetworkPage';

const fetchFriendRequestListsMock = vi.fn();
const fetchNetworkRecommendationsMock = vi.fn();

const acceptFriendRequestMock = vi.fn();
const declineFriendRequestMock = vi.fn();
const sendFriendRequestMock = vi.fn();
const refreshCurrentUserMock = vi.fn();

let currentUser: { id: string } | null = { id: 'viewer-1' };

vi.mock('../lib/appData', () => ({
  fetchFriendRequestLists: (...args: unknown[]) => fetchFriendRequestListsMock(...args),
  fetchNetworkRecommendations: (...args: unknown[]) => fetchNetworkRecommendationsMock(...args),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
  }),
}));

vi.mock('../contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({
    currentUser,
    acceptFriendRequest: (...args: unknown[]) => acceptFriendRequestMock(...args),
    declineFriendRequest: (...args: unknown[]) => declineFriendRequestMock(...args),
    sendFriendRequest: (...args: unknown[]) => sendFriendRequestMock(...args),
    refreshCurrentUser: (...args: unknown[]) => refreshCurrentUserMock(...args),
  }),
}));

function makePlayer(id: string, name: string) {
  return {
    id,
    name,
    initials: 'AB',
    avatarColor: 'bg-blue-500',
    rating: 5,
    gamesPlayed: 10,
    ratingHistory: [],
    lobbyHistory: [],
    competitivePoints: 120,
    position: 'Midfield',
  };
}

function renderNetworkPage() {
  return render(
    <MemoryRouter initialEntries={['/network']}>
      <Routes>
        <Route path="/network" element={<MyNetworkPage />} />
        <Route path="/profile/:id" element={<div>Profile Route</div>} />
        <Route path="/login" element={<div>Login Route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MyNetworkPage', () => {
  beforeEach(() => {
    currentUser = { id: 'viewer-1' };
    fetchFriendRequestListsMock.mockReset().mockResolvedValue({
      received: [{ id: 'user-2', user: makePlayer('user-2', 'Dana Defender') }],
      sent: [{ id: 'user-3', user: makePlayer('user-3', 'Maya Midfield') }],
    });
    fetchNetworkRecommendationsMock.mockReset().mockResolvedValue([
      {
        profile: makePlayer('user-4', 'Avi Attack'),
        score: 85,
        mutualFriends: 2,
        sharedLobbies: 1,
        sameTeamLobbies: 1,
        recentInteractions: 1,
        reasons: ['2 mutual friends', '1 shared lobby'],
      },
    ]);
    acceptFriendRequestMock.mockReset().mockResolvedValue(undefined);
    declineFriendRequestMock.mockReset().mockResolvedValue(undefined);
    sendFriendRequestMock.mockReset().mockResolvedValue(undefined);
    refreshCurrentUserMock.mockReset().mockResolvedValue(undefined);
  });

  it('shows received and sent tabs and lets the user send a request from recommendations', async () => {
    const user = userEvent.setup();
    renderNetworkPage();

    expect(await screen.findByText('Dana Defender')).toBeInTheDocument();
    expect(screen.getByText('Avi Attack')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Sent/i }));
    expect(await screen.findByText('Maya Midfield')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Send friend request/i }));
    await waitFor(() => {
      expect(sendFriendRequestMock).toHaveBeenCalledWith('user-4');
    });
  });

  it('accepts incoming requests from the received tab', async () => {
    const user = userEvent.setup();
    renderNetworkPage();

    await screen.findByText('Dana Defender');
    await user.click(screen.getByRole('button', { name: /Accept/i }));

    await waitFor(() => {
      expect(acceptFriendRequestMock).toHaveBeenCalledWith('user-2');
    });
  });
});
