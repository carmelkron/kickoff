import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ForgotPasswordPage from './ForgotPasswordPage';

const startPasswordResetMock = vi.fn();

vi.mock('../contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({
    startPasswordReset: (...args: unknown[]) => startPasswordResetMock(...args),
  }),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
    isRTL: false,
  }),
}));

vi.mock('../components/BackButton', () => ({
  __esModule: true,
  default: ({ onClick, className }: { onClick: () => void; className?: string }) => (
    <button type="button" onClick={onClick} className={className}>
      Back
    </button>
  ),
}));

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    startPasswordResetMock.mockReset().mockResolvedValue(null);
  });

  it('submits the reset request and shows success state', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Email'), 'player@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => {
      expect(startPasswordResetMock).toHaveBeenCalledWith('player@example.com');
    });
    expect(await screen.findByText('We sent a password reset link to your email.')).toBeInTheDocument();
  });
});
