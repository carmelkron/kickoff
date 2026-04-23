import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import AutocompleteInput from './AutocompleteInput';

function AutocompleteHarness({
  options,
  initialValue = '',
}: {
  options: string[];
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <AutocompleteInput
      value={value}
      onChange={setValue}
      options={options}
      placeholder="Search cities"
      aria-label="Search cities"
    />
  );
}

describe('AutocompleteInput', () => {
  it('filters matching options, excludes the exact value, and lets the user pick one', async () => {
    const user = userEvent.setup();
    render(
      <AutocompleteHarness
        options={['Tel Aviv', 'Tel Mond', 'Jerusalem', 'Tiberias']}
      />,
    );

    const input = screen.getByLabelText('Search cities');
    await user.type(input, 'Te');

    expect(screen.getByText('Tel Aviv')).toBeInTheDocument();
    expect(screen.getByText('Tel Mond')).toBeInTheDocument();
    expect(screen.queryByText('Jerusalem')).not.toBeInTheDocument();

    await user.click(screen.getByText('Tel Mond'));

    expect(input).toHaveValue('Tel Mond');
    expect(screen.queryByText('Tel Aviv')).not.toBeInTheDocument();
  });

  it('reopens suggestions on focus and closes them when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <AutocompleteHarness options={['Haifa', 'Hadera']} initialValue="Ha" />
        <button type="button">Outside</button>
      </div>,
    );

    expect(screen.getByText('Haifa')).toBeInTheDocument();
    expect(screen.getByText('Hadera')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByText('Haifa')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Search cities'));
    expect(screen.getByText('Haifa')).toBeInTheDocument();
  });

  it('limits the suggestion list to eight items', async () => {
    const user = userEvent.setup();
    const options = Array.from({ length: 10 }, (_, index) => `City ${index}`);
    render(<AutocompleteHarness options={options} />);

    await user.type(screen.getByLabelText('Search cities'), 'C');

    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(screen.queryByText('City 8')).not.toBeInTheDocument();
  });
});
