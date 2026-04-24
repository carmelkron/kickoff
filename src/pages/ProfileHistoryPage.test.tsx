import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProfileHistoryPage from './ProfileHistoryPage';

const fetchProfileLobbyHistoryMock = vi.fn();

let currentUser: any = null;
let allUsers: any[] = [];

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
    t: {},
    toggleLanguage: vi.fn(),
    isRTL: false,
  }),
}));

vi.mock('../contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({
    currentUser,
    getAllUsers: () => allUsers,
  }),
}));

vi.mock('../lib/appData', () => ({
  fetchProfileLobbyHistory: (...args: unknown[]) => fetchProfileLobbyHistoryMock(...args),
}));

function makeUser(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Player ${id}`,
    initials: 'PL',
    avatarColor: 'bg-blue-500',
    rating: 5,
    gamesPlayed: 10,
    ratingHistory: [],
    lobbyHistory: [],
    friends: [],
    sentRequests: [],
    pendingRequests: [],
    competitivePoints: 24,
    competitiveGamesPlayed: 4,
    competitivePointsPerGame: 6,
    skills: [],
    ...overrides,
  };
}

function renderPage(initialEntry = '/profile/user-1/history') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/profile/:id/history" element={<ProfileHistoryPage />} />
        <Route path="/profile/:id" element={<div>Profile Page</div>} />
        <Route path="/lobby/:id" element={<div>Lobby Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProfileHistoryPage', () => {
  beforeEach(() => {
    currentUser = null;
    allUsers = [];
    fetchProfileLobbyHistoryMock.mockReset().mockResolvedValue([]);
  });

  it('shows a single lobby history list with filters and pagination', async () => {
    currentUser = makeUser('user-1');
    allUsers = [currentUser];
    fetchProfileLobbyHistoryMock.mockResolvedValue([
      {
        lobbyId: 'lobby-1',
        lobbyTitle: 'Ranked Night',
        date: '2026-04-20T18:00:00.000Z',
        city: 'Tel Aviv',
        gameType: 'competitive',
        ratingChange: 0,
      },
      {
        lobbyId: 'lobby-2',
        lobbyTitle: 'Friendly Match',
        date: '2026-04-18T18:00:00.000Z',
        city: 'Haifa',
        gameType: 'friendly',
        ratingChange: 0,
      },
    ]);

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Lobby history')).toBeInTheDocument();
    expect(screen.getByText('Ranked Night')).toBeInTheDocument();
    expect(screen.getByText('Friendly Match')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Competitive' }));
    await waitFor(() => {
      expect(screen.getByText('Ranked Night')).toBeInTheDocument();
      expect(screen.queryByText('Friendly Match')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Friendly' }));
    await waitFor(() => {
      expect(screen.getByText('Friendly Match')).toBeInTheDocument();
      expect(screen.queryByText('Ranked Night')).not.toBeInTheDocument();
    });
  });
});
