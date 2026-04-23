import { Globe, MoonStar, SunMedium, UserCog } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { NOTIFICATION_PREFERENCE_KEYS } from '../lib/preferences';
import type { NotificationPreferenceKey, ThemeMode } from '../types';

const THEME_OPTIONS: ThemeMode[] = ['system', 'light', 'dark'];

function getThemeLabel(themeMode: ThemeMode, lang: 'he' | 'en') {
  if (lang === 'he') {
    if (themeMode === 'system') return 'לפי המערכת';
    if (themeMode === 'light') return 'בהיר';
    return 'כהה';
  }

  if (themeMode === 'system') return 'Follow system';
  if (themeMode === 'light') return 'Light';
  return 'Dark';
}

function getPreferenceLabel(key: NotificationPreferenceKey, lang: 'he' | 'en') {
  if (lang === 'he') {
    if (key === 'friendRequests') return 'בקשות חברות ועדכוני חברים';
    if (key === 'lobbyInvites') return 'הזמנות ללובים';
    if (key === 'joinRequests') return 'בקשות כניסה ואישורים';
    if (key === 'waitlist') return 'רשימות המתנה';
    if (key === 'competitiveResults') return 'תוצאות תחרותיות והקצאות קבוצות';
    return 'תזכורות מארגן';
  }

  if (key === 'friendRequests') return 'Friend requests and friend updates';
  if (key === 'lobbyInvites') return 'Lobby invites';
  if (key === 'joinRequests') return 'Join requests and approvals';
  if (key === 'waitlist') return 'Waitlist updates';
  if (key === 'competitiveResults') return 'Competitive results and team assignments';
  return 'Organizer reminders';
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { lang, setLanguage } = useLang();
  const {
    themeMode,
    setThemeMode,
    notificationPreferences,
    setNotificationPreference,
  } = useAppPreferences();

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          {lang === 'he' ? 'הגדרות' : 'Settings'}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
          {lang === 'he' ? 'התאם את KickOff אליך' : 'Tune KickOff to fit you'}
        </h1>
      </div>

      <section className="rounded-[30px] border border-[var(--app-border)] bg-[var(--panel)] p-5 shadow-[0_24px_70px_rgba(7,19,16,0.05)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            {themeMode === 'dark' ? <MoonStar size={18} /> : <SunMedium size={18} />}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">
              {lang === 'he' ? 'מראה' : 'Appearance'}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {lang === 'he' ? 'בחר בין בהיר, כהה או לפי המערכת.' : 'Choose between light, dark, or system-driven appearance.'}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setThemeMode(option)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                themeMode === option
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface)] text-[var(--muted)]'
              }`}
            >
              {getThemeLabel(option, lang)}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-[var(--app-border)] bg-[var(--panel)] p-5 shadow-[0_24px_70px_rgba(7,19,16,0.05)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Globe size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">
              {lang === 'he' ? 'שפה' : 'Language'}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {lang === 'he' ? 'עברית ואנגלית זמינות כרגע.' : 'Hebrew and English are currently available.'}
            </p>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          {(['he', 'en'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setLanguage(option)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                lang === option
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface)] text-[var(--muted)]'
              }`}
            >
              {option === 'he' ? 'עברית' : 'English'}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-[var(--app-border)] bg-[var(--panel)] p-5 shadow-[0_24px_70px_rgba(7,19,16,0.05)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <UserCog size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">
              {lang === 'he' ? 'ניהול התראות' : 'Notification preferences'}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {lang === 'he' ? 'בחר על אילו אירועים תרצה לקבל עדכונים.' : 'Choose which events should stay visible in your notification center.'}
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {NOTIFICATION_PREFERENCE_KEYS.map((key) => (
            <label key={key} className="flex items-center justify-between gap-4 rounded-[22px] border border-[var(--app-border)] bg-[var(--surface)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--text)]">{getPreferenceLabel(key, lang)}</span>
              <button
                type="button"
                onClick={() => setNotificationPreference(key, !notificationPreferences[key])}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  notificationPreferences[key] ? 'bg-[var(--accent)]' : 'bg-slate-300'
                }`}
                aria-label={getPreferenceLabel(key, lang)}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${notificationPreferences[key] ? 'translate-x-[1.35rem]' : 'translate-x-1'}`} />
              </button>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-[var(--app-border)] bg-[var(--panel)] p-5 shadow-[0_24px_70px_rgba(7,19,16,0.05)]">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          {lang === 'he' ? 'חשבון' : 'Account'}
        </h2>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate(currentUser ? `/profile/${currentUser.id}/edit` : '/login')}
            className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white"
          >
            {lang === 'he' ? 'עריכת פרופיל' : 'Edit profile'}
          </button>
          <button
            type="button"
            onClick={() => navigate(currentUser ? `/profile/${currentUser.id}` : '/login')}
            className="rounded-full border border-[var(--app-border)] px-5 py-3 text-sm font-semibold text-[var(--text)]"
          >
            {lang === 'he' ? 'פתח פרופיל מלא' : 'Open full profile'}
          </button>
        </div>
      </section>
    </section>
  );
}
