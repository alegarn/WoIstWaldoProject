import React from 'react';
import { act, create } from 'react-test-renderer';

import ScoreCelebration from '../components/Results/ScoreCelebration';

describe('ScoreCelebration', () => {
  const testIDPrefix = 'celebration';

  function render(props) {
    let renderer;

    act(() => {
      renderer = create(
        <ScoreCelebration testIDPrefix={testIDPrefix} {...props} />
      );
    });

    return renderer;
  }

  it('renders "+1 point" using the default points value', () => {
    const renderer = render();

    const score = renderer.root.findByProps({
      testID: `${testIDPrefix}.score`,
    });

    expect(score.props.children).toBe('+1 point');
  });

  it('renders "+3 points" when points is 3', () => {
    const renderer = render({ points: 3 });

    const score = renderer.root.findByProps({
      testID: `${testIDPrefix}.score`,
    });

    expect(score.props.children).toBe('+3 points');
  });

  it('renders the party favors wrapper', () => {
    const renderer = render();

    const favors = renderer.root.findByProps({
      testID: `${testIDPrefix}.favors`,
    });

    expect(favors).toBeTruthy();
  });

  it('mounts without crashing and starts the celebration animation', () => {
    let renderer;

    act(() => {
      renderer = create(
        <ScoreCelebration testIDPrefix={testIDPrefix} points={5} />
      );
    });

    const score = renderer.root.findByProps({
      testID: `${testIDPrefix}.score`,
    });

    expect(score.props.children).toBe('+5 points');
  });
});
