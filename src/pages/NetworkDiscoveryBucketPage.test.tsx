import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NetworkDiscoveryBucketPage from './NetworkDiscoveryBucketPage';

const fetchNetworkRecommendationsMock = vi.fn();
const sendFriendRequestMock = vi.fn();
const refreshCurrentUserMock = vi.fn();

let currentUser: { id: string } | null = { id: 'viewer-1' };

vi.mock('../lib/appData', () => ({
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

function makeRecommendation(id: string, name: string) {
  return {
    profile: makePlayer(id, name),
    score: 85,
    primaryBucket: 'played_together' as const,
    subtitle: 'Midfield',
    mutualFriends: 1,
    sharedLobbies: 1,
    sameTeamLobbies: 0,
    recentInteractions: 0,
    reasons: [],
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/network/discovery/played_together']}>
      <Routes>
        <Route path="/network/discovery/:bucket" element={<NetworkDiscoveryBucketPage />} />
        <Route path="/network" element={<div>Network Route</div>} />
        <Route path="/profile/:id" element={<div>Profile Route</div>} />
        <Route path="/login" element={<div>Login Route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NetworkDiscoveryBucketPage', () => {
  beforeEach(() => {
    currentUser = { id: 'viewer-1' };
    fetchNetworkRecommendationsMock.mockReset().mockResolvedValue([
      makeRecommendation('user-4', 'Avi Attack'),
      makeRecommendation('user-5', 'Dana Wing'),
    ]);
    sendFriendRequestMock.mockReset().mockResolvedValue(undefined);
    refreshCurrentUserMock.mockReset().mockResolvedValue(undefined);
  });

  it('shows the full list for a recommendation bucket and supports connecting', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('People you played with')).toBeInTheDocument();
    expect(screen.getByText('Avi Attack')).toBeInTheDocument();
    expect(screen.getByText('Dana Wing')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Connect' })[0]);
    await waitFor(() => {
      expect(sendFriendRequestMock).toHaveBeenCalledWith('user-4');
    });
  });
});
