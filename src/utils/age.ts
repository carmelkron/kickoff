import type { Language } from '../types';

const MIN_BIRTHDATE = '1900-01-01';

function parseDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, date };
}

export function validateBirthdate(value: string, today = new Date()) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = parseDateParts(normalized);
  if (!parsed) {
    return 'Enter a valid birth date.';
  }

  if (normalized < MIN_BIRTHDATE) {
    return 'Birth date must be 1900 or later.';
  }

  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (parsed.date.getTime() > todayUtc.getTime()) {
    return 'Birth date cannot be in the future.';
  }

  return null;
}

export function calculateAgeOnDate(birthdate: string, referenceDate: string | Date) {
  const birth = parseDateParts(birthdate);
  const reference = (() => {
    if (referenceDate instanceof Date) {
      return {
        year: referenceDate.getUTCFullYear(),
        month: referenceDate.getUTCMonth() + 1,
        day: referenceDate.getUTCDate(),
      };
    }

    const parsedDate = new Date(referenceDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return parseDateParts(referenceDate);
    }

    return {
      year: parsedDate.getUTCFullYear(),
      month: parsedDate.getUTCMonth() + 1,
      day: parsedDate.getUTCDate(),
    };
  })();

  if (!birth || !reference) {
    return null;
  }

  let age = reference.year - birth.year;
  if (
    reference.month < birth.month
    || (reference.month === birth.month && reference.day < birth.day)
  ) {
    age -= 1;
  }

  return age;
}

export function formatAgeRange(minAge?: number | null, maxAge?: number | null, lang: Language = 'en') {
  if (minAge == null && maxAge == null) {
    return null;
  }

  if (minAge != null && maxAge != null) {
    return lang === 'he' ? `גילאים ${minAge}-${maxAge}` : `Ages ${minAge}-${maxAge}`;
  }

  if (minAge != null) {
    return lang === 'he' ? `גיל ${minAge}+` : `Age ${minAge}+`;
  }

  return lang === 'he' ? `עד גיל ${maxAge}` : `Up to age ${maxAge}`;
}
