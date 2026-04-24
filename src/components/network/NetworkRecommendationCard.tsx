import { UserPlus } from 'lucide-react';
import type { Language, NetworkRecommendation } from '../../types';

type NetworkRecommendationCardProps = {
  lang: Language;
  recommendation: NetworkRecommendation;
  busy: boolean;
  onOpenProfile: () => void;
  onConnect: () => void;
};

export default function NetworkRecommendationCard({
  lang,
  recommendation,
  busy,
  onOpenProfile,
  onConnect,
}: NetworkRecommendationCardProps) {
  return (
    <article className="rounded-[26px] border border-[var(--app-border)] bg-[var(--panel)] p-4 shadow-[0_16px_40px_rgba(7,19,16,0.04)]">
      <button type="button" onClick={onOpenProfile} className="w-full text-start">
        <div className="h-16 rounded-[20px] bg-[linear-gradient(135deg,rgba(15,127,84,0.12),rgba(15,127,84,0.02))]" />

        <div className="-mt-8 flex justify-center">
          {recommendation.profile.photoUrl ? (
            <img
              src={recommendation.profile.photoUrl}
              alt={recommendation.profile.name}
              className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-sm"
            />
          ) : (
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-full border-4 border-white ${recommendation.profile.avatarColor} text-xl font-bold text-white shadow-sm`}
            >
              {recommendation.profile.initials}
            </div>
          )}
        </div>

        <div className="mt-3 text-center">
          <h3 className="truncate text-base font-semibold text-[var(--text)]">{recommendation.profile.name}</h3>
          {recommendation.subtitle ? (
            <p className="mt-1 line-clamp-2 min-h-[2.75rem] text-sm text-[var(--muted)]">
              {recommendation.subtitle}
            </p>
          ) : (
            <div className="min-h-[2.75rem]" />
          )}
        </div>
      </button>

      <div className="mt-3 min-h-5 text-center">
        {recommendation.mutualFriends > 0 ? (
          <p className="text-xs font-medium text-[var(--muted)]">
            {lang === 'he'
              ? `${recommendation.mutualFriends} חברים משותפים`
              : `${recommendation.mutualFriends} mutual friends`}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onConnect}
        disabled={busy}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-60"
      >
        <UserPlus size={15} />
        {lang === 'he' ? 'התחבר' : 'Connect'}
      </button>
    </article>
  );
}
