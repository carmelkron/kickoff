import { useEffect, useState, type ReactNode } from 'react';
import { Crown, Flame, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';
import { fetchLeaderboardStats } from '../lib/appData';
import type { LeaderboardEntry, LeaderboardStats } from '../types';

function LeaderboardTable({
  icon,
  title,
  subtitle,
  entries,
  emptyLabel,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  entries: LeaderboardEntry[];
  emptyLabel: string;
}) {
  const navigate = useNavigate();

  return (
    <section className="rounded-[30px] border border-[var(--app-border)] bg-[var(--panel)] p-5 shadow-[0_24px_70px_rgba(7,19,16,0.05)]">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <button
              key={entry.profile.id}
              type="button"
              onClick={() => navigate(`/profile/${entry.profile.id}`)}
              className="flex w-full items-center gap-3 rounded-[24px] border border-[var(--app-border)] bg-[var(--surface)] px-4 py-3 text-start"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--panel)] text-sm font-semibold text-[var(--accent)]">
                #{entry.rank}
              </div>
              {entry.profile.photoUrl ? (
                <img src={entry.profile.photoUrl} alt={entry.profile.name} className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <div className={`flex h-11 w-11 items-center justify-center rounded-full ${entry.profile.avatarColor} text-sm font-bold text-white`}>
                  {entry.profile.initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--text)]">{entry.profile.name}</p>
                {entry.profile.position && <p className="mt-1 truncate text-xs text-[var(--muted)]">{entry.profile.position}</p>}
              </div>
              <div className="text-end">
                <p className="text-lg font-semibold text-[var(--accent)]">{entry.value}</p>
              </div>
            </button>
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-[var(--app-border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
            {emptyLabel}
          </div>
        )}
      </div>
    </section>
  );
}

export default function LeaderboardsPage() {
  const { lang } = useLang();
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchLeaderboardStats().then((nextStats) => {
      if (!cancelled) {
        setStats(nextStats);
      }
    }).finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <div className="rounded-[32px] bg-[linear-gradient(135deg,rgba(15,127,84,0.18),rgba(15,127,84,0.03))] px-6 py-7 shadow-[0_24px_70px_rgba(7,19,16,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          {lang === 'he' ? 'לוח הישגים' : 'Leaderboards'}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
          {lang === 'he' ? 'מי מוביל את הקהילה' : 'Who is leading the community'}
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          {lang === 'he'
            ? 'שלוש טבלאות פתיחה שמבליטות נקודות, ניצחונות ורצפי הצלחה כדי לעודד תחרות בריאה.'
            : 'Three launch tables highlighting points, wins, and winning streaks to encourage healthy competition.'}
        </p>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-[var(--muted)]">
          {lang === 'he' ? 'טוען הישגים...' : 'Loading leaderboards...'}
        </p>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <LeaderboardTable
            icon={<Crown size={20} />}
            title={lang === 'he' ? 'נקודות בכל הזמנים' : 'All-time points'}
            subtitle={lang === 'he' ? 'הדירוג המצטבר של כל השחקנים' : 'The cumulative ranking across all competitive play'}
            entries={stats?.allTimePoints ?? []}
            emptyLabel={lang === 'he' ? 'עדיין אין נקודות להצגה.' : 'No points to show yet.'}
          />
          <LeaderboardTable
            icon={<Trophy size={20} />}
            title={lang === 'he' ? 'ניצחונות תחרותיים' : 'Competitive wins'}
            subtitle={lang === 'he' ? 'מי ניצח הכי הרבה לובים תחרותיים' : 'Who won the most competitive lobbies'}
            entries={stats?.competitiveWins ?? []}
            emptyLabel={lang === 'he' ? 'עדיין אין ניצחונות להצגה.' : 'No wins to show yet.'}
          />
          <LeaderboardTable
            icon={<Flame size={20} />}
            title={lang === 'he' ? 'רצף ניצחונות גבוה' : 'Highest win streak'}
            subtitle={lang === 'he' ? 'הרצף ההיסטורי הארוך ביותר בלי להישבר' : 'The longest historical streak without a loss'}
            entries={stats?.highestWinStreak ?? []}
            emptyLabel={lang === 'he' ? 'עדיין אין רצפים להצגה.' : 'No streaks to show yet.'}
          />
        </div>
      )}
    </section>
  );
}
