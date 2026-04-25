import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { useLang } from '../contexts/LanguageContext';
import { requireSupabase } from '../lib/supabase';

function getRecoveryErrorMessage(lang: 'he' | 'en') {
  return lang === 'he'
    ? 'אי אפשר לאמת את קישור האיפוס. פתח את הקישור מחדש מתוך המייל.'
    : 'We could not verify your reset link. Open it again from the email.';
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const { lang } = useLang();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = requireSupabase();

    async function prepareRecoverySession() {
      setLoadingSession(true);
      setError('');

      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash);
      const code = searchParams.get('code');
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      let sessionError: string | null = null;

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          sessionError = exchangeError.message;
        }
      } else if (accessToken && refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (setSessionError) {
          sessionError = setSessionError.message;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (sessionError || !session) {
        setSessionReady(false);
        setError(sessionError ?? getRecoveryErrorMessage(lang));
        setLoadingSession(false);
        return;
      }

      if (window.location.search || window.location.hash) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      setSessionReady(true);
      setLoadingSession(false);
    }

    void prepareRecoverySession();

    return () => {
      active = false;
    };
  }, [lang]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!sessionReady) {
      setError(getRecoveryErrorMessage(lang));
      return;
    }

    if (password !== confirm) {
      setError(lang === 'he' ? 'הסיסמאות לא תואמות.' : 'Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const nextError = await updatePassword(password);
    if (nextError) {
      setError(nextError);
      setSubmitting(false);
      return;
    }

    setDone(true);
    setSubmitting(false);
    window.setTimeout(() => navigate('/login', { replace: true }), 1200);
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <BackButton onClick={() => window.history.back()} className="mb-6" />

      <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          {lang === 'he' ? 'איפוס סיסמה' : 'Reset password'}
        </h1>

        {done ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-gray-600">
              {lang === 'he' ? 'הסיסמה עודכנה בהצלחה.' : 'Your password was updated successfully.'}
            </p>
            <Link to="/login" className="inline-flex text-sm font-medium text-primary-600 hover:underline">
              {lang === 'he' ? 'להתחברות' : 'Go to login'}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="reset-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                {lang === 'he' ? 'סיסמה חדשה' : 'New password'}
              </label>
              <input
                id="reset-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="••••••"
                className="w-full rounded-2xl border border-gray-200 px-3 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div>
              <label htmlFor="reset-confirm" className="mb-1.5 block text-sm font-medium text-gray-700">
                {lang === 'he' ? 'אימות סיסמה' : 'Confirm password'}
              </label>
              <input
                id="reset-confirm"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                placeholder="••••••"
                className="w-full rounded-2xl border border-gray-200 px-3 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            {loadingSession ? (
              <p className="text-sm text-gray-500">
                {lang === 'he' ? 'מאמתים את קישור האיפוס...' : 'Verifying your reset link...'}
              </p>
            ) : null}

            {error ? <p className="text-sm text-red-500">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting || loadingSession || !sessionReady}
              className="w-full rounded-2xl bg-primary-600 py-3 font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
            >
              {submitting
                ? (lang === 'he' ? 'מעדכן...' : 'Updating...')
                : (lang === 'he' ? 'שמור סיסמה חדשה' : 'Save new password')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
