import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CreateLobbyPage from './CreateLobbyPage';

const createLobbyMock = vi.fn();
let currentUser: { id: string } | null = null;

vi.mock('../lib/appData', () => ({
  createLobby: (...args: unknown[]) => createLobbyMock(...args),
}));

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
        title: 'Create New Game',
        subtitle: 'Fill in the details and find players',
        date: 'Date',
        time: 'Time',
        price: 'Cost per Person (₪)',
        pricePlaceholder: '0 = Free',
        description: 'Description (optional)',
        descriptionPlaceholder: 'Tell us about the game...',
        submit: 'Publish Game',
      },
    },
    toggleLanguage: vi.fn(),
    isRTL: false,
  }),
}));

vi.mock('../components/GooglePlacesAutocomplete', () => ({
  __esModule: true,
  default: ({ onSelect, onClear }: { onSelect: (place: unknown) => void; onClear: () => void }) => (
    <div>
      <button
        type="button"
        onClick={() => onSelect({
          address: '123 Gordon St',
          city: 'Tel Aviv',
          latitude: 32.0853,
          longitude: 34.7818,
          placeId: 'place-lobby',
        })}
      >
        Mock select place
      </button>
      <button type="button" onClick={onClear}>Mock clear place</button>
    </div>
  ),
}));

vi.mock('../components/SelectedPlaceNotice', () => ({
  __esModule: true,
  default: () => <div data-testid="selected-place-notice">Selected place notice</div>,
}));

function renderCreateLobbyPage() {
  return render(
    <MemoryRouter initialEntries={['/create']}>
      <Routes>
        <Route path="/create" element={<CreateLobbyPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/lobby/:id" element={<div>Lobby Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillValidCreateLobbyForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('e.g. Evening game at Gordon'), 'Thursday Night');
  await user.type(screen.getByPlaceholderText('Manual fallback: address'), '123 Gordon St');
  await user.type(screen.getByPlaceholderText('Manual fallback: city'), 'Tel Aviv');

  const dateInput = document.querySelector('input[type="date"]');
  const timeInput = document.querySelector('input[type="time"]');
  if (!(dateInput instanceof HTMLInputElement) || !(timeInput instanceof HTMLInputElement)) {
    throw new Error('Expected date and time inputs to be present.');
  }

  await user.type(dateInput, '2099-06-01');
  await user.type(timeInput, '20:30');
}

describe('CreateLobbyPage', () => {
  beforeEach(() => {
    currentUser = { id: 'user-1' };
    createLobbyMock.mockReset();
  });

  it('redirects unauthenticated users to login', () => {
    currentUser = null;

    renderCreateLobbyPage();

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('requires a location before attempting to create the lobby', async () => {
    const user = userEvent.setup();
    renderCreateLobbyPage();

    await user.type(screen.getByPlaceholderText('e.g. Evening game at Gordon'), 'Thursday Night');
    const dateInput = document.querySelector('input[type="date"]');
    const timeInput = document.querySelector('input[type="time"]');
    if (!(dateInput instanceof HTMLInputElement) || !(timeInput instanceof HTMLInputElement)) {
      throw new Error('Expected date and time inputs to be present.');
    }
    await user.type(dateInput, '2099-06-01');
    await user.type(timeInput, '20:30');
    await user.click(screen.getByRole('button', { name: 'Publish Game' }));

    expect(
      await screen.findByText('Please select a location from the list or fill in the address and city manually.'),
    ).toBeInTheDocument();
    expect(createLobbyMock).not.toHaveBeenCalled();
  });

  it('submits a valid friendly lobby with manual fallback location and navigates to the lobby page', async () => {
    const user = userEvent.setup();
    createLobbyMock.mockResolvedValue('lobby-123');
    renderCreateLobbyPage();

    await fillValidCreateLobbyForm(user);
    await user.click(screen.getByRole('button', { name: 'Publish Game' }));

    await waitFor(() => {
      expect(createLobbyMock).toHaveBeenCalledWith({
        title: 'Thursday Night',
        address: '123 Gordon St',
        city: 'Tel Aviv',
        datetime: new Date('2099-06-01T20:30').toISOString(),
        maxPlayers: 10,
        numTeams: 2,
        playersPerTeam: 5,
        minPointsPerGame: undefined,
        minAge: undefined,
        maxAge: undefined,
        price: undefined,
        description: undefined,
        createdBy: 'user-1',
        gameType: 'friendly',
        accessType: 'open',
        fieldType: undefined,
        genderRestriction: 'none',
        latitude: undefined,
        longitude: undefined,
      });
    });

    expect(await screen.findByText('Lobby Page')).toBeInTheDocument();
  });

  it('renders createLobby errors returned by the data layer', async () => {
    const user = userEvent.setup();
    createLobbyMock.mockRejectedValue(new Error('Failed to create game'));
    renderCreateLobbyPage();

    await fillValidCreateLobbyForm(user);
    await user.click(screen.getByRole('button', { name: 'Publish Game' }));

    expect(await screen.findByText('Failed to create game')).toBeInTheDocument();
    expect(screen.queryByText('Lobby Page')).not.toBeInTheDocument();
  });
});
