import { describe, expect, it } from 'vitest';
import { formatLocationLabel, normalizeLocationText, stripCountrySuffix } from './location';

describe('location utils', () => {
  it('normalizes whitespace in location text', () => {
    expect(normalizeLocationText('  123   Gordon   St  ')).toBe('123 Gordon St');
  });

  it('strips trailing country suffixes in English and Hebrew', () => {
    expect(stripCountrySuffix('Tel Aviv, Israel')).toBe('Tel Aviv');
    expect(stripCountrySuffix('תל אביב, ישראל')).toBe('תל אביב');
  });

  it('formats location labels for empty values, overlapping values, and distinct values', () => {
    expect(formatLocationLabel('', 'Tel Aviv')).toBe('Tel Aviv');
    expect(formatLocationLabel('123 Gordon St', '')).toBe('123 Gordon St');
    expect(formatLocationLabel('Tel Aviv Port', 'Tel Aviv')).toBe('Tel Aviv Port');
    expect(formatLocationLabel('123 Gordon St', 'Tel Aviv')).toBe('123 Gordon St, Tel Aviv');
  });
});
