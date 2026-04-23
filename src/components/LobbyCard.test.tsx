import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Lobby, Player } from '../types';
import LobbyCard from './LobbyCard';

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
    t: {
      common: {
        today: 'Today',
        tomorrow: 'Tomorrow',
        km: 'km',
      },
      lobby: {
        players: 'players',
        spotsLeft: 'spots left',
        full: 'Full',
        perPerson: 'per person',
        free: 'Free',
      },
    },
  }),
}));

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `Player ${id}`,
    initials: id.slice(0, 2).toUpperCase(),
    avatarColor: 'bg-blue-500',
    rating: 5,
    gamesPlayed: 10,
    ratingHistory: [],
    lobbyHistory: [],
    competitivePoints: 100,
    ...overrides,
  };
}

function makeLobby(overrides: Partial<Lobby> = {}): Lobby {
  return {
    id: 'lobby-1',
    title: 'Neighborhood Match',
    address: '123 Gordon St',
    city: 'Tel Aviv',
    datetime: '2099-06-01T18:00:00.000Z',
    players: [makePlayer('player-1'), makePlayer('player-2')],
    maxPlayers: 4,
    numTeams: 2,
    playersPerTeam: 2,
    minRating: undefined,
    minPointsPerGame: undefined,
    minAge: undefined,
    maxAge: undefined,
    isPrivate: false,
    price: 0,
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

function renderCard(lobby: Lobby, distanceLabel?: string, distanceNote?: string) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LobbyCard lobby={lobby} distanceLabel={distanceLabel} distanceNote={distanceNote} />} />
        <Route path="/lobby/:id" element={<div>Lobby Details</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LobbyCard', () => {
  it('renders competitive restrictions, metadata, and navigates to the lobby details page', async () => {
    const lobby = makeLobby({
      id: 'ranked-1',
      title: 'Ranked City Match',
      address: 'Central Court',
      city: 'Haifa',
      players: [
        makePlayer('player-1', { competitivePoints: 120 }),
        makePlayer('player-2', { competitivePoints: 180 }),
      ],
      maxPlayers: 4,
      price: 25,
      gameType: 'competitive',
      accessType: 'locked',
      viewerHasAccess: false,
      minRating: 120,
      minPointsPerGame: 7.5,
      minAge: 18,
      maxAge: 35,
      fieldType: 'asphalt',
    });

    const user = userEvent.setup();
    renderCard(lobby, '2.4 km', 'from current location');

    expect(screen.getByText('Ranked City Match')).toBeInTheDocument();
    expect(screen.getByText('Haifa')).toBeInTheDocument();
    expect(screen.getByText('Central Court, Haifa')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getByText('Approval required')).toBeInTheDocument();
    expect(screen.getByText('Ages 18-35')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('Min: 120 pts')).toBeInTheDocument();
    expect(screen.getByText('Min avg: 7.5 pts/game')).toBeInTheDocument();
    expect(screen.getByText('2.4 km')).toBeInTheDocument();
    expect(screen.getByText('from current location')).toBeInTheDocument();
    expect(screen.getByText('25 per person')).toBeInTheDocument();

    await user.click(screen.getByText('Ranked City Match'));

    expect(await screen.findByText('Lobby Details')).toBeInTheDocument();
  });

  it('shows full and free states for friendly lobbies and includes overflow player avatars', () => {
    const lobby = makeLobby({
      title: 'Five-A-Side Full House',
      players: [
        makePlayer('player-1'),
        makePlayer('player-2'),
        makePlayer('player-3'),
        makePlayer('player-4'),
        makePlayer('player-5'),
      ],
      maxPlayers: 5,
      price: 0,
      gameType: 'friendly',
    });

    renderCard(lobby);

    expect(screen.getByText('Five-A-Side Full House')).toBeInTheDocument();
    expect(screen.getByText('5/5 players')).toBeInTheDocument();
    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.queryByText('Locked')).not.toBeInTheDocument();
    expect(screen.queryByText(/Min:/)).not.toBeInTheDocument();
  });
});
