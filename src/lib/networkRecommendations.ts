import type { Language, NetworkRecommendation, NetworkRecommendationBucket } from '../types';

export const NETWORK_DISCOVERY_BUCKET_ORDER: NetworkRecommendationBucket[] = [
  'played_together',
  'mutual_friends',
  'near_you',
  'people_you_may_know',
];

export function getNetworkBucketLabel(bucket: NetworkRecommendationBucket, lang: Language) {
  if (bucket === 'played_together') {
    return lang === 'he' ? 'אנשים ששיחקת איתם' : 'People you played with';
  }

  if (bucket === 'mutual_friends') {
    return lang === 'he' ? 'חברים משותפים' : 'Mutual friends';
  }

  if (bucket === 'near_you') {
    return lang === 'he' ? 'מהאזור שלך' : 'Near you';
  }

  return lang === 'he' ? 'אולי תכירו' : 'People you may know';
}

export function groupRecommendationsByBucket(recommendations: NetworkRecommendation[]) {
  const grouped = new Map<NetworkRecommendationBucket, NetworkRecommendation[]>();

  for (const bucket of NETWORK_DISCOVERY_BUCKET_ORDER) {
    grouped.set(bucket, []);
  }

  for (const recommendation of recommendations) {
    grouped.get(recommendation.primaryBucket)?.push(recommendation);
  }

  return grouped;
}
