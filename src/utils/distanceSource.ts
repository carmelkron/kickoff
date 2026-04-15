import type { Language } from '../types';

export type LocationMode = 'home' | 'current';
export type Coords = { lat: number; lng: number };

export const HOME_FILTERS_SESSION_KEY = 'kickoff_home_filters';

export function loadSessionDistancePreference(): {
  locationMode: LocationMode;
  currentCoords: Coords | null;
} {
  if (typeof window === 'undefined') {
    return { locationMode: 'home', currentCoords: null };
  }

  try {
    const raw = window.sessionStorage.getItem(HOME_FILTERS_SESSION_KEY);
    if (!raw) {
      return { locationMode: 'home', currentCoords: null };
    }

    const parsed = JSON.parse(raw) as {
      locationMode?: unknown;
      currentCoords?: unknown;
    };

    const locationMode = parsed.locationMode === 'current' ? 'current' : 'home';
    const maybeCoords = parsed.currentCoords as Partial<Coords> | null | undefined;
    const currentCoords =
      maybeCoords &&
      typeof maybeCoords.lat === 'number' &&
      typeof maybeCoords.lng === 'number'
        ? { lat: maybeCoords.lat, lng: maybeCoords.lng }
        : null;

    return { locationMode, currentCoords };
  } catch {
    return { locationMode: 'home', currentCoords: null };
  }
}

export function getDistanceSourceText(
  locationMode: LocationMode,
  lang: Language,
  variant: 'short' | 'full' = 'short',
) {
  if (variant === 'full') {
    return locationMode === 'current'
      ? (lang === 'he' ? 'מחושב מהמיקום הנוכחי' : 'Calculated from current location')
      : (lang === 'he' ? 'מחושב ממיקום הבית' : 'Calculated from home location');
  }

  return locationMode === 'current'
    ? (lang === 'he' ? 'מהמיקום הנוכחי' : 'from current location')
    : (lang === 'he' ? 'ממיקום הבית' : 'from home location');
}
