import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BackButton from '../components/BackButton';
import NetworkRecommendationCard from '../components/network/NetworkRecommendationCard';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { fetchNetworkRecommendations } from '../lib/appData';
import { getNetworkBucketLabel, NETWORK_DISCOVERY_BUCKET_ORDER } from '../lib/networkRecommendations';
import type { NetworkRecommendation, NetworkRecommendationBucket } from '../types';

function isNetworkBucket(value: string | undefined): value is NetworkRecommendationBucket {
  return Boolean(value) && NETWORK_DISCOVERY_BUCKET_ORDER.includes(value as NetworkRecommendationBucket);
}

export default function NetworkDiscoveryBucketPage() {
  const { bucket } = useParams<{ bucket: string }>();
  const navigate = useNavigate();
  const { lang } = useLang();
  const { currentUser, sendFriendRequest, refreshCurrentUser } = useAuth();
  const [recommendations, setRecommendations] = useState<NetworkRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const resolvedBucket = isNetworkBucket(bucket) ? bucket : null;
  const currentUserId = currentUser?.id ?? null;

  useEffect(() => {
    if (!currentUserId || !resolvedBucket) {
      return;
    }

    const viewerId = currentUserId;
    let cancelled = false;

    async function loadRecommendations() {
      setLoading(true);
      try {
        const nextRecommendations = await fetchNetworkRecommendations(viewerId);
        if (!cancelled) {
          setRecommendations(nextRecommendations);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, resolvedBucket]);

  const bucketRecommendations = useMemo(() => {
    if (!resolvedBucket) {
      return [];
    }

    return recommendations.filter((recommendation) => recommendation.primaryBucket === resolvedBucket);
  }, [recommendations, resolvedBucket]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!resolvedBucket) {
    return <Navigate to="/network" replace />;
  }

  async function handleConnect(profileId: string) {
    if (!currentUserId) {
      return;
    }

    const viewerId = currentUserId;
    setBusyId(profileId);
    try {
      await sendFriendRequest(profileId);
      await refreshCurrentUser();
      const nextRecommendations = await fetchNetworkRecommendations(viewerId);
      setRecommendations(nextRecommendations);
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-[30px] border border-[var(--app-border)] bg-[var(--panel)] p-5 shadow-[0_18px_50px_rgba(7,19,16,0.04)]">
        <BackButton onClick={() => navigate(-1)} className="mb-4" />

        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          {getNetworkBucketLabel(resolvedBucket, lang)}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {lang === 'he'
            ? `${bucketRecommendations.length} המלצות`
            : `${bucketRecommendations.length} recommendations`}
        </p>
      </header>

      <section className="rounded-[28px] border border-[var(--app-border)] bg-[var(--panel)] p-5 shadow-[0_18px_50px_rgba(7,19,16,0.04)]">
        {loading ? (
          <p className="py-12 text-center text-sm text-[var(--muted)]">
            {lang === 'he' ? 'טוען המלצות...' : 'Loading recommendations...'}
          </p>
        ) : bucketRecommendations.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {bucketRecommendations.map((recommendation) => (
              <NetworkRecommendationCard
                key={recommendation.profile.id}
                lang={lang}
                recommendation={recommendation}
                busy={busyId === recommendation.profile.id}
                onOpenProfile={() => navigate(`/profile/${recommendation.profile.id}`)}
                onConnect={() => void handleConnect(recommendation.profile.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-[var(--app-border)] bg-[var(--surface)] px-4 py-12 text-center">
            <p className="text-sm font-semibold text-[var(--text)]">
              {lang === 'he' ? 'אין כרגע המלצות בקטגוריה הזו' : 'No recommendations in this category yet'}
            </p>
          </div>
        )}
      </section>
    </section>
  );
}
