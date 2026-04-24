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

function makeRecommendation(id: string, name: string, bucket: 'played_together' | 'mutual_friends' | 'near_you' | 'people_you_may_know') {
  return {
    profile: makePlayer(id, name),
    score: 85,
    primaryBucket: bucket,
    subtitle: 'Midfield',
    mutualFriends: bucket === 'mutual_friends' ? 2 : 0,
    sharedLobbies: bucket === 'played_together' ? 1 : 0,
    sameTeamLobbies: 0,
    recentInteractions: 0,
    reasons: [],
  };
}

function renderNetworkPage() {
  return render(
    <MemoryRouter initialEntries={['/network']}>
      <Routes>
        <Route path="/network" element={<MyNetworkPage />} />
        <Route path="/network/discovery/:bucket" element={<div>Bucket Route</div>} />
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
      makeRecommendation('user-4', 'Avi Attack', 'played_together'),
      makeRecommendation('user-5', 'Neta Keeper', 'played_together'),
      makeRecommendation('user-6', 'Lior Wing', 'played_together'),
      makeRecommendation('user-7', 'Roi Midfield', 'played_together'),
      makeRecommendation('user-8', 'Gal Pass', 'played_together'),
      makeRecommendation('user-9', 'Mika Link', 'mutual_friends'),
    ]);
    acceptFriendRequestMock.mockReset().mockResolvedValue(undefined);
    declineFriendRequestMock.mockReset().mockResolvedValue(undefined);
    sendFriendRequestMock.mockReset().mockResolvedValue(undefined);
    refreshCurrentUserMock.mockReset().mockResolvedValue(undefined);
  });

  it('shows discovery buckets without score or reason chips and lets the user view all', async () => {
    const user = userEvent.setup();
    renderNetworkPage();

    expect(await screen.findByText('People you played with')).toBeInTheDocument();
    expect(screen.getByText('Avi Attack')).toBeInTheDocument();
    expect(screen.getByText('Mutual friends')).toBeInTheDocument();
    expect(screen.getByText('2 mutual friends')).toBeInTheDocument();
    expect(screen.queryByText('Score')).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /View all/i })[0]);
    expect(await screen.findByText('Bucket Route')).toBeInTheDocument();
  });

  it('shows request management tabs and keeps existing actions working', async () => {
    const user = userEvent.setup();
    renderNetworkPage();

    await user.click(screen.getByRole('button', { name: 'Manage requests' }));
    expect(await screen.findByText('Dana Defender')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Accept/i }));
    await waitFor(() => {
      expect(acceptFriendRequestMock).toHaveBeenCalledWith('user-2');
    });

    await user.click(screen.getByRole('button', { name: 'Sent' }));
    expect(await screen.findByText('Maya Midfield')).toBeInTheDocument();
    expect(screen.getByText('Awaiting response')).toBeInTheDocument();
  });
});
