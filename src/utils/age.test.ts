import { describe, expect, it } from 'vitest';
import { calculateAgeOnDate, formatAgeRange, validateBirthdate } from './age';

describe('age utils', () => {
  it('validates birthdates across empty, invalid, too-early, future, and valid inputs', () => {
    const today = new Date('2026-04-23T12:00:00.000Z');

    expect(validateBirthdate('', today)).toBeNull();
    expect(validateBirthdate('2026-02-30', today)).toBe('Enter a valid birth date.');
    expect(validateBirthdate('1899-12-31', today)).toBe('Birth date must be 1900 or later.');
    expect(validateBirthdate('2026-04-24', today)).toBe('Birth date cannot be in the future.');
    expect(validateBirthdate('2000-02-29', today)).toBeNull();
  });

  it('calculates age for Date and string references and returns null for invalid inputs', () => {
    expect(calculateAgeOnDate('2000-04-24', '2026-04-23')).toBe(25);
    expect(calculateAgeOnDate('2000-04-23', new Date('2026-04-23T00:00:00.000Z'))).toBe(26);
    expect(calculateAgeOnDate('2000-04-23', 'not-a-date')).toBeNull();
    expect(calculateAgeOnDate('bad-birthdate', '2026-04-23')).toBeNull();
  });

  it('formats age ranges in English and Hebrew', () => {
    expect(formatAgeRange()).toBeNull();
    expect(formatAgeRange(18, 35, 'en')).toBe('Ages 18-35');
    expect(formatAgeRange(18, null, 'en')).toBe('Age 18+');
    expect(formatAgeRange(null, 35, 'en')).toBe('Up to age 35');
    expect(formatAgeRange(18, 35, 'he')).toContain('18-35');
    expect(formatAgeRange(18, null, 'he')).toContain('18+');
    expect(formatAgeRange(null, 35, 'he')).toContain('35');
  });
});
