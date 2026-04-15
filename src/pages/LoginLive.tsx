import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
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
    return <Navigate to="/" replace />;
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
    <main className="max-w-sm mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <span className="text-4xl">⚽</span>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          {lang === 'he' ? 'ברוך שובך' : 'Welcome back'}
        </h1>
        <p className="text-gray-500 mt-1">
          {lang === 'he' ? 'התחבר לחשבון שלך' : 'Log in to your account'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {lang === 'he' ? 'אימייל' : 'Email'}
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {lang === 'he' ? 'סיסמה' : 'Password'}
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder="••••••"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors"
        >
          {submitting ? (lang === 'he' ? 'מתחבר...' : 'Logging in...') : lang === 'he' ? 'התחבר' : 'Log in'}
        </button>

        <p className="text-center text-sm text-gray-500">
          {lang === 'he' ? 'עדיין אין לך חשבון? ' : "Don't have an account? "}
          <Link to="/register" className="text-primary-600 font-medium hover:underline">
            {lang === 'he' ? 'הירשם' : 'Register'}
          </Link>
        </p>
      </form>
    </main>
  );
}
