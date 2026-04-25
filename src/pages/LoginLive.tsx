import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { useLang } from '../contexts/LanguageContext';

export default function LoginLive() {
  const navigate = useNavigate();
  const { login, currentUser } = useAuth();
  const { lang } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (currentUser) {
    return <Navigate to={currentUser.onboardingStatus === 'complete' ? '/' : '/register'} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const nextError = await login(email, password);
    if (nextError) {
      setError(nextError);
      setSubmitting(false);
      return;
    }

    navigate('/');
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <div className="mb-8 text-center">
        <span className="text-4xl">⚽</span>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">
          {lang === 'he' ? 'ברוך שחזרת' : 'Welcome back'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-gray-700">
            {lang === 'he' ? 'אימייל' : 'Email'}
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-2xl border border-gray-200 px-3 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-gray-700">
            {lang === 'he' ? 'סיסמה' : 'Password'}
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full rounded-2xl border border-gray-200 px-3 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder="••••••"
          />
        </div>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-primary-600 py-3 font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
        >
          {submitting ? (lang === 'he' ? 'מתחבר...' : 'Logging in...') : lang === 'he' ? 'התחבר' : 'Log in'}
        </button>

        <Link
          to="/forgot-password"
          className="inline-flex w-full items-center justify-center gap-1 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
        >
          <span>{lang === 'he' ? 'שכחתי סיסמה' : 'Forgot password'}</span>
          <ChevronRight size={14} className={lang === 'he' ? '' : 'rotate-180'} />
        </Link>

        <p className="text-center text-sm text-gray-500">
          {lang === 'he' ? 'עדיין אין לך חשבון? ' : "Don't have an account? "}
          <Link to="/register" className="font-medium text-primary-600 hover:underline">
            {lang === 'he' ? 'הירשם' : 'Register'}
          </Link>
        </p>
      </form>
    </main>
  );
}
