import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EditLobbyPage from './EditLobbyPage';

const fetchLobbyByIdMock = vi.fn();
const updateLobbyMock = vi.fn();

let currentUser: { id: string; name: string } | null = null;

vi.mock('../contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({
    currentUser,
  }),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
    t: {
      create: {
        date: 'Date',
        time: 'Time',
        price: 'Price',
        pricePlaceholder: 'Optional cost',
        description: 'Description',
        descriptionPlaceholder: 'Add game details',
      },
    },
    toggleLanguage: vi.fn(),
    isRTL: false,
  }),
}));

vi.mock('../lib/appData', () => ({
  fetchLobbyById: (...args: unknown[]) => fetchLobbyByIdMock(...args),
  updateLobby: (...args: unknown[]) => updateLobbyMock(...args),
}));

vi.mock('../components/GooglePlacesAutocomplete', () => ({
  __esModule: true,
  default: ({
    value,
    onSelect,
    onClear,
    placeholder,
  }: {
    value: string;
    onSelect: (place: {
      address: string;
      city: string;
      latitude: number;
      longitude: number;
      placeId: string;
    }) => void;
    onClear: () => void;
    placeholder: string;
  }) => (
    <div>
      <input readOnly value={value} placeholder={placeholder} />
      <button
        type="button"
        onClick={() => onSelect({
          address: '20 Bograshov St',
          city: 'Tel Aviv',
          latitude: 32.075,
          longitude: 34.774,
          placeId: 'place-20',
        })}
      >
        Mock select field place
      </button>
      <button type="button" onClick={onClear}>Mock clear field place</button>
    </div>
  ),
}));

vi.mock('../components/SelectedPlaceNotice', () => ({
  __esModule: true,
  default: ({ place }: { place: { address: string; city: string } }) => (
    <div data-testid="selected-field-place">{place.address}, {place.city}</div>
  ),
}));

function makeLobby(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lobby-1',
    title: 'Friday Night Match',
    address: '1 Dizengoff St',
    city: 'Tel Aviv',
    datetime: '2099-06-01T19:30:00.000Z',
    players: [],
    maxPlayers: 10,
    numTeams: 2,
    playersPerTeam: 5,
    minRating: 4,
    minPointsPerGame: null,
    minAge: null,
    maxAge: null,
    isPrivate: false,
    price: 25,
    description: 'Bring dark shirts.',
    createdBy: 'user-1',
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
    latitude: 32.08,
    longitude: 34.78,
    fieldType: 'grass',
    ...overrides,
  };
}

function renderEditLobbyPage() {
  return render(
    <MemoryRouter initialEntries={['/lobby/lobby-1/edit']}>
      <Routes>
        <Route path="/lobby/:id/edit" element={<EditLobbyPage />} />
        <Route path="/lobby/:id" element={<div>Lobby Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EditLobbyPage', () => {
  beforeEach(() => {
    currentUser = { id: 'user-1', name: 'Lobby Owner' };
    fetchLobbyByIdMock.mockReset().mockResolvedValue(makeLobby());
    updateLobbyMock.mockReset().mockResolvedValue(undefined);
  });

  it('redirects logged-out users to login', async () => {
    currentUser = null;

    renderEditLobbyPage();

    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  it('redirects non-owners back to the lobby page', async () => {
    fetchLobbyByIdMock.mockResolvedValue(makeLobby({ createdBy: 'someone-else' }));

    renderEditLobbyPage();

    expect(await screen.findByText('Lobby Page')).toBeInTheDocument();
  });

  it('requires a selected location before saving', async () => {
    const user = userEvent.setup();
    renderEditLobbyPage();

    await screen.findByText('Edit game');
    await user.click(screen.getByRole('button', { name: 'Mock clear field place' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Please select a location from the list')).toBeInTheDocument();
    expect(updateLobbyMock).not.toHaveBeenCalled();
  });

  it('updates the lobby and returns to the lobby page on success', async () => {
    const user = userEvent.setup();
    renderEditLobbyPage();

    const titleInput = await screen.findByDisplayValue('Friday Night Match');
    await user.clear(titleInput);
    await user.type(titleInput, 'Friday Night Derby');

    await user.click(screen.getByRole('button', { name: 'Locked' }));
    await user.click(screen.getByRole('button', { name: '🏆 Competitive' }));
    await user.click(screen.getByRole('button', { name: '3 teams' }));
    await user.click(screen.getByRole('button', { name: '⬛ Asphalt' }));

    const playersPerTeamSlider = document.querySelector('input[type="range"]');
    if (!(playersPerTeamSlider instanceof HTMLInputElement)) {
      throw new Error('Expected players-per-team slider to exist');
    }
    fireEvent.change(playersPerTeamSlider, { target: { value: '4' } });

    const priceInput = screen.getByPlaceholderText('Optional cost');
    await user.clear(priceInput);
    await user.type(priceInput, '35');

    const minPointsInput = screen.getByPlaceholderText('e.g. 8.5');
    await user.type(minPointsInput, '7.5');

    const descriptionInput = screen.getByPlaceholderText('Add game details');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Bring both light and dark shirts.');

    await user.click(screen.getByRole('button', { name: 'Mock select field place' }));
    expect(screen.getByTestId('selected-field-place')).toHaveTextContent('20 Bograshov St, Tel Aviv');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateLobbyMock).toHaveBeenCalledWith({
        lobbyId: 'lobby-1',
        title: 'Friday Night Derby',
        address: '20 Bograshov St',
        city: 'Tel Aviv',
        datetime: expect.stringMatching(/^2099-06-01T19:30:00/),
        numTeams: 3,
        playersPerTeam: 4,
        minPointsPerGame: 7.5,
        minAge: undefined,
        maxAge: undefined,
        price: 35,
        description: 'Bring both light and dark shirts.',
        gameType: 'competitive',
        accessType: 'locked',
        fieldType: 'asphalt',
        latitude: 32.075,
        longitude: 34.774,
      });
    });

    expect(await screen.findByText('Lobby Page')).toBeInTheDocument();
  });

  it('shows update errors from the data layer', async () => {
    updateLobbyMock.mockRejectedValue(new Error('Could not update lobby'));

    const user = userEvent.setup();
    renderEditLobbyPage();

    await screen.findByText('Edit game');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Could not update lobby')).toBeInTheDocument();
  });
});
