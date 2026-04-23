import type { ReactNode } from 'react';
import { LogOut, Settings, User, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ProfileDrawer({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { lang } = useLang();
  const { currentUser, logout } = useAuth();

  if (!open || !currentUser) {
    return null;
  }

  function goTo(path: string) {
    onClose();
    navigate(path);
  }

  async function handleLogout() {
    await logout();
    onClose();
    navigate('/');
  }

  return (
    <div className="fixed inset-0 z-[65] bg-black/35 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="ms-auto flex h-full w-[min(24rem,92vw)] flex-col bg-[var(--panel)] px-5 pb-6 pt-8 shadow-[0_30px_80px_rgba(7,19,16,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => goTo(`/profile/${currentUser.id}`)}
          className="rounded-[28px] border border-[var(--app-border)] bg-[var(--surface)] p-5 text-start transition-transform hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-4">
            {currentUser.photoUrl ? (
              <img src={currentUser.photoUrl} alt={currentUser.name} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className={`flex h-16 w-16 items-center justify-center rounded-full ${currentUser.avatarColor} text-lg font-bold text-white`}>
                {currentUser.initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-[var(--text)]">{currentUser.name}</p>
              {currentUser.position && <p className="mt-1 truncate text-sm text-[var(--muted)]">{currentUser.position}</p>}
            </div>
          </div>
          {currentUser.bio && (
            <p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{currentUser.bio}</p>
          )}
          <div className="mt-4 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            {lang === 'he' ? 'פתח פרופיל מלא' : 'Open full profile'}
          </div>
        </button>

        <div className="mt-6 space-y-2">
          <DrawerAction
            icon={<User size={17} />}
            label={lang === 'he' ? 'הפרופיל שלי' : 'My profile'}
            onClick={() => goTo(`/profile/${currentUser.id}`)}
          />
          <DrawerAction
            icon={<Users size={17} />}
            label={lang === 'he' ? 'חברים, סטטיסטיקות והיסטוריה' : 'Friends, stats, and history'}
            onClick={() => goTo(`/profile/${currentUser.id}`)}
          />
          <DrawerAction
            icon={<Settings size={17} />}
            label={lang === 'he' ? 'הגדרות' : 'Settings'}
            onClick={() => goTo('/settings')}
          />
        </div>

        <div className="mt-auto border-t border-[var(--app-border)] pt-5">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-rose-500 transition-colors hover:bg-rose-50"
          >
            <LogOut size={17} />
            {lang === 'he' ? 'התנתק' : 'Log out'}
          </button>
        </div>
      </aside>
    </div>
  );
}

function DrawerAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-start text-sm font-semibold text-[var(--text)] transition-colors hover:bg-black/5"
    >
      <span className="text-[var(--accent)]">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
