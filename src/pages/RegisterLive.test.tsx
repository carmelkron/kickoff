import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RegisterLive from './RegisterLive';

const registerMock = vi.fn();
const createObjectURLMock = vi.fn(() => 'blob:preview');
const revokeObjectURLMock = vi.fn();

let currentUser: { id: string } | null = null;

vi.mock('../contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({
    currentUser,
    register: (...args: unknown[]) => registerMock(...args),
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

function renderRegisterLive() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterLive />} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillValidRegisterForm(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
  await user.type(screen.getByPlaceholderText('John Doe'), 'Jane Doe');
  await user.type(screen.getByPlaceholderText('you@example.com'), 'jane@example.com');
  const passwordInputs = Array.from(container.querySelectorAll('input[type="password"]'));
  await user.type(passwordInputs[0], 'secret12');
  await user.type(passwordInputs[1], 'secret12');
  await user.selectOptions(screen.getByRole('combobox'), 'Midfield');
}

describe('RegisterLive', () => {
  beforeEach(() => {
    currentUser = null;
    registerMock.mockReset().mockResolvedValue(null);
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    });
  });

  it('redirects authenticated users home', () => {
    currentUser = { id: 'user-1' };

    renderRegisterLive();

    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('shows the first validation error without calling register', async () => {
    const user = userEvent.setup();
    const { container } = renderRegisterLive();

    await user.type(screen.getByPlaceholderText('John Doe'), 'J');
    await user.type(screen.getByPlaceholderText('you@example.com'), 'jane@example.com');
    const passwordInputs = Array.from(container.querySelectorAll('input[type="password"]'));
    await user.type(passwordInputs[0], 'secret12');
    await user.type(passwordInputs[1], 'secret12');
    await user.selectOptions(screen.getByRole('combobox'), 'Midfield');
    await user.click(screen.getByRole('button', { name: 'Create Profile' }));

    expect(await screen.findByText('Name must be between 2 and 80 characters.')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('uploads a photo, lets the user switch back to avatar colors, and submits successfully', async () => {
    const user = userEvent.setup();
    const { container } = renderRegisterLive();
    const photoFile = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    await fillValidRegisterForm(user, container);
    await user.type(screen.getByPlaceholderText('Tell us a bit about yourself...'), 'Box-to-box midfielder');

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, { target: { files: [photoFile] } });

    expect(createObjectURLMock).toHaveBeenCalledWith(photoFile);
    expect(screen.getByAltText('preview')).toBeInTheDocument();

    await user.click(screen.getByTitle('Purple'));

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:preview');
    expect(screen.queryByAltText('preview')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create Profile' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'secret12',
        initials: 'JD',
        avatarColor: 'bg-purple-500',
        position: 'Midfield',
        bio: 'Box-to-box midfielder',
        photoFile: undefined,
      });
    });

    expect(await screen.findByText('Home Page')).toBeInTheDocument();
  });

  it('renders register failures returned by the auth layer', async () => {
    const user = userEvent.setup();
    registerMock.mockResolvedValue('Email already exists');
    const { container } = renderRegisterLive();

    await fillValidRegisterForm(user, container);
    await user.click(screen.getByRole('button', { name: 'Create Profile' }));

    expect(await screen.findByText('Email already exists')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Profile' })).toBeEnabled();
  });
});
