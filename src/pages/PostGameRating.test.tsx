import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PostGameRating from './PostGameRating';

const fetchLobbyByIdMock = vi.fn();
const hasAlreadyRatedMock = vi.fn();
const submitLobbyRatingsMock = vi.fn();

let currentUser: { id: string; name: string } | null = null;

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
  }),
}));

vi.mock('../lib/appData', () => ({
  fetchLobbyById: (...args: unknown[]) => fetchLobbyByIdMock(...args),
  hasAlreadyRated: (...args: unknown[]) => hasAlreadyRatedMock(...args),
  submitLobbyRatings: (...args: unknown[]) => submitLobbyRatingsMock(...args),
}));

function makePlayer(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Player ${id}`,
    initials: 'PL',
    avatarColor: 'bg-blue-500',
    rating: 5,
    gamesPlayed: 10,
    ratingHistory: [],
    lobbyHistory: [],
    ...overrides,
  };
}

function makeLobby(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lobby-1',
    title: 'Evening Match',
    address: '123 Test St',
    city: 'Tel Aviv',
    datetime: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    players: [
      makePlayer('viewer-1', { name: 'Viewer User' }),
      makePlayer('player-2', { name: 'Alex Mid' }),
      makePlayer('player-3', { name: 'Sam Wing', photoUrl: 'https://example.com/sam.png' }),
    ],
    maxPlayers: 10,
    numTeams: 2,
    playersPerTeam: 5,
    minRating: 4,
    isPrivate: false,
    createdBy: 'viewer-1',
    organizerIds: [],
    distanceKm: 1,
    waitlist: [],
    gameType: 'competitive',
    accessType: 'open',
    genderRestriction: 'none',
    status: 'active',
    viewerHasAccess: true,
    viewerIsInvited: false,
    viewerHasFriendInside: false,
    ...overrides,
  };
}

function renderPostGameRating(initialEntry = '/rate/lobby-1') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/rate/:id" element={<PostGameRating />} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/lobby/:id" element={<div>Lobby Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PostGameRating', () => {
  beforeEach(() => {
    currentUser = { id: 'viewer-1', name: 'Viewer User' };
    fetchLobbyByIdMock.mockReset().mockResolvedValue(makeLobby());
    hasAlreadyRatedMock.mockReset().mockResolvedValue(false);
    submitLobbyRatingsMock.mockReset().mockResolvedValue(undefined);
  });

  it('redirects logged-out users to login', () => {
    currentUser = null;

    renderPostGameRating();

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects to the lobby when the match is not eligible for rating', async () => {
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      gameType: 'friendly',
    }));

    renderPostGameRating();

    expect(await screen.findByText('Lobby Page')).toBeInTheDocument();
  });

  it('shows the thank-you state when the player already rated the match', async () => {
    hasAlreadyRatedMock.mockResolvedValue(true);

    renderPostGameRating();

    expect(await screen.findByText('Thanks for rating!')).toBeInTheDocument();
    expect(screen.getByText('Your ratings were submitted anonymously')).toBeInTheDocument();
  });

  it('submits player ratings, field rating, and game level for eligible matches', async () => {
    const user = userEvent.setup();
    const { container } = renderPostGameRating();

    await screen.findByText('Rate the game');

    const sliders = container.querySelectorAll('input[type="range"]');
    fireEvent.change(sliders[0], { target: { value: '7.5' } });
    fireEvent.change(sliders[1], { target: { value: '8.5' } });

    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    await user.click(screen.getByRole('button', { name: 'Submit rating' }));

    await waitFor(() => {
      expect(submitLobbyRatingsMock).toHaveBeenCalledWith({
        lobbyId: 'lobby-1',
        raterProfileId: 'viewer-1',
        playerRatings: [
          {
            ratedProfileId: 'player-2',
            rating: 7.5,
          },
          {
            ratedProfileId: 'player-3',
            rating: 8.5,
          },
        ],
        fieldRating: 3,
        gameLevel: 'advanced',
      });
    });

    expect(await screen.findByText('Thanks for rating!')).toBeInTheDocument();
  });

  it('shows submission errors and keeps the form usable', async () => {
    const user = userEvent.setup();
    submitLobbyRatingsMock.mockRejectedValue(new Error('Failed to submit ratings'));

    renderPostGameRating();

    await screen.findByText('Rate the game');
    await user.click(screen.getByRole('button', { name: 'Submit rating' }));

    expect(await screen.findByText('Failed to submit ratings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit rating' })).toBeEnabled();
  });
});
