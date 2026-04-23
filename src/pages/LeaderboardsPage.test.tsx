import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LeaderboardsPage from './LeaderboardsPage';

const fetchLeaderboardStatsMock = vi.fn();

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
  }),
}));

vi.mock('../lib/appData', () => ({
  fetchLeaderboardStats: (...args: unknown[]) => fetchLeaderboardStatsMock(...args),
}));

function makeEntry(id: string, name: string, rank: number, value: number) {
  return {
    rank,
    value,
    profile: {
      id,
      name,
      initials: 'AB',
      avatarColor: 'bg-blue-500',
      rating: 5,
      gamesPlayed: 12,
      ratingHistory: [],
      lobbyHistory: [],
    },
  };
}

function renderLeaderboards() {
  return render(
    <MemoryRouter initialEntries={['/leaderboards']}>
      <Routes>
        <Route path="/leaderboards" element={<LeaderboardsPage />} />
        <Route path="/profile/:id" element={<div>Profile Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LeaderboardsPage', () => {
  beforeEach(() => {
    fetchLeaderboardStatsMock.mockReset().mockResolvedValue({
      allTimePoints: [makeEntry('user-1', 'Dana Defender', 1, 420)],
      competitiveWins: [makeEntry('user-2', 'Avi Attack', 1, 18)],
      highestWinStreak: [makeEntry('user-3', 'Maya Midfield', 1, 7)],
    });
  });

  it('renders the three leaderboard tables', async () => {
    renderLeaderboards();

    expect(await screen.findByText('All-time points')).toBeInTheDocument();
    expect(screen.getByText('Competitive wins')).toBeInTheDocument();
    expect(screen.getByText('Highest win streak')).toBeInTheDocument();

    expect(screen.getByText('Dana Defender')).toBeInTheDocument();
    expect(screen.getByText('Avi Attack')).toBeInTheDocument();
    expect(screen.getByText('Maya Midfield')).toBeInTheDocument();
  });
});
