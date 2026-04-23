import { describe, expect, it } from 'vitest';
import { getProfileSkillBadgeStyle } from './profileSkillBadges';

describe('profileSkillBadges', () => {
  it('matches known English skill themes', () => {
    expect(getProfileSkillBadgeStyle('Clinical finishing')).toMatchObject({
      icon: '🥅',
      chipClassName: expect.stringContaining('amber'),
    });

    expect(getProfileSkillBadgeStyle('Elite dribble control')).toMatchObject({
      icon: '🪄',
      chipClassName: expect.stringContaining('fuchsia'),
    });

    expect(getProfileSkillBadgeStyle('Strong leadership')).toMatchObject({
      icon: '👑',
      chipClassName: expect.stringContaining('orange'),
    });
  });

  it('matches Hebrew and trimmed labels too', () => {
    expect(getProfileSkillBadgeStyle('  שוער  ')).toMatchObject({
      icon: '🧤',
      countClassName: expect.stringContaining('cyan'),
    });

    expect(getProfileSkillBadgeStyle('תקשורת קבוצתית')).toMatchObject({
      icon: '🤝',
      chipClassName: expect.stringContaining('rose'),
    });
  });

  it('falls back to the default theme for unknown skills', () => {
    expect(getProfileSkillBadgeStyle('Composure under pressure')).toEqual({
      icon: '⭐',
      chipClassName: 'border-primary-200 bg-primary-50 text-primary-900',
      countClassName: 'bg-white/80 text-primary-700',
    });
  });
});
