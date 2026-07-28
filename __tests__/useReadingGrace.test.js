import React from 'react';
import { act, create } from 'react-test-renderer';

import { useReadingGrace } from '../hooks/useReadingGrace';

let captured;
function Probe({ enabled, graceMs }) {
  captured = useReadingGrace({ enabled, graceMs });
  return null;
}

describe('useReadingGrace', () => {
  let renderer;

  beforeEach(() => {
    captured = undefined;
    renderer = undefined;
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer.unmount();
      });
      renderer = undefined;
    }
    jest.useRealTimers();
  });

  it('returns graceDone=true immediately when enabled is false', () => {
    act(() => {
      renderer = create(<Probe enabled={false} />);
    });

    expect(captured.graceDone).toBe(true);
    expect(typeof captured.markClosed).toBe('function');
  });

  it('returns graceDone=false initially when enabled is true', () => {
    act(() => {
      renderer = create(<Probe enabled={true} graceMs={3000} />);
    });

    expect(captured.graceDone).toBe(false);
  });

  it('completes the grace after graceMs elapses', () => {
    act(() => {
      renderer = create(<Probe enabled={true} graceMs={3000} />);
    });

    expect(captured.graceDone).toBe(false);

    act(() => {
      jest.advanceTimersByTime(2999);
    });
    expect(captured.graceDone).toBe(false);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(captured.graceDone).toBe(true);
  });

  it('completes the grace immediately when markClosed is called before the timeout', () => {
    act(() => {
      renderer = create(<Probe enabled={true} graceMs={3000} />);
    });

    expect(captured.graceDone).toBe(false);

    act(() => {
      captured.markClosed();
    });
    expect(captured.graceDone).toBe(true);

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(captured.graceDone).toBe(true);
  });

  it('markClosed is idempotent', () => {
    act(() => {
      renderer = create(<Probe enabled={true} graceMs={3000} />);
    });

    expect(() => {
      act(() => {
        captured.markClosed();
        captured.markClosed();
      });
    }).not.toThrow();

    expect(captured.graceDone).toBe(true);
  });

  it('clears the timeout on unmount (no warnings)', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    act(() => {
      renderer = create(<Probe enabled={true} graceMs={3000} />);
    });

    act(() => {
      renderer.unmount();
    });
    renderer = undefined;

    expect(() => {
      act(() => {
        jest.advanceTimersByTime(5000);
      });
    }).not.toThrow();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
