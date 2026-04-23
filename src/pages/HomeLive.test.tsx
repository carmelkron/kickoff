import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HomeLive from './HomeLive';

const fetchLobbiesMock = vi.fn();
const requestLobbyAccessMock = vi.fn();
const upsertLobbyMembershipMock = vi.fn();

let currentUser: { id: string } | null = null;

vi.mock('../lib/appData', () => ({
  fetchLobbies: (...args: unknown[]) => fetchLobbiesMock(...args),
  requestLobbyAccess: (...args: unknown[]) => requestLobbyAccessMock(...args),
  upsertLobbyMembership: (...args: unknown[]) => upsertLobbyMembershipMock(...args),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
    t: {},
  }),
}));

vi.mock('../contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({
    currentUser,
  }),
}));

function makePlayer(id: string, name = `Player ${id}`) {
  return {
    id,
    name,
    initials: 'PL',
    avatarColor: 'bg-blue-500',
    rating: 5,
    gamesPlayed: 12,
    ratingHistory: [],
    lobbyHistory: [],
  };
}

function makeLobby(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lobby-1',
    title: 'Sunset 6v6',
    address: '123 Gordon St',
    city: 'Tel Aviv',
    datetime: '2099-06-01T18:00:00.000Z',
    players: [makePlayer('player-1')],
    maxPlayers: 12,
    numTeams: 2,
    playersPerTeam: 6,
    isPrivate: false,
    createdBy: 'organizer-1',
    organizerIds: [],
    distanceKm: 3,
    waitlist: [],
    gameType: 'friendly',
    accessType: 'open',
    status: 'active',
    viewerHasAccess: true,
    viewerIsInvited: false,
    viewerHasFriendInside: false,
    ...overrides,
  };
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomeLive />} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/lobby/:id" element={<div>Lobby Details</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HomeLive', () => {
  beforeEach(() => {
    currentUser = { id: 'viewer-1' };
    fetchLobbiesMock.mockReset();
    requestLobbyAccessMock.mockReset().mockResolvedValue(undefined);
    upsertLobbyMembershipMock.mockReset().mockResolvedValue(undefined);
  });

  it('renders the tall lobby feed and opens the lobby details page', async () => {
    fetchLobbiesMock.mockResolvedValue([makeLobby()]);
    const user = userEvent.setup();
    renderHome();

    expect(await screen.findByText('Sunset 6v6')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Open lobby/i }));
    expect(await screen.findByText('Lobby Details')).toBeInTheDocument();
  });

  it('joins an open lobby directly from the feed card', async () => {
    fetchLobbiesMock
      .mockResolvedValueOnce([makeLobby()])
      .mockResolvedValueOnce([makeLobby({ players: [makePlayer('viewer-1', 'Viewer User')] })]);

    const user = userEvent.setup();
    renderHome();

    await screen.findByText('Sunset 6v6');
    await user.click(screen.getByRole('button', { name: /Join lobby/i }));

    await waitFor(() => {
      expect(upsertLobbyMembershipMock).toHaveBeenCalledWith('lobby-1', 'viewer-1', 'joined');
    });
  });

  it('requests access for a locked lobby from the feed card', async () => {
    fetchLobbiesMock
      .mockResolvedValueOnce([makeLobby({
        id: 'locked-lobby',
        title: 'Invite-only Match',
        accessType: 'locked',
        viewerHasAccess: false,
      })])
      .mockResolvedValueOnce([makeLobby({
        id: 'locked-lobby',
        title: 'Invite-only Match',
        accessType: 'locked',
        viewerHasAccess: false,
        viewerJoinRequestStatus: 'pending',
      })]);

    const user = userEvent.setup();
    renderHome();

    await screen.findByText('Invite-only Match');
    await user.click(screen.getByRole('button', { name: /Request access/i }));

    await waitFor(() => {
      expect(requestLobbyAccessMock).toHaveBeenCalledWith('locked-lobby', 'viewer-1');
    });
  });
});
