import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResetPasswordPage from './ResetPasswordPage';

const updatePasswordMock = vi.fn();

vi.mock('../contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({
    updatePassword: (...args: unknown[]) => updatePasswordMock(...args),
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

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    updatePasswordMock.mockReset().mockResolvedValue(null);
  });

  it('rejects mismatched passwords before submitting', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const passwordInputs = screen.getAllByPlaceholderText('••••••');
    await user.type(passwordInputs[0], 'secret12');
    await user.type(passwordInputs[1], 'secret21');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it('submits a new password and shows success', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const passwordInputs = screen.getAllByPlaceholderText('••••••');
    await user.type(passwordInputs[0], 'secret12');
    await user.type(passwordInputs[1], 'secret12');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    await waitFor(() => {
      expect(updatePasswordMock).toHaveBeenCalledWith('secret12');
    });
    expect(await screen.findByText('Your password was updated successfully.')).toBeInTheDocument();
  });
});
