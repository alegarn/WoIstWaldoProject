import React from 'react';
import { act, create } from 'react-test-renderer';

import { useSpeedTimer, TIMER_TICK_MS } from '../hooks/useSpeedTimer';

let captured: ReturnType<typeof useSpeedTimer> | undefined;

function Probe({ active }: { active: boolean }) {
  captured = useSpeedTimer({ active });
  return null;
}

function mount(active: boolean) {
  return create(React.createElement(Probe, { active }));
}

function update(renderer: ReturnType<typeof create>, active: boolean) {
  renderer.update(React.createElement(Probe, { active }));
}

describe('useSpeedTimer', () => {
  let renderer: ReturnType<typeof create> | undefined;

  beforeEach(() => {
    captured = undefined;
    renderer = undefined;
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer!.unmount();
      });
      renderer = undefined;
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns elapsedMs=0 and never advances while active is false', () => {
    act(() => {
      renderer = mount(false);
    });

    expect(captured!.elapsedMs).toBe(0);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(captured!.elapsedMs).toBe(0);
  });

  it('starts the interval when active flips to true and increments each tick', () => {
    act(() => {
      renderer = mount(false);
    });

    act(() => {
      update(renderer!, true);
    });

    expect(captured!.elapsedMs).toBe(0);

    act(() => {
      jest.advanceTimersByTime(TIMER_TICK_MS);
    });

    expect(captured!.elapsedMs).toBe(TIMER_TICK_MS);

    act(() => {
      jest.advanceTimersByTime(TIMER_TICK_MS);
    });

    expect(captured!.elapsedMs).toBe(TIMER_TICK_MS * 2);
  });

  it('clears the interval on pause and holds the accumulated elapsedMs', () => {
    act(() => {
      renderer = mount(true);
    });

    act(() => {
      jest.advanceTimersByTime(TIMER_TICK_MS);
    });

    expect(captured!.elapsedMs).toBe(TIMER_TICK_MS);

    act(() => {
      update(renderer!, false);
    });

    const paused = captured!.elapsedMs;
    expect(paused).toBe(TIMER_TICK_MS);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(captured!.elapsedMs).toBe(paused);
  });

  it('resumes from the accumulated value across pause/resume without resetting', () => {
    act(() => {
      renderer = mount(true);
    });

    act(() => {
      jest.advanceTimersByTime(TIMER_TICK_MS);
    });
    expect(captured!.elapsedMs).toBe(TIMER_TICK_MS);

    act(() => {
      update(renderer!, false);
    });

    act(() => {
      update(renderer!, true);
    });

    act(() => {
      jest.advanceTimersByTime(TIMER_TICK_MS);
    });

    expect(captured!.elapsedMs).toBe(TIMER_TICK_MS * 2);
  });

  it('clears the interval on unmount without warnings', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    act(() => {
      renderer = mount(true);
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(() => {
      act(() => {
        renderer!.unmount();
      });
    }).not.toThrow();
    renderer = undefined;

    expect(() => {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }).not.toThrow();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('at exactly one tick, elapsedMs reflects Date.now() - runStart deterministically', () => {
    jest.setSystemTime(0);

    act(() => {
      renderer = mount(true);
    });

    act(() => {
      jest.advanceTimersByTime(TIMER_TICK_MS);
    });

    expect(captured!.elapsedMs).toBe(TIMER_TICK_MS);
    expect(captured!.elapsedMs).toBeGreaterThan(TIMER_TICK_MS - 1);
  });
});
