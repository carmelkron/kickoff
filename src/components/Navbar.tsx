import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang, toggleLanguage } = useLang();
  const { currentUser, logout } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 font-bold text-xl text-gray-900 hover:text-primary-600 transition-colors"
        >
          <span className="text-2xl">⚽</span>
          <span>{t.app.name}</span>
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={toggleLanguage}
            className="text-sm font-medium text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {lang === 'he' ? 'EN' : 'עב'}
          </button>

          {!isActive('/') && (
            <button
              onClick={() => navigate('/')}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors hidden sm:block"
            >
              {t.nav.home}
            </button>
          )}

          {currentUser ? (
            <>
              {/* Profile button */}
              <button
                onClick={() => navigate(`/profile/${currentUser.id}`)}
                className="flex items-center gap-2 hover:bg-gray-100 rounded-xl px-2 py-1.5 transition-colors"
              >
                {currentUser.photoUrl ? (
                  <img src={currentUser.photoUrl} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className={`w-8 h-8 rounded-full ${currentUser.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                    {currentUser.initials}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700 hidden sm:block">{currentUser.name.split(' ')[0]}</span>
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                title={lang === 'he' ? 'התנתק' : 'Log out'}
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <User size={15} />
              {lang === 'he' ? 'כניסה' : 'Login'}
            </button>
          )}

          {/* Create game */}
          <button
            onClick={() => navigate('/create')}
            className="text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl transition-colors"
          >
            {t.nav.createGame}
          </button>
        </div>
      </div>
    </header>
  );
}
