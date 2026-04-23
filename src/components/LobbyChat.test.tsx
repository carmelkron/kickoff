import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, LobbyMessage, Player } from '../types';
import LobbyChat from './LobbyChat';

const createLobbyMessageMock = vi.fn();
const fetchLobbyMessagesMock = vi.fn();
const removeChannelMock = vi.fn();
const channelMock = {
  on: vi.fn(),
  subscribe: vi.fn(),
};
const subscriptionToken = { id: 'chat-subscription' };
let postgresChangeHandler: (() => void) | null = null;

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
  }),
}));

vi.mock('../lib/appData', () => ({
  createLobbyMessage: (...args: unknown[]) => createLobbyMessageMock(...args),
  fetchLobbyMessages: (...args: unknown[]) => fetchLobbyMessagesMock(...args),
}));

vi.mock('../lib/supabase', () => ({
  requireSupabase: () => ({
    channel: () => channelMock,
    removeChannel: (...args: unknown[]) => removeChannelMock(...args),
  }),
}));

function makeAuthor(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `Player ${id}`,
    initials: id.slice(0, 2).toUpperCase(),
    avatarColor: 'bg-blue-500',
    rating: 5,
    gamesPlayed: 10,
    ratingHistory: [],
    lobbyHistory: [],
    ...overrides,
  };
}

function makeCurrentUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'viewer-1',
    name: 'Viewer User',
    email: 'viewer@example.com',
    initials: 'VU',
    avatarColor: 'bg-green-500',
    rating: 6,
    gamesPlayed: 12,
    ratingHistory: [],
    lobbyHistory: [],
    friends: [],
    sentRequests: [],
    pendingRequests: [],
    ...overrides,
  };
}

function makeMessage(id: string, profileId: string, body: string, overrides: Partial<LobbyMessage> = {}): LobbyMessage {
  return {
    id,
    lobbyId: 'lobby-1',
    profileId,
    body,
    createdAt: '2099-06-01T18:00:00.000Z',
    author: makeAuthor(profileId),
    ...overrides,
  };
}

describe('LobbyChat', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });

    createLobbyMessageMock.mockReset().mockResolvedValue(undefined);
    fetchLobbyMessagesMock.mockReset();
    removeChannelMock.mockReset().mockResolvedValue(undefined);
    channelMock.on.mockReset().mockImplementation((_, __, callback: () => void) => {
      postgresChangeHandler = callback;
      return channelMock;
    });
    channelMock.subscribe.mockReset().mockReturnValue(subscriptionToken);
    postgresChangeHandler = null;
  });

  it('renders nothing when there is no signed-in user', () => {
    const { container } = render(
      <LobbyChat
        lobbyId="lobby-1"
        currentUser={null}
        canViewChat
        canSendChat
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows the locked-state prompt when the viewer cannot access chat', () => {
    render(
      <LobbyChat
        lobbyId="lobby-1"
        currentUser={makeCurrentUser()}
        canViewChat={false}
        canSendChat={false}
      />,
    );

    expect(screen.getByText('Only lobby participants can view and post in chat.')).toBeInTheDocument();
    expect(screen.getByText('Join the lobby to unlock the chat.')).toBeInTheDocument();
    expect(fetchLobbyMessagesMock).not.toHaveBeenCalled();
  });

  it('loads messages, refreshes on realtime changes, and unsubscribes on unmount', async () => {
    fetchLobbyMessagesMock
      .mockResolvedValueOnce([
        makeMessage('message-1', 'viewer-1', 'I am on my way'),
      ])
      .mockResolvedValueOnce([
        makeMessage('message-1', 'viewer-1', 'I am on my way'),
        makeMessage('message-2', 'friend-1', 'Running five minutes late', {
          author: makeAuthor('friend-1', {
            name: 'Alex Friend',
            initials: 'AF',
            photoUrl: 'https://example.com/alex.jpg',
          }),
        }),
      ]);

    const { unmount } = render(
      <LobbyChat
        lobbyId="lobby-1"
        currentUser={makeCurrentUser()}
        canViewChat
        canSendChat
      />,
    );

    expect(await screen.findByText('I am on my way')).toBeInTheDocument();
    expect(channelMock.subscribe).toHaveBeenCalled();

    postgresChangeHandler?.();

    expect(await screen.findByText('Running five minutes late')).toBeInTheDocument();
    expect(screen.getByAltText('Alex Friend')).toBeInTheDocument();

    unmount();

    expect(removeChannelMock).toHaveBeenCalledWith(subscriptionToken);
  });

  it('sends trimmed messages and refreshes the thread after a successful post', async () => {
    fetchLobbyMessagesMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeMessage('message-2', 'viewer-1', 'Need one more ball'),
      ]);

    const user = userEvent.setup();
    render(
      <LobbyChat
        lobbyId="lobby-1"
        currentUser={makeCurrentUser()}
        canViewChat
        canSendChat
      />,
    );

    expect(await screen.findByText('No messages yet. Start the conversation here.')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('For example: I am running 10 minutes late'), '  Need one more ball  ');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(createLobbyMessageMock).toHaveBeenCalledWith('lobby-1', 'viewer-1', 'Need one more ball');
    });
    expect(await screen.findByText('Need one more ball')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('For example: I am running 10 minutes late')).toHaveValue('');
  });

  it('shows loading and send errors without clearing the draft', async () => {
    fetchLobbyMessagesMock.mockRejectedValueOnce(new Error('Chat is unavailable'));

    const user = userEvent.setup();
    const { rerender } = render(
      <LobbyChat
        lobbyId="lobby-1"
        currentUser={makeCurrentUser()}
        canViewChat
        canSendChat
      />,
    );

    expect(await screen.findByText('Chat is unavailable')).toBeInTheDocument();

    fetchLobbyMessagesMock.mockReset().mockResolvedValueOnce([]);
    createLobbyMessageMock.mockReset().mockRejectedValueOnce(new Error('Could not send'));

    rerender(
      <LobbyChat
        lobbyId="lobby-1"
        currentUser={makeCurrentUser()}
        canViewChat
        canSendChat
      />,
    );

    expect(await screen.findByText('No messages yet. Start the conversation here.')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('For example: I am running 10 minutes late');
    await user.type(input, 'Message that fails');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Could not send')).toBeInTheDocument();
    expect(input).toHaveValue('Message that fails');
  });
});
