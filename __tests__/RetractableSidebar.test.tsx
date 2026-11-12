const mockCapturedPanRecords: PanRecord[] = [];

type PanCall = { method: string; args: unknown[] };
type PanRecord = { __type: string; calls: PanCall[] };

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
}));

jest.mock('react-native', () => {
  const React = require('react');

  class MockAnimatedValue {
    _value: number;
    constructor(value: number) {
      this._value = value;
    }
    setValue = (nextValue: number) => {
      this._value = nextValue;
    };
    __getValue = () => this._value;
  }

  function buildAnimation(value: MockAnimatedValue, config: { toValue?: number }) {
    return {
      start: (callback?: () => void) => {
        if (typeof config?.toValue !== 'undefined') {
          value.setValue(config.toValue);
        }
        callback?.();
      },
    };
  }

  type MockAnimation = {
    start: (callback?: (result: { finished: boolean }) => void) => void;
    stop: () => void;
    reset: () => void;
  };

  return {
    Animated: {
      Value: MockAnimatedValue,
      timing: jest.fn(
        (value: MockAnimatedValue, config: { toValue?: number }) =>
          buildAnimation(value, config)
      ),
      delay: jest.fn((_duration: number): MockAnimation => ({
        start: () => {},
        stop: () => {},
        reset: () => {},
      })),
      sequence: jest.fn((animations: MockAnimation[]) => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        return {
          start: (callback?: (result: { finished: boolean }) => void) => {
            for (const animation of animations) {
              animation.start();
            }
            if (callback) {
              timer = setTimeout(() => callback({ finished: true }), 0);
            }
          },
          stop: () => {
            if (timer) {
              clearTimeout(timer);
              timer = null;
            }
          },
          reset: () => {},
        };
      }),
      View: ({ children, ...props }: any) =>
        React.createElement('AnimatedView', props, children),
    },
    Pressable: ({ children, ...props }: any) =>
      React.createElement('Pressable', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    TextInput: (props: any) => React.createElement('TextInput', props),
    Image: (props: any) => React.createElement('Image', props),
    Switch: (props: any) => React.createElement('Switch', props),
    Modal: ({ children, ...props }: any) => React.createElement('Modal', props, children),
    ScrollView: ({ children, ...props }: any) =>
      React.createElement('ScrollView', props, children),
    StyleSheet: {
      absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
      absoluteFillObject: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      },
      create: (styles: unknown) => styles,
      flatten: (style: any) => (Array.isArray(style) ? Object.assign({}, ...style) : style),
      hairlineWidth: 1,
    },
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual('react');

  function makeChainable() {
    const record: PanRecord = { __type: 'pan', calls: [] };
    const handler = {
      get(_target: unknown, prop: string | symbol) {
        if (prop === '__type' || prop === 'calls') {
          return (record as any)[prop as string];
        }
        if (prop === 'then') return undefined;
        return (...args: unknown[]) => {
          record.calls.push({ method: prop as string, args });
          return proxy;
        };
      },
    };
    const proxy: any = new Proxy(record, handler);
    mockCapturedPanRecords.push(record);
    return proxy;
  }

  return {
    Gesture: {
      Pan: () => makeChainable(),
    },
    GestureDetector: ({ children, ...props }: any) =>
      React.createElement('GestureDetector', props, children),
  };
});

import React from 'react';
import { Text, View } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';

import RetractableSidebar from '../components/UI/RetractableSidebar';

function getTranslateX(screen: { getByTestId: (id: string) => any }): number {
  const panel = screen.getByTestId('t.panel');
  const style = Array.isArray(panel.props.style) ? panel.props.style : [panel.props.style];
  for (const s of style) {
    const transform = s?.transform?.[0];
    if (transform && 'translateX' in transform) {
      return transform.translateX.__getValue();
    }
  }
  throw new Error('panel has no translateX');
}

function latestPanRecord(): PanRecord {
  return mockCapturedPanRecords[mockCapturedPanRecords.length - 1];
}

function panHandler(record: PanRecord, method: string): (...args: unknown[]) => void {
  const call = record.calls.find((c) => c.method === method);
  if (!call) throw new Error(`pan has no ${method} handler`);
  return call.args[0] as (...args: unknown[]) => void;
}

function panConfigArgs(record: PanRecord, method: string): unknown[] {
  const call = record.calls.find((c) => c.method === method);
  return call ? call.args : [];
}

type SidebarExtraProps = {
  closeButtonAccessibilityLabel?: string;
  reopenHintLabel?: string;
};

async function renderSidebar(
  testIDPrefix = 't',
  initiallyOpen = true,
  extraProps: SidebarExtraProps = {},
) {
  return await render(
    <RetractableSidebar
      testIDPrefix={testIDPrefix}
      initiallyOpen={initiallyOpen}
      accessibilityLabel="Mode"
      {...extraProps}>
      <View testID={`${testIDPrefix}.child-marker`}>
        <Text>chip</Text>
      </View>
    </RetractableSidebar>
  );
}

describe('RetractableSidebar', () => {
  it('renders open with children inside the panel, container passthrough, no handle', async () => {
    const screen = await renderSidebar();

    const container = screen.getByTestId('t.container');
    expect(container.props.pointerEvents).toBe('box-none');
    expect(container.props.style).toContain(require('react-native').StyleSheet.absoluteFill);

    const panel = screen.getByTestId('t.panel');
    expect(within(panel).getByTestId('t.child-marker')).toBeTruthy();
    expect(screen.queryByTestId('t.handle-open')).toBeNull();
  });

  describe('A2 retract on horizontal swipe', () => {
    it('gates the pan for horizontal-only activation (either direction)', async () => {
      await renderSidebar();

      const record = latestPanRecord();
      expect(record).toBeTruthy();
      expect(panConfigArgs(record, 'activeOffsetX')).toEqual([[-40, 40]]);
      expect(panConfigArgs(record, 'failOffsetY')).toEqual([[-40, 40]]);
    });

    it('retracts on a rightward swipe', async () => {
      const screen = await renderSidebar();

      await act(async () => {
        panHandler(latestPanRecord(), 'onEnd')({ translationX: 60, translationY: 0 }, true);
      });

      expect(getTranslateX(screen)).toBeGreaterThan(0);
      expect(screen.getByTestId('t.handle-open')).toBeTruthy();
    });

    it('retracts on a leftward swipe', async () => {
      const screen = await renderSidebar();

      await act(async () => {
        panHandler(latestPanRecord(), 'onEnd')({ translationX: -60, translationY: 0 }, true);
      });

      expect(getTranslateX(screen)).toBeGreaterThan(0);
      expect(screen.getByTestId('t.handle-open')).toBeTruthy();
    });

    it('stays open on a vertical swipe', async () => {
      const screen = await renderSidebar();

      await act(async () => {
        panHandler(latestPanRecord(), 'onEnd')({ translationY: 60, translationX: 2 }, true);
      });

      expect(getTranslateX(screen)).toBe(0);
      expect(screen.queryByTestId('t.handle-open')).toBeNull();
    });
  });

  describe('A3 reopen + accessibility', () => {
    async function renderRetracted() {
      const screen = await renderSidebar();
      await act(async () => {
        panHandler(latestPanRecord(), 'onEnd')({ translationX: 60, translationY: 0 }, true);
      });
      return screen;
    }

    it('reopens from the handle: translateX back to 0 and handle unmounted', async () => {
      const screen = await renderRetracted();

      await fireEvent.press(screen.getByTestId('t.handle-open'));

      expect(getTranslateX(screen)).toBe(0);
      expect(screen.queryByTestId('t.handle-open')).toBeNull();
    });

    it('exposes the retracted handle as a collapsed expand button', async () => {
      const screen = await renderRetracted();

      const handle = screen.getByTestId('t.handle-open');
      expect(handle.props.accessibilityRole).toBe('button');
      expect(handle.props.accessibilityState).toEqual({ expanded: false });
    });

    it('passes accessibilityLabel through to the panel', async () => {
      const screen = await renderSidebar();

      expect(screen.getByTestId('t.panel').props.accessibilityLabel).toBe('Mode');
    });

    it('labels the handle-open button with the sidebar accessibilityLabel', async () => {
      const screen = await renderRetracted();

      const handle = screen.getByTestId('t.handle-open');
      expect(handle.props.accessibilityLabel).toBe('Mode');
    });
  });

  describe('A4 arrow close button', () => {
    it('retracts via the arrow pinned to the panel tip: translateX to slide distance, handle mounted', async () => {
      const screen = await renderSidebar();

      const arrow = screen.getByTestId('t.handle-close');
      expect(arrow.props.accessibilityRole).toBe('button');
      expect(arrow.props.accessibilityLabel).toBe('Mode');

      await fireEvent.press(arrow);

      expect(getTranslateX(screen)).toBe(240);
      expect(screen.getByTestId('t.handle-open')).toBeTruthy();
    });

    it('labels the arrow with closeButtonAccessibilityLabel when provided', async () => {
      const screen = await renderSidebar('t', true, {
        closeButtonAccessibilityLabel: 'Close sidebar',
      });

      expect(screen.getByTestId('t.handle-close').props.accessibilityLabel).toBe('Close sidebar');
    });

    it('pins the arrow vertically centered on the panel and fully outside it', async () => {
      const screen = await renderSidebar();

      const flattened = require('react-native').StyleSheet.flatten(
        screen.getByTestId('t.handle-close').props.style
      );
      expect(flattened).toMatchObject({ left: -28, top: '50%', marginTop: -22 });
    });
  });

  describe('A5 swipe-left reopen on collapsed handle', () => {
    async function renderRetracted() {
      const screen = await renderSidebar();
      await act(async () => {
        panHandler(latestPanRecord(), 'onEnd')({ translationX: 60, translationY: 0 }, true);
      });
      return screen;
    }

    it('gates the collapsed-handle pan for horizontal-only activation', async () => {
      await renderRetracted();

      const record = latestPanRecord();
      expect(panConfigArgs(record, 'activeOffsetX')).toEqual([[-40, 40]]);
      expect(panConfigArgs(record, 'failOffsetY')).toEqual([[-40, 40]]);
    });

    it('reopens on a leftward swipe on the collapsed handle', async () => {
      const screen = await renderRetracted();

      await act(async () => {
        panHandler(latestPanRecord(), 'onEnd')({ translationX: -60, translationY: 0 }, true);
      });

      expect(getTranslateX(screen)).toBe(0);
      expect(screen.queryByTestId('t.handle-open')).toBeNull();
    });

    it('stays retracted on a rightward swipe on the collapsed handle', async () => {
      const screen = await renderRetracted();

      await act(async () => {
        panHandler(latestPanRecord(), 'onEnd')({ translationX: 60, translationY: 0 }, true);
      });

      expect(getTranslateX(screen)).toBe(240);
      expect(screen.getByTestId('t.handle-open')).toBeTruthy();
    });
  });

  describe('A7 arrow visibility + transparent reopen handle', () => {
    async function renderRetracted() {
      const screen = await renderSidebar();
      await act(async () => {
        panHandler(latestPanRecord(), 'onEnd')({ translationX: 60, translationY: 0 }, true);
      });
      return screen;
    }

    it('unmounts the arrow when retracted via swipe while keeping the reopen handle', async () => {
      const screen = await renderRetracted();

      expect(screen.queryByTestId('t.handle-close')).toBeNull();
      expect(screen.getByTestId('t.handle-open')).toBeTruthy();
    });

    it('unmounts the arrow when closed via the arrow press while keeping the reopen handle', async () => {
      const screen = await renderSidebar();

      await fireEvent.press(screen.getByTestId('t.handle-close'));

      expect(screen.queryByTestId('t.handle-close')).toBeNull();
      expect(screen.getByTestId('t.handle-open')).toBeTruthy();
    });

    it('renders the reopen handle with a transparent background', async () => {
      const screen = await renderRetracted();

      const flattened = require('react-native').StyleSheet.flatten(
        screen.getByTestId('t.handle-open').props.style
      );
      expect(flattened).toMatchObject({ backgroundColor: 'transparent' });
    });
  });

  describe('A6 transient reopen hint', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // The mock sequence defers its completion callback via setTimeout(0);
    // advancing fake timers inside act deterministically fires it.
    async function flushSequenceCompletion() {
      await act(async () => {
        jest.advanceTimersByTime(0);
        await Promise.resolve();
      });
    }

    it('shows a pointerEvents="none" hint with the reopenHintLabel while retracted', async () => {
      const screen = await renderSidebar('t', false, {
        reopenHintLabel: 'Swipe left to reopen',
      });

      const hint = screen.getByTestId('t.hint-reopen');
      expect(hint.props.pointerEvents).toBe('none');
      expect(within(hint).getByText('Swipe left to reopen')).toBeTruthy();

      await flushSequenceCompletion();
      expect(screen.queryByTestId('t.hint-reopen')).toBeNull();
    });

    it('does not render the hint when reopenHintLabel is omitted', async () => {
      const screen = await renderSidebar();
      expect(screen.queryByTestId('t.hint-reopen')).toBeNull();

      await act(async () => {
        panHandler(latestPanRecord(), 'onEnd')({ translationX: 60, translationY: 0 }, true);
      });
      expect(screen.queryByTestId('t.hint-reopen')).toBeNull();
    });

    it('unmounts the hint after its animation sequence completes', async () => {
      const screen = await renderSidebar('t', false, {
        reopenHintLabel: 'Swipe left to reopen',
      });
      expect(screen.getByTestId('t.hint-reopen')).toBeTruthy();

      await flushSequenceCompletion();

      expect(screen.queryByTestId('t.hint-reopen')).toBeNull();
    });

    it('replays the hint on each close (hint remounts per retraction)', async () => {
      const screen = await renderSidebar('t', false, {
        reopenHintLabel: 'Swipe left to reopen',
      });
      expect(screen.getByTestId('t.hint-reopen')).toBeTruthy();

      await flushSequenceCompletion();
      expect(screen.queryByTestId('t.hint-reopen')).toBeNull();

      await fireEvent.press(screen.getByTestId('t.handle-open'));
      expect(screen.queryByTestId('t.hint-reopen')).toBeNull();

      await fireEvent.press(screen.getByTestId('t.handle-close'));
      expect(screen.getByTestId('t.hint-reopen')).toBeTruthy();

      await flushSequenceCompletion();
      expect(screen.queryByTestId('t.hint-reopen')).toBeNull();
    });
  });
});
