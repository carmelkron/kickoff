import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { useLang } from '../contexts/LanguageContext';

export default function ForgotPasswordPage() {
  const { startPasswordReset } = useAuth();
  const { lang } = useLang();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const nextError = await startPasswordReset(email);
    if (nextError) {
      setError(nextError);
      setSubmitting(false);
      return;
    }

    setDone(true);
    setSubmitting(false);
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <BackButton onClick={() => window.history.back()} className="mb-6" />

      <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          {lang === 'he' ? 'שכחתי סיסמה' : 'Forgot password'}
        </h1>

        {done ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-gray-600">
              {lang === 'he'
                ? 'שלחנו למייל שלך קישור לאיפוס הסיסמה.'
                : 'We sent a password reset link to your email.'}
            </p>
            <Link to="/login" className="inline-flex text-sm font-medium text-primary-600 hover:underline">
              {lang === 'he' ? 'חזור להתחברות' : 'Back to login'}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                {lang === 'he' ? 'אימייל' : 'Email'}
              </label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="you@example.com"
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
                ? (lang === 'he' ? 'שולח...' : 'Sending...')
                : (lang === 'he' ? 'שלח קישור לאיפוס' : 'Send reset link')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
