import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginLive from './LoginLive';

const loginMock = vi.fn();

let currentUser: { id: string; name: string } | null = null;

vi.mock('../contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({
    currentUser,
    login: (...args: unknown[]) => loginMock(...args),
  }),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
    toggleLanguage: vi.fn(),
    isRTL: false,
  }),
}));

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginLive />} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/register" element={<div>Register Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginLive', () => {
  beforeEach(() => {
    currentUser = null;
    loginMock.mockReset().mockResolvedValue(null);
  });

  it('redirects authenticated users home', async () => {
    currentUser = { id: 'user-1', name: 'Signed In User' };

    renderLoginPage();

    expect(await screen.findByText('Home Page')).toBeInTheDocument();
  });

  it('logs the user in and navigates home on success', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'player@example.com');
    await user.type(screen.getByLabelText('Password'), 'super-secret');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('player@example.com', 'super-secret');
    });
    expect(await screen.findByText('Home Page')).toBeInTheDocument();
  });

  it('shows auth errors and lets the form recover', async () => {
    loginMock.mockResolvedValue('Invalid credentials');

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'player@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
  });
});
