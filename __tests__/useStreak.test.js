import React from 'react';
import { act, create } from 'react-test-renderer';

import { useStreak } from '../hooks/useStreak';

let captured;
function Probe({ initial }) {
  captured = useStreak(initial);
  return null;
}

describe('useStreak', () => {
  let renderer;

  beforeEach(() => {
    captured = undefined;
    renderer = undefined;
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer.unmount();
      });
      renderer = undefined;
    }
  });

  it('starts at streak 0 by default and increments on each onWin', () => {
    act(() => {
      renderer = create(<Probe />);
    });

    expect(captured.streak).toBe(0);

    act(() => {
      captured.onWin();
    });
    expect(captured.streak).toBe(1);

    act(() => {
      captured.onWin();
    });
    expect(captured.streak).toBe(2);
  });

  it('resets to 0 on onLose and resumes from 1 on the next win', () => {
    act(() => {
      renderer = create(<Probe />);
    });

    act(() => {
      captured.onWin();
      captured.onWin();
    });
    expect(captured.streak).toBe(2);

    act(() => {
      captured.onLose();
    });
    expect(captured.streak).toBe(0);

    act(() => {
      captured.onWin();
    });
    expect(captured.streak).toBe(1);
  });

  it('derives multiplier from the tier at each step', () => {
    act(() => {
      renderer = create(<Probe />);
    });

    expect(captured.multiplier).toBe(1.0);
    expect(captured.tier.tier).toBe(0);

    act(() => {
      captured.onWin();
      captured.onWin();
      captured.onWin();
    });
    expect(captured.streak).toBe(3);
    expect(captured.tier.tier).toBe(1);
    expect(captured.tier.label).toBe('Focused');
    expect(captured.multiplier).toBe(2.0);

    act(() => {
      captured.onWin();
      captured.onWin();
      captured.onWin();
      captured.onWin();
    });
    expect(captured.streak).toBe(7);
    expect(captured.tier.tier).toBe(2);
    expect(captured.multiplier).toBe(3.0);
  });

  it('reset() returns streak to 0 and clears the tier', () => {
    act(() => {
      renderer = create(<Probe />);
    });

    act(() => {
      captured.onWin();
      captured.onWin();
      captured.onWin();
    });
    expect(captured.streak).toBe(3);

    act(() => {
      captured.reset();
    });
    expect(captured.streak).toBe(0);
    expect(captured.tier.tier).toBe(0);
    expect(captured.multiplier).toBe(1.0);
  });

  it('keeps onWin/onLose/reset referentially stable across re-renders', () => {
    act(() => {
      renderer = create(<Probe />);
    });

    const firstOnWin = captured.onWin;
    const firstOnLose = captured.onLose;
    const firstReset = captured.reset;

    act(() => {
      captured.onWin();
    });

    expect(captured.onWin).toBe(firstOnWin);
    expect(captured.onLose).toBe(firstOnLose);
    expect(captured.reset).toBe(firstReset);
  });

  it('honours an initial streak argument and derives its tier', () => {
    act(() => {
      renderer = create(<Probe initial={5} />);
    });

    expect(captured.streak).toBe(5);
    expect(captured.tier.tier).toBe(1);
    expect(captured.multiplier).toBe(2.0);
  });
});
