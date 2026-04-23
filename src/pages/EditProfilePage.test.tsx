import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EditProfilePage from './EditProfilePage';

const updateProfileMock = vi.fn();
const updateHomeLocationMock = vi.fn();
const uploadAvatarMock = vi.fn();
const refreshCurrentUserMock = vi.fn();

let currentUser: {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  position?: string;
  bio?: string;
  birthdate?: string;
  photoUrl?: string;
  homeAddress?: string;
  homeLatitude?: number;
  homeLongitude?: number;
  skills?: Array<{ label: string }>;
} | null = null;

vi.mock('../contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({
    currentUser,
    refreshCurrentUser: refreshCurrentUserMock,
  }),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
    toggleLanguage: vi.fn(),
    isRTL: false,
  }),
}));

vi.mock('../lib/appData', () => ({
  updateProfile: (...args: unknown[]) => updateProfileMock(...args),
  updateHomeLocation: (...args: unknown[]) => updateHomeLocationMock(...args),
}));

vi.mock('../lib/storage', () => ({
  uploadAvatar: (...args: unknown[]) => uploadAvatarMock(...args),
}));

vi.mock('../lib/profileSkillBadges', () => ({
  getProfileSkillBadgeStyle: () => ({
    chipClassName: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: 'S',
  }),
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
          address: '15 Allenby St',
          city: 'Tel Aviv',
          latitude: 32.0701,
          longitude: 34.7698,
          placeId: 'place-1',
        })}
      >
        Mock select home place
      </button>
      <button type="button" onClick={onClear}>Mock clear home place</button>
    </div>
  ),
}));

vi.mock('../components/SelectedPlaceNotice', () => ({
  __esModule: true,
  default: ({ place }: { place: { address: string; city: string } }) => (
    <div data-testid="selected-home-place">{place.address}, {place.city}</div>
  ),
}));

function makeCurrentUser(
  overrides: Partial<NonNullable<typeof currentUser>> = {},
): NonNullable<typeof currentUser> {
  return {
    id: 'user-1',
    name: 'Alex Keeper',
    initials: 'AK',
    avatarColor: 'bg-blue-500',
    position: 'Defense',
    bio: 'Love five-a-side.',
    birthdate: '1998-05-18',
    photoUrl: undefined,
    homeAddress: undefined,
    homeLatitude: undefined,
    homeLongitude: undefined,
    skills: [{ label: 'Finishing' }],
    ...overrides,
  };
}

function renderEditProfilePage() {
  return render(
    <MemoryRouter initialEntries={['/profile/user-1/edit']}>
      <Routes>
        <Route path="/profile/:id/edit" element={<EditProfilePage />} />
        <Route path="/profile/:id" element={<div>Profile Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EditProfilePage', () => {
  beforeEach(() => {
    currentUser = makeCurrentUser();
    updateProfileMock.mockReset().mockResolvedValue(undefined);
    updateHomeLocationMock.mockReset().mockResolvedValue(undefined);
    uploadAvatarMock.mockReset().mockResolvedValue('https://cdn.example.com/avatar.png');
    refreshCurrentUserMock.mockReset().mockResolvedValue(undefined);
  });

  it('redirects logged-out users to login', async () => {
    currentUser = null;

    renderEditProfilePage();

    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  it('blocks saving when the name is too short', async () => {
    const user = userEvent.setup();
    renderEditProfilePage();

    const nameInput = await screen.findByDisplayValue('Alex Keeper');
    await user.clear(nameInput);
    await user.type(nameInput, 'A');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Name must be at least 2 characters')).toBeInTheDocument();
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it('blocks saving when the birth date is invalid', async () => {
    const user = userEvent.setup();
    renderEditProfilePage();

    const birthdateInput = document.querySelector('input[type="date"]');
    if (!(birthdateInput instanceof HTMLInputElement)) {
      throw new Error('Expected birth date input to exist');
    }

    await user.clear(birthdateInput);
    await user.type(birthdateInput, '2099-01-01');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Birth date cannot be in the future.')).toBeInTheDocument();
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it('saves profile changes, skills, and home location', async () => {
    const user = userEvent.setup();
    renderEditProfilePage();

    const nameInput = await screen.findByDisplayValue('Alex Keeper');
    await user.clear(nameInput);
    await user.type(nameInput, 'Alex Captain');

    await user.selectOptions(screen.getByRole('combobox'), 'Attack');

    const bioInput = screen.getByPlaceholderText('Tell us about yourself...');
    await user.clear(bioInput);
    await user.type(bioInput, 'Pressing high and tracking back.');

    const skillInput = screen.getByPlaceholderText('e.g. Finishing, Dribbling, 1v1 defense');
    await user.type(skillInput, 'Leadership');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await user.click(screen.getByRole('button', { name: 'Mock select home place' }));

    expect(screen.getByTestId('selected-home-place')).toHaveTextContent('15 Allenby St, Tel Aviv');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledWith({
        profileId: 'user-1',
        name: 'Alex Captain',
        position: 'Attack',
        bio: 'Pressing high and tracking back.',
        birthdate: '1998-05-18',
        photoUrl: undefined,
        skills: ['Finishing', 'Leadership'],
      });
    });

    expect(updateHomeLocationMock).toHaveBeenCalledWith(
      'user-1',
      32.0701,
      34.7698,
      '15 Allenby St',
    );
    expect(refreshCurrentUserMock).toHaveBeenCalled();
    expect(await screen.findByText('Profile Page')).toBeInTheDocument();
  });

  it('shows save errors from profile updates', async () => {
    updateProfileMock.mockRejectedValue(new Error('Could not save profile'));

    const user = userEvent.setup();
    renderEditProfilePage();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Could not save profile')).toBeInTheDocument();
    expect(updateHomeLocationMock).not.toHaveBeenCalled();
  });
});
