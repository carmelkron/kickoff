import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RegisterPage from './RegisterPage';

const registerMock = vi.fn();
let currentUser: { id: string } | null = null;

vi.mock('../contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({
    currentUser,
    register: registerMock,
  }),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
    t: {},
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
          address: '1 Test St',
          city: 'Tel Aviv',
          latitude: 32.0853,
          longitude: 34.7818,
          placeId: 'place-home',
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

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillValidRegisterForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('John Doe'), 'Jane Doe');
  await user.type(screen.getByPlaceholderText('you@example.com'), 'jane@example.com');
  const passwordInputs = screen.getAllByPlaceholderText('••••••');
  await user.type(passwordInputs[0], 'secret12');
  await user.type(passwordInputs[1], 'secret12');
  await user.selectOptions(screen.getByRole('combobox'), 'Midfield');
}

describe('RegisterPage', () => {
  beforeEach(() => {
    currentUser = null;
    registerMock.mockReset();
  });

  it('redirects authenticated users home', () => {
    currentUser = { id: 'user-1' };

    renderRegisterPage();

    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('shows the first validation error without calling register', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByPlaceholderText('John Doe'), 'J');
    await user.type(screen.getByPlaceholderText('you@example.com'), 'jane@example.com');
    const passwordInputs = screen.getAllByPlaceholderText('••••••');
    await user.type(passwordInputs[0], 'secret12');
    await user.type(passwordInputs[1], 'secret12');
    await user.selectOptions(screen.getByRole('combobox'), 'Midfield');
    await user.click(screen.getByRole('button', { name: 'Create Profile' }));

    expect(await screen.findByText('Name must be between 2 and 80 characters.')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('submits a valid registration and navigates home', async () => {
    const user = userEvent.setup();
    registerMock.mockResolvedValue(null);
    renderRegisterPage();

    await fillValidRegisterForm(user);
    await user.click(screen.getByRole('button', { name: 'Mock select place' }));
    expect(screen.getByTestId('selected-place-notice')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create Profile' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'secret12',
        initials: 'JD',
        avatarColor: 'bg-blue-500',
        position: 'Midfield',
        bio: undefined,
        birthdate: undefined,
        photoFile: undefined,
        homeLatitude: 32.0853,
        homeLongitude: 34.7818,
        homeAddress: '1 Test St',
      });
    });

    expect(await screen.findByText('Home Page')).toBeInTheDocument();
  });

  it('renders register failures returned by the auth layer', async () => {
    const user = userEvent.setup();
    registerMock.mockResolvedValue('Email already exists');
    renderRegisterPage();

    await fillValidRegisterForm(user);
    await user.click(screen.getByRole('button', { name: 'Create Profile' }));

    expect(await screen.findByText('Email already exists')).toBeInTheDocument();
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument();
  });
});
