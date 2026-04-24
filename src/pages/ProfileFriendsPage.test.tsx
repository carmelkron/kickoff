import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProfileFriendsPage from './ProfileFriendsPage';

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

function renderPage(initialEntry = '/profile/user-1/friends') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/profile/:id/friends" element={<ProfileFriendsPage />} />
        <Route path="/profile/:id" element={<div>Profile Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProfileFriendsPage', () => {
  beforeEach(() => {
    currentUser = null;
    allUsers = [];
  });

  it('shows the full friends list and filters it by search', async () => {
    currentUser = makeUser('user-1', { friends: ['user-2', 'user-3'] });
    allUsers = [
      currentUser,
      makeUser('user-2', { name: 'Alpha Friend', position: 'Midfield' }),
      makeUser('user-3', { name: 'Bravo Friend', position: 'Defense' }),
    ];

    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('My friends')).toBeInTheDocument();
    expect(screen.getByText('Alpha Friend')).toBeInTheDocument();
    expect(screen.getByText('Bravo Friend')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search friends'), 'bravo');
    expect(screen.queryByText('Alpha Friend')).not.toBeInTheDocument();
    expect(screen.getByText('Bravo Friend')).toBeInTheDocument();
  });
});
