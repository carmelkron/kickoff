import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RegisterPage from './RegisterPage';

const registerMock = vi.fn();
const completeRequiredOnboardingMock = vi.fn();
const completeOptionalOnboardingMock = vi.fn();
const skipOptionalOnboardingMock = vi.fn();

let currentUser:
  | {
      id: string;
      name: string;
      email: string;
      position?: string;
      avatarColor: string;
      onboardingStatus: 'pending_required' | 'pending_optional' | 'complete';
      authProvider: 'email' | 'google';
      photoUrl?: string;
      bio?: string;
      homeLatitude?: number;
      homeLongitude?: number;
      homeAddress?: string;
    }
  | null = null;

vi.mock('../contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({
    currentUser,
    register: registerMock,
    completeRequiredOnboarding: completeRequiredOnboardingMock,
    completeOptionalOnboarding: completeOptionalOnboardingMock,
    skipOptionalOnboarding: skipOptionalOnboardingMock,
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
        onClick={() =>
          onSelect({
            address: '1 Test St',
            city: 'Tel Aviv',
            latitude: 32.0853,
            longitude: 34.7818,
            placeId: 'place-home',
          })
        }
      >
        Mock select place
      </button>
      <button type="button" onClick={onClear}>
        Mock clear place
      </button>
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

async function fillStepOne(user: ReturnType<typeof userEvent.setup>) {
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
    registerMock.mockReset().mockResolvedValue(null);
    completeRequiredOnboardingMock.mockReset().mockResolvedValue(null);
    completeOptionalOnboardingMock.mockReset().mockResolvedValue(null);
    skipOptionalOnboardingMock.mockReset().mockResolvedValue(null);
  });

  it('redirects completed users home', () => {
    currentUser = {
      id: 'user-1',
      name: 'User',
      email: 'user@example.com',
      avatarColor: 'bg-blue-500',
      onboardingStatus: 'complete',
      authProvider: 'email',
    };

    renderRegisterPage();

    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('shows the first validation error on step one without calling register', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByPlaceholderText('John Doe'), 'J');
    await user.type(screen.getByPlaceholderText('you@example.com'), 'jane@example.com');
    const passwordInputs = screen.getAllByPlaceholderText('••••••');
    await user.type(passwordInputs[0], 'secret12');
    await user.type(passwordInputs[1], 'secret12');
    await user.selectOptions(screen.getByRole('combobox'), 'Midfield');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Name must be between 2 and 80 characters.')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('submits the basic step and moves to the optional step', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await fillStepOne(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'secret12',
        initials: 'JD',
        avatarColor: 'bg-blue-500',
        position: 'Midfield',
        photoFile: undefined,
      });
    });
  });

  it('renders the optional step for pending_optional users and saves it', async () => {
    currentUser = {
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      avatarColor: 'bg-blue-500',
      onboardingStatus: 'pending_optional',
      authProvider: 'email',
    };

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByPlaceholderText('Tell us a bit about yourself...'), 'Box-to-box midfielder');
    await user.click(screen.getByRole('button', { name: 'Mock select place' }));
    expect(screen.getByTestId('selected-place-notice')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save and finish' }));

    await waitFor(() => {
      expect(completeOptionalOnboardingMock).toHaveBeenCalledWith({
        bio: 'Box-to-box midfielder',
        homeLatitude: 32.0853,
        homeLongitude: 34.7818,
        homeAddress: '1 Test St',
      });
    });
  });

  it('lets users skip the optional step', async () => {
    currentUser = {
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      avatarColor: 'bg-blue-500',
      onboardingStatus: 'pending_optional',
      authProvider: 'email',
    };

    const user = userEvent.setup();
    renderRegisterPage();

    await user.click(screen.getByRole('button', { name: 'Skip' }));

    expect(skipOptionalOnboardingMock).toHaveBeenCalledTimes(1);
  });
});
