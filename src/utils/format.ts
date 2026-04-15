import { Language } from '../types';

export function formatDateTime(isoString: string, lang: Language, todayLabel: string, tomorrowLabel: string): string {
  const date = new Date(isoString);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const time = date.toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isToday) return `${todayLabel}, ${time}`;
  if (isTomorrow) return `${tomorrowLabel}, ${time}`;

  const dateStr = date.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return `${dateStr}, ${time}`;
}
