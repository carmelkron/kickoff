import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProfileLive from './ProfileLive';

const fetchCompetitivePointHistoryMock = vi.fn();
const fetchProfileLobbyHistoryMock = vi.fn();
const toggleProfileSkillEndorsementMock = vi.fn();
const sendFriendRequestMock = vi.fn();
const acceptFriendRequestMock = vi.fn();
const declineFriendRequestMock = vi.fn();
const removeFriendMock = vi.fn();
const refreshCurrentUserMock = vi.fn();

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
    sendFriendRequest: (...args: unknown[]) => sendFriendRequestMock(...args),
    acceptFriendRequest: (...args: unknown[]) => acceptFriendRequestMock(...args),
    declineFriendRequest: (...args: unknown[]) => declineFriendRequestMock(...args),
    removeFriend: (...args: unknown[]) => removeFriendMock(...args),
    refreshCurrentUser: (...args: unknown[]) => refreshCurrentUserMock(...args),
  }),
}));

vi.mock('../lib/appData', () => ({
  fetchCompetitivePointHistory: (...args: unknown[]) => fetchCompetitivePointHistoryMock(...args),
  fetchProfileLobbyHistory: (...args: unknown[]) => fetchProfileLobbyHistoryMock(...args),
  toggleProfileSkillEndorsement: (...args: unknown[]) => toggleProfileSkillEndorsementMock(...args),
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

function renderProfile(initialEntry = '/profile/user-1') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/profile/:id" element={<ProfileLive />} />
        <Route path="/profile/:id/edit" element={<div>Edit Profile Page</div>} />
        <Route path="/lobby/:id" element={<div>Lobby Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProfileLive', () => {
  beforeEach(() => {
    currentUser = null;
    allUsers = [];
    fetchCompetitivePointHistoryMock.mockReset().mockResolvedValue([]);
    fetchProfileLobbyHistoryMock.mockReset().mockResolvedValue([]);
    toggleProfileSkillEndorsementMock.mockReset().mockResolvedValue(undefined);
    sendFriendRequestMock.mockReset().mockResolvedValue(undefined);
    acceptFriendRequestMock.mockReset().mockResolvedValue(undefined);
    declineFriendRequestMock.mockReset().mockResolvedValue(undefined);
    removeFriendMock.mockReset().mockResolvedValue(undefined);
    refreshCurrentUserMock.mockReset().mockResolvedValue(undefined);
  });

  it('shows loading and not-found states', async () => {
    renderProfile('/profile/missing-user');
    expect(screen.getByText('Loading profile...')).toBeInTheDocument();

    cleanup();
    allUsers = [makeUser('other-user')];
    renderProfile('/profile/missing-user');

    expect(screen.getByText('User not found')).toBeInTheDocument();
  });

  it('shows my profile actions, a compact friends preview, and edit navigation', async () => {
    currentUser = makeUser('user-1', {
      name: 'Viewer User',
      pendingRequests: ['user-2'],
      friends: ['user-3'],
    });
    allUsers = [
      currentUser,
      makeUser('user-2', { name: 'Pending Friend' }),
      makeUser('user-3', { name: 'Best Friend', position: 'Attack', competitivePoints: 31 }),
    ];

    const user = userEvent.setup();
    renderProfile('/profile/user-1');

    expect(await screen.findByRole('heading', { name: 'Friends' })).toBeInTheDocument();
    expect(screen.getByText('Best Friend')).toBeInTheDocument();
    expect(screen.getByText('My Profile')).toBeInTheDocument();
    expect(screen.queryByText('Friend Requests (1)')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    expect(await screen.findByText('Edit Profile Page')).toBeInTheDocument();
  });

  it('handles other-player friendship actions and skill endorsements', async () => {
    currentUser = makeUser('viewer-1', {
      name: 'Viewer User',
      pendingRequests: ['user-1'],
    });
    allUsers = [
      currentUser,
      makeUser('user-1', {
        name: 'Target Player',
        photoUrl: 'https://example.com/avatar.png',
        skills: [
          {
            id: 'skill-1',
            label: 'Finishing',
            endorsementCount: 4,
            viewerHasEndorsed: false,
          },
        ],
      }),
    ];

    const user = userEvent.setup();
    renderProfile('/profile/user-1');

    expect(await screen.findByText('Accept')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => {
      expect(acceptFriendRequestMock).toHaveBeenCalledWith('user-1');
    });

    await user.click(screen.getByRole('button', { name: /finishing/i }));
    await waitFor(() => {
      expect(toggleProfileSkillEndorsementMock).toHaveBeenCalledWith('skill-1', 'viewer-1', false);
      expect(refreshCurrentUserMock).toHaveBeenCalled();
    });

    await user.click(screen.getByAltText('Target Player'));
    expect(screen.getAllByAltText('Target Player')).toHaveLength(2);
  });

  it('shows sent and friend states and supports sending or removing friends', async () => {
    currentUser = makeUser('viewer-1', {
      name: 'Viewer User',
      sentRequests: ['user-1'],
      friends: ['user-2'],
    });
    allUsers = [
      currentUser,
      makeUser('user-1', { name: 'Requested Player' }),
      makeUser('user-2', { name: 'Current Friend' }),
      makeUser('user-3', { name: 'New Player' }),
    ];

    const user = userEvent.setup();
    renderProfile('/profile/user-1');
    expect(await screen.findByText('Request sent')).toBeInTheDocument();

    cleanup();
    renderProfile('/profile/user-2');
    await user.click(screen.getByRole('button', { name: 'Friends ✓' }));
    await waitFor(() => {
      expect(removeFriendMock).toHaveBeenCalledWith('user-2');
    });

    cleanup();
    renderProfile('/profile/user-3');
    await user.click(screen.getByRole('button', { name: 'Send Friend Request' }));
    await waitFor(() => {
      expect(sendFriendRequestMock).toHaveBeenCalledWith('user-3');
    });
  });

  it('renders competitive and lobby history in one linear page', async () => {
    currentUser = makeUser('viewer-1', { name: 'Viewer User' });
    allUsers = [
      currentUser,
      makeUser('user-1', {
        name: 'History Player',
        competitivePoints: 40,
        competitiveGamesPlayed: 5,
        skills: [],
      }),
    ];
    fetchCompetitivePointHistoryMock.mockResolvedValue([
      {
        id: 'history-1',
        lobbyId: 'lobby-1',
        lobbyTitle: 'Ranked Night',
        lobbyDate: '2026-04-20T18:00:00.000Z',
        city: 'Tel Aviv',
        teamColor: 'blue',
        teamNumber: 1,
        wins: 2,
        rank: 1,
        maxRank: 2,
        points: 8,
        createdAt: '2026-04-20T20:00:00.000Z',
        notes: 'Strong finish',
      },
    ]);
    fetchProfileLobbyHistoryMock.mockResolvedValue([
      {
        lobbyId: 'lobby-2',
        lobbyTitle: 'Friendly Match',
        date: '2026-04-18T18:00:00.000Z',
        city: 'Haifa',
        ratingChange: 0,
      },
    ]);

    renderProfile('/profile/user-1');

    expect(await screen.findByText('Competitive points history')).toBeInTheDocument();
    expect(screen.getByText('Ranked Night')).toBeInTheDocument();
    expect(screen.getByText(/Organizer note:/)).toBeInTheDocument();
    expect(screen.getByText('Recent Games')).toBeInTheDocument();
    expect(screen.getByText('Friendly Match')).toBeInTheDocument();
  });
});
