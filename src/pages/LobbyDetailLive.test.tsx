import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { translations } from '../i18n/translations';
import LobbyDetailLive from './LobbyDetailLive';

const fetchLobbyByIdMock = vi.fn();
const fetchContributionsMock = vi.fn();
const fetchLobbyTeamsMock = vi.fn();
const fetchLobbyResultMock = vi.fn();
const fetchLobbyInvitesMock = vi.fn();
const fetchLobbyJoinRequestsMock = vi.fn();
const fetchLobbyShareTokenMock = vi.fn();
const approveLobbyJoinRequestMock = vi.fn();
const createLobbyInviteMock = vi.fn();
const deleteLobbyMembershipMock = vi.fn();
const declineLobbyJoinRequestMock = vi.fn();
const passLobbyWaitlistSpotMock = vi.fn();
const requestLobbyAccessMock = vi.fn();
const submitCompetitiveLobbyResultMock = vi.fn();
const upsertLobbyMembershipMock = vi.fn();
let canManageLobbyValue = false;
let canSubmitLobbyResultValue = false;

let currentUser: {
  id: string;
  name: string;
  friends: string[];
  homeLatitude?: number;
  homeLongitude?: number;
} | null = null;
let allUsers: Array<{
  id: string;
  name: string;
  friends: string[];
  initials: string;
  avatarColor: string;
  rating: number;
  gamesPlayed: number;
  ratingHistory: unknown[];
  lobbyHistory: unknown[];
  sentRequests: string[];
  pendingRequests: string[];
  position?: string;
  photoUrl?: string;
  competitivePoints?: number;
}> = [];

vi.mock('../lib/appData', () => ({
  approveLobbyJoinRequest: (...args: unknown[]) => approveLobbyJoinRequestMock(...args),
  assignLobbyOrganizer: vi.fn(),
  createLobbyInvite: (...args: unknown[]) => createLobbyInviteMock(...args),
  declineLobbyJoinRequest: (...args: unknown[]) => declineLobbyJoinRequestMock(...args),
  deleteLobby: vi.fn(),
  deleteLobbyMembership: (...args: unknown[]) => deleteLobbyMembershipMock(...args),
  fetchContributions: (...args: unknown[]) => fetchContributionsMock(...args),
  fetchLobbyById: (...args: unknown[]) => fetchLobbyByIdMock(...args),
  fetchLobbyInvites: (...args: unknown[]) => fetchLobbyInvitesMock(...args),
  fetchLobbyJoinRequests: (...args: unknown[]) => fetchLobbyJoinRequestsMock(...args),
  fetchLobbyResult: (...args: unknown[]) => fetchLobbyResultMock(...args),
  fetchLobbyShareToken: (...args: unknown[]) => fetchLobbyShareTokenMock(...args),
  fetchLobbyTeams: (...args: unknown[]) => fetchLobbyTeamsMock(...args),
  generateLobbyTeams: vi.fn(),
  passLobbyWaitlistSpot: (...args: unknown[]) => passLobbyWaitlistSpotMock(...args),
  removeLobbyOrganizer: vi.fn(),
  requestLobbyAccess: (...args: unknown[]) => requestLobbyAccessMock(...args),
  submitCompetitiveLobbyResult: (...args: unknown[]) => submitCompetitiveLobbyResultMock(...args),
  swapLobbyTeamPlayers: vi.fn(),
  toggleContribution: vi.fn(),
  upsertLobbyMembership: (...args: unknown[]) => upsertLobbyMembershipMock(...args),
}));

vi.mock('../contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({
    currentUser,
    getAllUsers: () => allUsers,
  }),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
    t: translations.en,
    toggleLanguage: vi.fn(),
    isRTL: false,
  }),
}));

vi.mock('../lib/lobbyRoles', () => ({
  canManageLobby: () => canManageLobbyValue,
}));

vi.mock('../lib/lobbyResultReminders', () => ({
  canSubmitLobbyResult: () => canSubmitLobbyResultValue,
  getLobbyResultReminderTime: () => new Date('2099-06-01T20:00:00.000Z'),
}));

vi.mock('../lib/validation', () => ({
  getJoinLobbyError: () => null,
  getJoinLobbyTargetStatus: (lobby: { players: unknown[]; maxPlayers: number }) => (
    lobby.players.length >= lobby.maxPlayers ? 'waitlisted' : 'joined'
  ),
}));

vi.mock('../components/LocationPreviewMap', () => ({
  __esModule: true,
  default: () => <div data-testid="location-preview-map">Map</div>,
}));

vi.mock('../components/LobbyChat', () => ({
  __esModule: true,
  default: ({ canViewChat, canSendChat }: { canViewChat: boolean; canSendChat: boolean }) => (
    <div
      data-testid="lobby-chat"
      data-can-send-chat={canSendChat ? 'true' : 'false'}
      data-can-view-chat={canViewChat ? 'true' : 'false'}
    >
      {canViewChat ? 'Chat visible' : 'Chat hidden'}
    </div>
  ),
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
    friends: [],
    sentRequests: [],
    pendingRequests: [],
    ...overrides,
  };
}

function makeLobby(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lobby-1',
    title: 'Evening Match',
    address: '123 Gordon St',
    city: 'Tel Aviv',
    datetime: '2099-06-01T18:00:00.000Z',
    players: [makePlayer('player-1')],
    maxPlayers: 10,
    numTeams: 2,
    playersPerTeam: 5,
    minRating: 4,
    minPointsPerGame: null,
    isPrivate: false,
    price: null,
    description: 'Friendly match',
    createdBy: 'organizer-1',
    organizerIds: [],
    distanceKm: 3,
    waitlist: [],
    pendingWaitlistIds: [],
    passedWaitlistIds: [],
    gameType: 'friendly',
    accessType: 'open',
    status: 'active',
    viewerHasAccess: true,
    viewerIsInvited: false,
    viewerHasFriendInside: false,
    viewerJoinRequestStatus: null,
    latitude: null,
    longitude: null,
    fieldType: null,
    ...overrides,
  };
}

function makeCurrentUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'viewer-1',
    name: 'Viewer User',
    friends: [],
    ...overrides,
  };
}

function renderLobbyDetail(initialEntry = '/lobby/lobby-1') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/lobby/:id" element={<LobbyDetailLive />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LobbyDetailLive join flows', () => {
  beforeEach(() => {
    currentUser = makeCurrentUser();
    fetchLobbyByIdMock.mockReset();
    fetchContributionsMock.mockResolvedValue([]);
    fetchLobbyTeamsMock.mockResolvedValue([]);
    fetchLobbyResultMock.mockResolvedValue(null);
    fetchLobbyInvitesMock.mockResolvedValue([]);
    fetchLobbyJoinRequestsMock.mockResolvedValue([]);
    fetchLobbyShareTokenMock.mockResolvedValue(null);
    approveLobbyJoinRequestMock.mockReset().mockResolvedValue(undefined);
    createLobbyInviteMock.mockReset().mockResolvedValue(undefined);
    deleteLobbyMembershipMock.mockReset().mockResolvedValue(undefined);
    declineLobbyJoinRequestMock.mockReset().mockResolvedValue(undefined);
    passLobbyWaitlistSpotMock.mockReset().mockResolvedValue(undefined);
    requestLobbyAccessMock.mockReset().mockResolvedValue(undefined);
    submitCompetitiveLobbyResultMock.mockReset().mockResolvedValue(null);
    upsertLobbyMembershipMock.mockReset().mockResolvedValue(undefined);
    canManageLobbyValue = false;
    canSubmitLobbyResultValue = false;
    allUsers = [];
    window.sessionStorage.clear();
  });

  it('sends logged-out users to login when they try to join', async () => {
    currentUser = null;
    fetchLobbyByIdMock.mockResolvedValue(makeLobby());

    const user = userEvent.setup();
    renderLobbyDetail();

    await screen.findByText('Evening Match');
    await user.click(screen.getByRole('button', { name: 'Join Game' }));

    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  it('requests access instead of joining when the lobby is locked and hidden', async () => {
    currentUser = makeCurrentUser();
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      accessType: 'locked',
      viewerHasAccess: false,
      viewerJoinRequestStatus: null,
    }));

    const user = userEvent.setup();
    renderLobbyDetail();

    await screen.findByText('Evening Match');
    await user.click(screen.getByRole('button', { name: 'Request lobby access' }));

    await waitFor(() => {
      expect(requestLobbyAccessMock).toHaveBeenCalledWith('lobby-1', 'viewer-1');
    });
  });

  it('shows a disabled pending access button after a request was already sent', async () => {
    currentUser = makeCurrentUser();
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      accessType: 'locked',
      viewerHasAccess: false,
      viewerJoinRequestStatus: 'pending',
    }));

    renderLobbyDetail();

    const button = await screen.findByRole('button', { name: 'Access request sent' });
    expect(button).toBeDisabled();
    expect(screen.getByText('You already sent an access request. Waiting for organizer approval.')).toBeInTheDocument();
    expect(requestLobbyAccessMock).not.toHaveBeenCalled();
  });

  it('shows a disabled declined access button after organizer rejection', async () => {
    currentUser = makeCurrentUser();
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      accessType: 'locked',
      viewerHasAccess: false,
      viewerJoinRequestStatus: 'declined',
    }));

    renderLobbyDetail();

    expect(await screen.findByRole('button', { name: 'Access request declined' })).toBeDisabled();
    expect(requestLobbyAccessMock).not.toHaveBeenCalled();
  });

  it('joins the waitlist when the lobby is already full', async () => {
    currentUser = makeCurrentUser();
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      maxPlayers: 2,
      players: [makePlayer('player-1'), makePlayer('player-2')],
    }));

    const user = userEvent.setup();
    renderLobbyDetail();

    await screen.findByText('Evening Match');
    await user.click(screen.getByRole('button', { name: '+ Join Waitlist' }));

    await waitFor(() => {
      expect(upsertLobbyMembershipMock).toHaveBeenCalledWith(
        'lobby-1',
        'viewer-1',
        'waitlisted',
        { shareToken: null },
      );
    });
  });

  it('lets a pending waitlist player confirm the opened spot', async () => {
    currentUser = makeCurrentUser();
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      waitlist: [makePlayer('viewer-1')],
      pendingWaitlistIds: ['viewer-1'],
    }));

    const user = userEvent.setup();
    renderLobbyDetail();

    await screen.findByText('A spot opened for you!');
    await user.click(screen.getByRole('button', { name: 'Join' }));

    await waitFor(() => {
      expect(upsertLobbyMembershipMock).toHaveBeenCalledWith('lobby-1', 'viewer-1', 'joined');
    });
  });

  it('lets a pending waitlist player pass the spot to the next player', async () => {
    currentUser = makeCurrentUser();
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      waitlist: [makePlayer('viewer-1')],
      pendingWaitlistIds: ['viewer-1'],
    }));

    const user = userEvent.setup();
    renderLobbyDetail();

    await screen.findByText('A spot opened for you!');
    await user.click(screen.getByRole('button', { name: 'Pass to next' }));

    await waitFor(() => {
      expect(passLobbyWaitlistSpotMock).toHaveBeenCalledWith('lobby-1', 'viewer-1');
    });
  });

  it('lets a waitlisted player remove themselves from the queue', async () => {
    currentUser = makeCurrentUser();
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      waitlist: [makePlayer('viewer-1')],
    }));

    const user = userEvent.setup();
    renderLobbyDetail();

    await screen.findByText('You are #1 on the waitlist');
    await user.click(screen.getByRole('button', { name: 'Remove me from waitlist' }));

    await waitFor(() => {
      expect(deleteLobbyMembershipMock).toHaveBeenCalledWith('lobby-1', 'viewer-1');
    });
  });

  it('only enables lobby chat for players who are inside the lobby flow', async () => {
    currentUser = makeCurrentUser();
    fetchLobbyByIdMock.mockResolvedValue(makeLobby());
    const user = userEvent.setup();

    renderLobbyDetail();

    await user.click(await screen.findByRole('button', { name: 'Chat' }));
    const hiddenChat = await screen.findByTestId('lobby-chat');
    expect(hiddenChat).toHaveAttribute('data-can-view-chat', 'false');
    expect(hiddenChat).toHaveTextContent('Chat hidden');

    cleanup();
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      players: [makePlayer('player-1'), makePlayer('viewer-1')],
    }));

    renderLobbyDetail();
    await user.click(await screen.findByRole('button', { name: 'Chat' }));

    await waitFor(() => {
      expect(screen.getByTestId('lobby-chat')).toHaveAttribute('data-can-view-chat', 'true');
    });
    expect(screen.getByTestId('lobby-chat')).toHaveAttribute('data-can-send-chat', 'true');
    expect(screen.getByTestId('lobby-chat')).toHaveTextContent('Chat visible');
  });

  it('opens the result modal for competitive organizers when reporting becomes available', async () => {
    currentUser = makeCurrentUser({ id: 'organizer-1' });
    canManageLobbyValue = true;
    canSubmitLobbyResultValue = true;
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      createdBy: 'organizer-1',
      gameType: 'competitive',
      players: [
        makePlayer('player-1', { competitivePoints: 10 }),
        makePlayer('player-2', { competitivePoints: 9 }),
      ],
    }));
    fetchLobbyTeamsMock.mockResolvedValue([
      {
        team: { id: 'team-1', color: 'blue', teamNumber: 1 },
        players: [makePlayer('player-1', { competitivePoints: 10 })],
      },
      {
        team: { id: 'team-2', color: 'red', teamNumber: 2 },
        players: [makePlayer('player-2', { competitivePoints: 9 })],
      },
    ]);

    renderLobbyDetail();

    expect(await screen.findByText('Report lobby results')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save result and award points' })).toBeInTheDocument();
  });

  it('lets locked-lobby creators invite eligible friends', async () => {
    currentUser = makeCurrentUser({
      id: 'organizer-1',
      friends: ['friend-1', 'friend-2'],
    });
    canManageLobbyValue = true;
    allUsers = [
      makePlayer('friend-1', { name: 'Friend One', position: 'Attack' }),
      makePlayer('friend-2', { name: 'Friend Two', position: 'Defense' }),
    ];
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      createdBy: 'organizer-1',
      accessType: 'locked',
      players: [makePlayer('player-1')],
      waitlist: [makePlayer('friend-2')],
    }));
    fetchLobbyInvitesMock.mockResolvedValue([]);

    const user = userEvent.setup();
    renderLobbyDetail();

    await user.click(await screen.findByRole('button', { name: 'Manage' }));
    await screen.findByText('Invite friends to this lobby');
    await user.click(screen.getByRole('button', { name: 'Invite' }));

    await waitFor(() => {
      expect(createLobbyInviteMock).toHaveBeenCalledWith('lobby-1', 'organizer-1', 'friend-1');
    });
  });

  it('lets organizers approve pending access requests', async () => {
    currentUser = makeCurrentUser({ id: 'organizer-1' });
    canManageLobbyValue = true;
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      createdBy: 'organizer-1',
      accessType: 'locked',
    }));
    fetchLobbyJoinRequestsMock.mockResolvedValue([
      {
        id: 'request-1',
        lobbyId: 'lobby-1',
        requesterProfileId: 'requester-1',
        status: 'pending',
        createdAt: '2026-04-23T10:00:00.000Z',
        requester: makePlayer('requester-1', { name: 'Requester One' }),
      },
    ]);

    const user = userEvent.setup();
    renderLobbyDetail();

    await user.click(await screen.findByRole('button', { name: 'Manage' }));
    await screen.findByText('Lobby access requests');
    await user.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(approveLobbyJoinRequestMock).toHaveBeenCalledWith('lobby-1', 'requester-1', 'organizer-1');
    });
  });

  it('lets organizers decline pending access requests', async () => {
    currentUser = makeCurrentUser({ id: 'organizer-1' });
    canManageLobbyValue = true;
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      createdBy: 'organizer-1',
      accessType: 'locked',
    }));
    fetchLobbyJoinRequestsMock.mockResolvedValue([
      {
        id: 'request-1',
        lobbyId: 'lobby-1',
        requesterProfileId: 'requester-1',
        status: 'pending',
        createdAt: '2026-04-23T10:00:00.000Z',
        requester: makePlayer('requester-1', { name: 'Requester One' }),
      },
    ]);

    const user = userEvent.setup();
    renderLobbyDetail();

    await user.click(await screen.findByRole('button', { name: 'Manage' }));
    await screen.findByText('Lobby access requests');
    await user.click(screen.getByRole('button', { name: 'Decline' }));

    await waitFor(() => {
      expect(declineLobbyJoinRequestMock).toHaveBeenCalledWith('lobby-1', 'requester-1', 'organizer-1');
    });
  });

  it('submits competitive results for organizers and refreshes the saved result', async () => {
    const savedResult = {
      lobbyId: 'lobby-1',
      submittedByProfileId: 'organizer-1',
      submittedByProfileName: 'Organizer User',
      submittedAt: '2099-06-01T21:05:00.000Z',
      notes: 'Close one.',
      teamResults: [
        {
          lobbyId: 'lobby-1',
          lobbyTeamId: 'team-1',
          teamColor: 'blue',
          teamNumber: 1,
          wins: 1,
          rank: 1,
          awardedPoints: 3,
        },
        {
          lobbyId: 'lobby-1',
          lobbyTeamId: 'team-2',
          teamColor: 'red',
          teamNumber: 2,
          wins: 0,
          rank: 2,
          awardedPoints: -1,
        },
      ],
    };
    currentUser = makeCurrentUser({ id: 'organizer-1' });
    canManageLobbyValue = true;
    canSubmitLobbyResultValue = true;
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      createdBy: 'organizer-1',
      gameType: 'competitive',
      players: [
        makePlayer('player-1', { competitivePoints: 10 }),
        makePlayer('player-2', { competitivePoints: 9 }),
      ],
    }));
    fetchLobbyTeamsMock.mockResolvedValue([
      {
        team: { id: 'team-1', color: 'blue', teamNumber: 1 },
        players: [makePlayer('player-1', { competitivePoints: 10 })],
      },
      {
        team: { id: 'team-2', color: 'red', teamNumber: 2 },
        players: [makePlayer('player-2', { competitivePoints: 9 })],
      },
    ]);
    fetchLobbyResultMock
      .mockResolvedValueOnce(null)
      .mockResolvedValue(savedResult);
    submitCompetitiveLobbyResultMock.mockResolvedValue(savedResult);

    const user = userEvent.setup();
    renderLobbyDetail();

    await screen.findByText('Report lobby results');
    await user.click(screen.getAllByRole('button', { name: 'Increase wins' })[0]);
    await user.click(screen.getByRole('button', { name: 'Save result and award points' }));

    await waitFor(() => {
      expect(submitCompetitiveLobbyResultMock).toHaveBeenCalledWith(
        'lobby-1',
        'organizer-1',
        { 'team-1': 1, 'team-2': 0 },
        undefined,
      );
    });
    await user.click(screen.getByRole('button', { name: 'Manage' }));
    expect(await screen.findByText('The result was saved and points were already awarded.')).toBeInTheDocument();
  });

  it('lets organizers close the result modal and reopen it from the summary card', async () => {
    currentUser = makeCurrentUser({ id: 'organizer-1' });
    canManageLobbyValue = true;
    canSubmitLobbyResultValue = true;
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      createdBy: 'organizer-1',
      gameType: 'competitive',
      players: [
        makePlayer('player-1', { competitivePoints: 10 }),
        makePlayer('player-2', { competitivePoints: 9 }),
      ],
    }));
    fetchLobbyTeamsMock.mockResolvedValue([
      {
        team: { id: 'team-1', color: 'blue', teamNumber: 1 },
        players: [makePlayer('player-1', { competitivePoints: 10 })],
      },
      {
        team: { id: 'team-2', color: 'red', teamNumber: 2 },
        players: [makePlayer('player-2', { competitivePoints: 9 })],
      },
    ]);

    const user = userEvent.setup();
    renderLobbyDetail();

    expect(await screen.findByText('Report lobby results')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByText('Report lobby results')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Manage' }));
    const reopenButton = screen.getByRole('button', { name: 'Submit result' });
    expect(reopenButton).toBeEnabled();

    await user.click(reopenButton);

    expect(await screen.findByText('Report lobby results')).toBeInTheDocument();
  });

  it('trims organizer notes before submitting the result', async () => {
    const longNote = `${'  Tight rotations and strong defense. '.repeat(30)}   `;
    const trimmedNote = longNote.slice(0, 500).trim().slice(0, 500);
    const savedResult = {
      lobbyId: 'lobby-1',
      submittedByProfileId: 'organizer-1',
      submittedByProfileName: 'Organizer User',
      submittedAt: '2099-06-01T21:05:00.000Z',
      notes: trimmedNote,
      teamResults: [
        {
          lobbyId: 'lobby-1',
          lobbyTeamId: 'team-1',
          teamColor: 'blue',
          teamNumber: 1,
          wins: 0,
          rank: 1,
          awardedPoints: 2,
        },
        {
          lobbyId: 'lobby-1',
          lobbyTeamId: 'team-2',
          teamColor: 'red',
          teamNumber: 2,
          wins: 0,
          rank: 1,
          awardedPoints: 2,
        },
      ],
    };
    currentUser = makeCurrentUser({ id: 'organizer-1' });
    canManageLobbyValue = true;
    canSubmitLobbyResultValue = true;
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      createdBy: 'organizer-1',
      gameType: 'competitive',
      players: [
        makePlayer('player-1', { competitivePoints: 10 }),
        makePlayer('player-2', { competitivePoints: 9 }),
      ],
    }));
    fetchLobbyTeamsMock.mockResolvedValue([
      {
        team: { id: 'team-1', color: 'blue', teamNumber: 1 },
        players: [makePlayer('player-1', { competitivePoints: 10 })],
      },
      {
        team: { id: 'team-2', color: 'red', teamNumber: 2 },
        players: [makePlayer('player-2', { competitivePoints: 9 })],
      },
    ]);
    fetchLobbyResultMock
      .mockResolvedValueOnce(null)
      .mockResolvedValue(savedResult);
    submitCompetitiveLobbyResultMock.mockResolvedValue(savedResult);

    const user = userEvent.setup();
    renderLobbyDetail();

    const notesField = await screen.findByLabelText('Optional organizer note');
    fireEvent.change(notesField, { target: { value: longNote } });
    await user.click(screen.getByRole('button', { name: 'Save result and award points' }));

    await waitFor(() => {
      expect(submitCompetitiveLobbyResultMock).toHaveBeenCalledWith(
        'lobby-1',
        'organizer-1',
        { 'team-1': 0, 'team-2': 0 },
        trimmedNote,
      );
    });
  });

  it('renders the saved result summary, reporter details, and organizer note for joined players', async () => {
    const savedResult = {
      lobbyId: 'lobby-1',
      submittedByProfileId: 'organizer-1',
      submittedByProfileName: 'Organizer User',
      submittedAt: '2099-06-01T21:05:00.000Z',
      notes: 'Great tempo and fair rotation all night.',
      teamResults: [
        {
          lobbyId: 'lobby-1',
          lobbyTeamId: 'team-1',
          teamColor: 'blue',
          teamNumber: 1,
          wins: 2,
          rank: 1,
          awardedPoints: 3,
          awardedPointsMax: 4,
          playerAwardedPoints: {
            'viewer-1': 4,
          },
        },
        {
          lobbyId: 'lobby-1',
          lobbyTeamId: 'team-2',
          teamColor: 'red',
          teamNumber: 2,
          wins: 1,
          rank: 2,
          awardedPoints: -1,
          awardedPointsMax: 2,
        },
      ],
    };
    currentUser = makeCurrentUser({ id: 'viewer-1' });
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({
      gameType: 'competitive',
      players: [
        makePlayer('viewer-1', { competitivePoints: 12 }),
        makePlayer('player-2', { competitivePoints: 11 }),
      ],
    }));
    fetchLobbyTeamsMock.mockResolvedValue([
      {
        team: { id: 'team-1', color: 'blue', teamNumber: 1 },
        players: [makePlayer('viewer-1', { competitivePoints: 12 })],
      },
      {
        team: { id: 'team-2', color: 'red', teamNumber: 2 },
        players: [makePlayer('player-2', { competitivePoints: 11 })],
      },
    ]);
    fetchLobbyResultMock.mockResolvedValue(savedResult);

    renderLobbyDetail();

    expect(await screen.findByText('Results and points')).toBeInTheDocument();
    expect(screen.getByText('Your summary')).toBeInTheDocument();
    expect(screen.getByText('Organizer note')).toBeInTheDocument();
    expect(screen.getByText('Great tempo and fair rotation all night.')).toBeInTheDocument();
    expect(screen.getByText(/Reported by Organizer User on/)).toBeInTheDocument();
    expect(screen.getByText('You played on the Blue team')).toBeInTheDocument();
    expect(screen.getByText('+4')).toBeInTheDocument();
    expect(screen.getAllByText(/2 wins/)).toHaveLength(2);
  });
});
