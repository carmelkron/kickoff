import { useEffect, useState } from 'react';
import { Clock, UserCheck, UserPlus, UserX } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { fetchFriendRequestLists, fetchNetworkRecommendations } from '../lib/appData';
import type { FriendRequestListItem, NetworkRecommendation } from '../types';

type RequestTab = 'received' | 'sent';

export default function MyNetworkPage() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const { currentUser, acceptFriendRequest, declineFriendRequest, sendFriendRequest, refreshCurrentUser } = useAuth();
  const [tab, setTab] = useState<RequestTab>('received');
  const [receivedRequests, setReceivedRequests] = useState<FriendRequestListItem[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestListItem[]>([]);
  const [recommendations, setRecommendations] = useState<NetworkRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  async function loadNetwork() {
    if (!currentUser) {
      return;
    }

    setLoading(true);
    try {
      const [friendLists, nextRecommendations] = await Promise.all([
        fetchFriendRequestLists(currentUser.id),
        fetchNetworkRecommendations(currentUser.id),
      ]);
      setReceivedRequests(friendLists.received);
      setSentRequests(friendLists.sent);
      setRecommendations(nextRecommendations.slice(0, 12));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNetwork();
  }, [currentUser?.id]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  async function runAction(id: string, action: () => Promise<void>) {
    setBusyId(id);
    try {
      await action();
      await refreshCurrentUser();
      await loadNetwork();
    } finally {
      setBusyId('');
    }
  }

  const activeRequests = tab === 'received' ? receivedRequests : sentRequests;

  return (
    <section>
      <div className="rounded-[32px] bg-[linear-gradient(135deg,rgba(15,127,84,0.18),rgba(15,127,84,0.03))] px-6 py-7 shadow-[0_24px_70px_rgba(7,19,16,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          {lang === 'he' ? 'הרשת שלי' : 'My Network'}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
          {lang === 'he' ? 'חברים חדשים על בסיס הגרף שכבר בנית' : 'New connections from the graph you already built'}
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          {lang === 'he'
            ? 'המלצות על סמך חברים משותפים, לובים משותפים, שותפים לאותה קבוצה ואינטראקציות אחרונות.'
            : 'Recommendations based on mutual friends, shared lobbies, same-team matches, and recent interactions.'}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="rounded-[30px] border border-[var(--app-border)] bg-[var(--panel)] p-5 shadow-[0_24px_70px_rgba(7,19,16,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)]">
                {lang === 'he' ? 'בקשות חברות' : 'Connection requests'}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {lang === 'he' ? 'צפה במה שממתין לטיפול.' : 'Review what is still waiting on you.'}
              </p>
            </div>
            <div className="rounded-full bg-[var(--surface)] p-1">
              {([
                ['received', lang === 'he' ? 'התקבלו' : 'Received'],
                ['sent', lang === 'he' ? 'נשלחו' : 'Sent'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    tab === value ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <p className="py-8 text-sm text-[var(--muted)]">{lang === 'he' ? 'טוען...' : 'Loading...'}</p>
            ) : activeRequests.length > 0 ? (
              activeRequests.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-[var(--app-border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center gap-3">
                    {item.user.photoUrl ? (
                      <img src={item.user.photoUrl} alt={item.user.name} className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      <div className={`flex h-11 w-11 items-center justify-center rounded-full ${item.user.avatarColor} text-sm font-bold text-white`}>
                        {item.user.initials}
                      </div>
                    )}
                    <button type="button" onClick={() => navigate(`/profile/${item.user.id}`)} className="min-w-0 flex-1 text-start">
                      <p className="truncate text-sm font-semibold text-[var(--text)]">{item.user.name}</p>
                      {item.user.position && <p className="mt-1 truncate text-xs text-[var(--muted)]">{item.user.position}</p>}
                    </button>
                    <div className="text-end">
                      <p className="text-xs font-semibold text-[var(--accent)]">{item.user.competitivePoints ?? 0} pts</p>
                    </div>
                  </div>

                  {tab === 'received' ? (
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void runAction(item.id, () => acceptFriendRequest(item.user.id))}
                        disabled={busyId === item.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        <UserCheck size={13} />
                        {lang === 'he' ? 'אשר' : 'Accept'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runAction(item.id, () => declineFriendRequest(item.user.id))}
                        disabled={busyId === item.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border)] px-4 py-2 text-xs font-semibold text-[var(--text)] disabled:opacity-60"
                      >
                        <UserX size={13} />
                        {lang === 'he' ? 'דחה' : 'Decline'}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--panel)] px-4 py-2 text-xs font-semibold text-[var(--muted)]">
                      <Clock size={13} />
                      {lang === 'he' ? 'ממתין לאישור' : 'Awaiting response'}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[var(--app-border)] bg-[var(--surface)] px-4 py-10 text-center">
                <p className="text-sm font-semibold text-[var(--text)]">
                  {tab === 'received'
                    ? (lang === 'he' ? 'אין בקשות שמחכות לאישור' : 'No requests are waiting for your approval')
                    : (lang === 'he' ? 'אין בקשות ששלחת כרגע' : 'No outgoing requests right now')}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[30px] border border-[var(--app-border)] bg-[var(--panel)] p-5 shadow-[0_24px_70px_rgba(7,19,16,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)]">
                {lang === 'he' ? 'המלצות להתחברות' : 'Recommended connections'}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {lang === 'he' ? 'דירוג רשת v1 על סמך הנתונים שכבר קיימים במערכת.' : 'v1 graph scoring based on data already in the product.'}
              </p>
            </div>
            <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              {recommendations.length}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <p className="py-8 text-sm text-[var(--muted)]">{lang === 'he' ? 'בונה המלצות...' : 'Building recommendations...'}</p>
            ) : recommendations.length > 0 ? (
              recommendations.map((recommendation) => (
                <div key={recommendation.profile.id} className="rounded-[24px] border border-[var(--app-border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center gap-3">
                    {recommendation.profile.photoUrl ? (
                      <img src={recommendation.profile.photoUrl} alt={recommendation.profile.name} className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${recommendation.profile.avatarColor} text-sm font-bold text-white`}>
                        {recommendation.profile.initials}
                      </div>
                    )}
                    <button type="button" onClick={() => navigate(`/profile/${recommendation.profile.id}`)} className="min-w-0 flex-1 text-start">
                      <p className="truncate text-sm font-semibold text-[var(--text)]">{recommendation.profile.name}</p>
                      {recommendation.profile.position && <p className="mt-1 truncate text-xs text-[var(--muted)]">{recommendation.profile.position}</p>}
                    </button>
                    <div className="text-end">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Score</p>
                      <p className="mt-1 text-lg font-semibold text-[var(--accent)]">{recommendation.score}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {recommendation.reasons.map((reason) => (
                      <span key={reason} className="rounded-full bg-[var(--panel)] px-3 py-1 text-[11px] font-semibold text-[var(--muted)]">
                        {reason}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => void runAction(recommendation.profile.id, () => sendFriendRequest(recommendation.profile.id))}
                    disabled={busyId === recommendation.profile.id}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    <UserPlus size={13} />
                    {lang === 'he' ? 'שלח בקשת חברות' : 'Send friend request'}
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[var(--app-border)] bg-[var(--surface)] px-4 py-12 text-center">
                <p className="text-sm font-semibold text-[var(--text)]">
                  {lang === 'he' ? 'אין עדיין המלצות חזקות' : 'No strong recommendations yet'}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {lang === 'he'
                    ? 'ככל שתשחק ביותר לובים ותיצור יותר קשרים, המנוע יתחיל להציע חיבורים טובים יותר.'
                    : 'As you play more lobbies and build more connections, the engine will suggest better matches.'}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
