import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateTime } from './format';

describe('format utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats today values with the today label', () => {
    expect(formatDateTime('2026-04-23T18:30:00.000Z', 'en', 'Today', 'Tomorrow')).toContain('Today');
  });

  it('formats tomorrow values with the tomorrow label', () => {
    expect(formatDateTime('2026-04-24T18:30:00.000Z', 'en', 'Today', 'Tomorrow')).toContain('Tomorrow');
  });

  it('formats other dates with a localized full date string', () => {
    expect(formatDateTime('2026-04-27T18:30:00.000Z', 'en', 'Today', 'Tomorrow')).toContain('Monday');
    expect(formatDateTime('2026-04-27T18:30:00.000Z', 'he', 'היום', 'מחר')).toContain('יום');
  });
});
