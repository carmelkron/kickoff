import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { useLang } from '../contexts/LanguageContext';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const { lang } = useLang();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

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

            {error ? <p className="text-sm text-red-500">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting}
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
