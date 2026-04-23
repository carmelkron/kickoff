import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SettingsPage from './SettingsPage';

const setLanguageMock = vi.fn();
const setThemeModeMock = vi.fn();
const setNotificationPreferenceMock = vi.fn();

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    lang: 'en',
    setLanguage: (...args: unknown[]) => setLanguageMock(...args),
  }),
}));

vi.mock('../contexts/AppPreferencesContext', () => ({
  useAppPreferences: () => ({
    themeMode: 'system',
    setThemeMode: (...args: unknown[]) => setThemeModeMock(...args),
    notificationPreferences: {
      friendRequests: true,
      lobbyInvites: true,
      joinRequests: true,
      waitlist: true,
      competitiveResults: true,
      organizerReminders: true,
    },
    setNotificationPreference: (...args: unknown[]) => setNotificationPreferenceMock(...args),
  }),
}));

vi.mock('../contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({
    currentUser: { id: 'viewer-1' },
  }),
}));

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile/:id" element={<div>Profile Page</div>} />
        <Route path="/profile/:id/edit" element={<div>Edit Profile Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SettingsPage', () => {
  it('changes theme, language, and notification preferences', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /Dark/i }));
    expect(setThemeModeMock).toHaveBeenCalledWith('dark');

    await user.click(screen.getByRole('button', { name: /עברית/i }));
    expect(setLanguageMock).toHaveBeenCalledWith('he');

    await user.click(screen.getByRole('button', { name: /Lobby invites/i }));
    expect(setNotificationPreferenceMock).toHaveBeenCalledWith('lobbyInvites', false);
  });
});
