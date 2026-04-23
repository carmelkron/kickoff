import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SkillBadge from './SkillBadge';

vi.mock('../contexts/LanguageContext', () => ({
  useLang: () => ({
    t: {
      skillLevel: {
        beginner: 'Beginner',
        intermediate: 'Intermediate',
        advanced: 'Advanced',
        mixed: 'Mixed',
      },
    },
  }),
}));

describe('SkillBadge', () => {
  it('renders the translated skill label for the given level', () => {
    render(<SkillBadge level="advanced" />);

    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('supports the compact size variant', () => {
    render(<SkillBadge level="mixed" size="sm" />);

    expect(screen.getByText('Mixed')).toBeInTheDocument();
  });
});
