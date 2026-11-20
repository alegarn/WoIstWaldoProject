import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import GuessExhaustedPanel from '../components/Guess/GuessExhaustedPanel';

describe('GuessExhaustedPanel', () => {
  it('renders the panel, default title, and both buttons with the required testIDs', async () => {
    const { getByTestId, getByText } = await render(
      <GuessExhaustedPanel onSwitch={jest.fn()} onLeave={jest.fn()} />,
    );

    expect(getByTestId('guess-exhausted-panel')).toBeTruthy();
    expect(getByText('No more cards')).toBeTruthy();
    expect(getByTestId('guess-exhausted-switch')).toBeTruthy();
    expect(getByText('Switch category')).toBeTruthy();
    expect(getByTestId('guess-exhausted-leave')).toBeTruthy();
    expect(getByText('Leave game')).toBeTruthy();
  });

  it('calls onSwitch exactly once when "Switch category" is tapped', async () => {
    const onSwitch = jest.fn();
    const { getByTestId } = await render(
      <GuessExhaustedPanel onSwitch={onSwitch} onLeave={jest.fn()} />,
    );

    await fireEvent.press(getByTestId('guess-exhausted-switch'));

    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it('calls onLeave exactly once when "Leave game" is tapped', async () => {
    const onLeave = jest.fn();
    const { getByTestId } = await render(
      <GuessExhaustedPanel onSwitch={jest.fn()} onLeave={onLeave} />,
    );

    await fireEvent.press(getByTestId('guess-exhausted-leave'));

    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('renders the provided streak value', async () => {
    const { getByTestId, getByText } = await render(
      <GuessExhaustedPanel onSwitch={jest.fn()} onLeave={jest.fn()} streak={7} />,
    );

    expect(getByTestId('guess-exhausted-streak')).toBeTruthy();
    expect(getByText('Streak: 7')).toBeTruthy();
  });

  it('does not render the streak block when streak is omitted', async () => {
    const { queryByTestId } = await render(
      <GuessExhaustedPanel onSwitch={jest.fn()} onLeave={jest.fn()} />,
    );

    expect(queryByTestId('guess-exhausted-streak')).toBeNull();
  });

  it('renders the custom message override as the title instead of the default', async () => {
    const { getByText, queryByText } = await render(
      <GuessExhaustedPanel
        onSwitch={jest.fn()}
        onLeave={jest.fn()}
        message="All caught up!"
      />,
    );

    expect(getByText('All caught up!')).toBeTruthy();
    expect(queryByText('No more cards')).toBeNull();
  });
});
