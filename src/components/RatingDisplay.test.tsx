import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RatingDisplay, { RatingBadge } from './RatingDisplay';

describe('RatingDisplay', () => {
  it('shows the numeric rating and optional label by default', () => {
    render(<RatingDisplay rating={7.4} label="Skill level" />);

    expect(screen.getByText('7.4')).toBeInTheDocument();
    expect(screen.getByText('Skill level')).toBeInTheDocument();
  });

  it('can hide the numeric rating while still rendering the label', () => {
    render(<RatingDisplay rating={3.2} showNumber={false} label="Hidden score" />);

    expect(screen.queryByText('3.2')).not.toBeInTheDocument();
    expect(screen.getByText('Hidden score')).toBeInTheDocument();
  });
});

describe('RatingBadge', () => {
  it('formats the rating to one decimal place', () => {
    render(<RatingBadge rating={6} size="sm" />);

    expect(screen.getByText('6.0')).toBeInTheDocument();
  });
});
