import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDistanceSourceText, HOME_FILTERS_SESSION_KEY, loadSessionDistancePreference } from './distanceSource';

describe('distanceSource utils', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it('loads the default home preference when nothing is stored or the payload is invalid', () => {
    expect(loadSessionDistancePreference()).toEqual({
      locationMode: 'home',
      currentCoords: null,
    });

    window.sessionStorage.setItem(HOME_FILTERS_SESSION_KEY, '{bad json');
    expect(loadSessionDistancePreference()).toEqual({
      locationMode: 'home',
      currentCoords: null,
    });

    window.sessionStorage.setItem(
      HOME_FILTERS_SESSION_KEY,
      JSON.stringify({
        locationMode: 'current',
        currentCoords: { lat: '32.08', lng: 34.78 },
      }),
    );
    expect(loadSessionDistancePreference()).toEqual({
      locationMode: 'current',
      currentCoords: null,
    });
  });

  it('loads current-location preferences when valid coordinates are stored', () => {
    window.sessionStorage.setItem(
      HOME_FILTERS_SESSION_KEY,
      JSON.stringify({
        locationMode: 'current',
        currentCoords: { lat: 32.08, lng: 34.78 },
      }),
    );

    expect(loadSessionDistancePreference()).toEqual({
      locationMode: 'current',
      currentCoords: { lat: 32.08, lng: 34.78 },
    });
  });

  it('returns home defaults when window is unavailable', () => {
    vi.stubGlobal('window', undefined);

    expect(loadSessionDistancePreference()).toEqual({
      locationMode: 'home',
      currentCoords: null,
    });
  });

  it('formats short and full distance-source labels', () => {
    expect(getDistanceSourceText('current', 'en')).toBe('from current location');
    expect(getDistanceSourceText('home', 'en')).toBe('from home location');
    expect(getDistanceSourceText('current', 'en', 'full')).toBe('Calculated from current location');
    expect(getDistanceSourceText('home', 'en', 'full')).toBe('Calculated from home location');
    expect(getDistanceSourceText('current', 'he')).toContain('נוכחי');
    expect(getDistanceSourceText('home', 'he', 'full')).toContain('בית');
  });
});
