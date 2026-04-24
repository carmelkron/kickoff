import { Clock, UserCheck, UserX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import NetworkRecommendationCard from '../components/network/NetworkRecommendationCard';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { fetchFriendRequestLists, fetchNetworkRecommendations } from '../lib/appData';
import { getNetworkBucketLabel, groupRecommendationsByBucket, NETWORK_DISCOVERY_BUCKET_ORDER } from '../lib/networkRecommendations';
import type { FriendRequestListItem, NetworkRecommendation } from '../types';

type NetworkMode = 'discover' | 'requests';
type RequestTab = 'received' | 'sent';

export default function MyNetworkPage() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const { currentUser, acceptFriendRequest, declineFriendRequest, sendFriendRequest, refreshCurrentUser } = useAuth();
  const [mode, setMode] = useState<NetworkMode>('discover');
  const [requestTab, setRequestTab] = useState<RequestTab>('received');
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
      setRecommendations(nextRecommendations);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNetwork();
  }, [currentUser?.id]);

  const groupedRecommendations = useMemo(() => groupRecommendationsByBucket(recommendations), [recommendations]);
  const activeRequests = requestTab === 'received' ? receivedRequests : sentRequests;

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

  return (
    <section className="space-y-4">
      <header className="rounded-[30px] border border-[var(--app-border)] bg-[var(--panel)] p-5 shadow-[0_18px_50px_rgba(7,19,16,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
              {lang === 'he' ? 'הרשת שלי' : 'My network'}
            </h1>
          </div>

          <div className="rounded-full bg-[var(--surface)] p-1">
            {([
              ['discover', lang === 'he' ? 'גילוי' : 'Discover'],
              ['requests', lang === 'he' ? 'ניהול בקשות' : 'Manage requests'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  mode === value ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {mode === 'discover' ? (
        <div className="space-y-4">
          {loading ? (
            <section className="rounded-[28px] border border-[var(--app-border)] bg-[var(--panel)] px-5 py-12 text-center text-sm text-[var(--muted)] shadow-[0_18px_50px_rgba(7,19,16,0.04)]">
              {lang === 'he' ? 'טוען המלצות...' : 'Loading recommendations...'}
            </section>
          ) : recommendations.length > 0 ? (
            NETWORK_DISCOVERY_BUCKET_ORDER.map((bucket) => {
              const bucketRecommendations = groupedRecommendations.get(bucket) ?? [];
              if (bucketRecommendations.length === 0) {
                return null;
              }

              return (
                <section
                  key={bucket}
                  className="rounded-[28px] border border-[var(--app-border)] bg-[var(--panel)] p-5 shadow-[0_18px_50px_rgba(7,19,16,0.04)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-[var(--text)]">
                      {getNetworkBucketLabel(bucket, lang)}
                    </h2>
                    <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                      {bucketRecommendations.length}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {bucketRecommendations.slice(0, 4).map((recommendation) => (
                      <NetworkRecommendationCard
                        key={recommendation.profile.id}
                        lang={lang}
                        recommendation={recommendation}
                        busy={busyId === recommendation.profile.id}
                        onOpenProfile={() => navigate(`/profile/${recommendation.profile.id}`)}
                        onConnect={() => void runAction(recommendation.profile.id, () => sendFriendRequest(recommendation.profile.id))}
                      />
                    ))}
                  </div>

                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => navigate(`/network/discovery/${bucket}`)}
                      className="text-sm font-semibold text-[var(--accent)] hover:underline"
                    >
                      {lang === 'he' ? 'צפה בכולם' : 'View all'}
                    </button>
                  </div>
                </section>
              );
            })
          ) : (
            <section className="rounded-[28px] border border-[var(--app-border)] bg-[var(--panel)] px-5 py-12 text-center shadow-[0_18px_50px_rgba(7,19,16,0.04)]">
              <p className="text-sm font-semibold text-[var(--text)]">
                {lang === 'he' ? 'עדיין אין המלצות להתחבר' : 'No recommendations yet'}
              </p>
            </section>
          )}
        </div>
      ) : (
        <section className="rounded-[28px] border border-[var(--app-border)] bg-[var(--panel)] p-5 shadow-[0_18px_50px_rgba(7,19,16,0.04)]">
          <div className="rounded-full bg-[var(--surface)] p-1">
            {([
              ['received', lang === 'he' ? 'התקבלו' : 'Received'],
              ['sent', lang === 'he' ? 'נשלחו' : 'Sent'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRequestTab(value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  requestTab === value ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <p className="py-8 text-sm text-[var(--muted)]">{lang === 'he' ? 'טוען בקשות...' : 'Loading requests...'}</p>
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

                    <button
                      type="button"
                      onClick={() => navigate(`/profile/${item.user.id}`)}
                      className="min-w-0 flex-1 text-start"
                    >
                      <p className="truncate text-sm font-semibold text-[var(--text)]">{item.user.name}</p>
                      {item.user.position ? (
                        <p className="mt-1 truncate text-xs text-[var(--muted)]">{item.user.position}</p>
                      ) : null}
                    </button>
                  </div>

                  {requestTab === 'received' ? (
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
              <div className="rounded-[24px] border border-dashed border-[var(--app-border)] bg-[var(--surface)] px-4 py-12 text-center">
                <p className="text-sm font-semibold text-[var(--text)]">
                  {requestTab === 'received'
                    ? (lang === 'he' ? 'אין בקשות שמחכות לאישור' : 'No incoming requests')
                    : (lang === 'he' ? 'אין בקשות ששלחת כרגע' : 'No outgoing requests')}
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
