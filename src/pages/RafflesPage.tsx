import { Gift } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';

export default function RafflesPage() {
  const { lang } = useLang();

  return (
    <section className="flex min-h-[60vh] items-center">
      <div className="w-full rounded-[34px] border border-[var(--app-border)] bg-[var(--panel)] px-6 py-16 text-center shadow-[0_24px_70px_rgba(7,19,16,0.05)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
          <Gift size={26} />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          {lang === 'he' ? 'בקרוב' : 'Coming soon'}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
          {lang === 'he' ? 'אזור ההגרלות ייבנה כאן' : 'The raffles area will live here'}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--muted)]">
          {lang === 'he'
            ? 'העמוד מוכן בתוך הניווט החדש, אבל הלוגיקה העסקית של משימות, מטבעות והגרלות תחכה לגל הבא.'
            : 'The page is already part of the new navigation, but the business logic for missions, coins, and raffles will land in the next wave.'}
        </p>
      </div>
    </section>
  );
}
