import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SelectedPlaceNotice from './SelectedPlaceNotice';

describe('SelectedPlaceNotice', () => {
  it('renders the selected location in English', () => {
    render(
      <SelectedPlaceNotice
        lang="en"
        place={{
          address: '123 Gordon St',
          city: 'Tel Aviv',
          latitude: 32.0853,
          longitude: 34.7818,
          placeId: 'place-1',
        }}
      />,
    );

    expect(screen.getByText('Selected location')).toBeInTheDocument();
    expect(screen.getByText('123 Gordon St, Tel Aviv')).toBeInTheDocument();
  });

  it('shows the privacy note when requested', () => {
    render(
      <SelectedPlaceNotice
        lang="en"
        privacyNote
        place={{
          address: 'Herzl St',
          city: 'Rishon LeZion',
          latitude: 31.973,
          longitude: 34.7925,
          placeId: 'place-2',
        }}
      />,
    );

    expect(
      screen.getByText('This address stays private and is only used for distance calculations.'),
    ).toBeInTheDocument();
  });
});
