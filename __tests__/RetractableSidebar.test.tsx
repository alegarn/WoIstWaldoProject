const mockCapturedPanRecords: PanRecord[] = [];

type PanCall = { method: string; args: unknown[] };
type PanRecord = { __type: string; calls: PanCall[] };

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

  return {
    Animated: {
      Value: MockAnimatedValue,
      timing: jest.fn(
        (value: MockAnimatedValue, config: { toValue?: number }) =>
          buildAnimation(value, config)
      ),
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
import { View } from 'react-native';
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

function renderSidebar(testIDPrefix = 't', initiallyOpen = true) {
  return render(
    <RetractableSidebar testIDPrefix={testIDPrefix} initiallyOpen={initiallyOpen} accessibilityLabel="Mode">
      <View testID={`${testIDPrefix}.child-marker`}>chip</View>
    </RetractableSidebar>
  );
}

describe('RetractableSidebar', () => {
  it('renders open with children inside the panel, container passthrough, no handle', () => {
    const screen = renderSidebar();

    const container = screen.getByTestId('t.container');
    expect(container.props.pointerEvents).toBe('box-none');
    expect(container.props.style).toContain(require('react-native').StyleSheet.absoluteFill);

    const panel = screen.getByTestId('t.panel');
    expect(within(panel).getByTestId('t.child-marker')).toBeTruthy();
    expect(screen.queryByTestId('t.handle-open')).toBeNull();
  });

  describe('A2 retract on horizontal swipe', () => {
    it('gates the pan for horizontal-only activation (either direction)', () => {
      renderSidebar();

      const record = latestPanRecord();
      expect(record).toBeTruthy();
      expect(panConfigArgs(record, 'activeOffsetX')).toEqual([[-40, 40]]);
      expect(panConfigArgs(record, 'failOffsetY')).toEqual([[-40, 40]]);
    });

    it('retracts on a rightward swipe', () => {
      const screen = renderSidebar();

      act(() => {
        panHandler(latestPanRecord(), 'onEnd')({ translationX: 60, translationY: 0 }, true);
      });

      expect(getTranslateX(screen)).toBeGreaterThan(0);
      expect(screen.getByTestId('t.handle-open')).toBeTruthy();
    });

    it('retracts on a leftward swipe', () => {
      const screen = renderSidebar();

      act(() => {
        panHandler(latestPanRecord(), 'onEnd')({ translationX: -60, translationY: 0 }, true);
      });

      expect(getTranslateX(screen)).toBeGreaterThan(0);
      expect(screen.getByTestId('t.handle-open')).toBeTruthy();
    });

    it('stays open on a vertical swipe', () => {
      const screen = renderSidebar();

      act(() => {
        panHandler(latestPanRecord(), 'onEnd')({ translationY: 60, translationX: 2 }, true);
      });

      expect(getTranslateX(screen)).toBe(0);
      expect(screen.queryByTestId('t.handle-open')).toBeNull();
    });
  });

  describe('A3 reopen + accessibility', () => {
    function renderRetracted() {
      const screen = renderSidebar();
      act(() => {
        panHandler(latestPanRecord(), 'onEnd')({ translationX: 60, translationY: 0 }, true);
      });
      return screen;
    }

    it('reopens from the handle: translateX back to 0 and handle unmounted', () => {
      const screen = renderRetracted();

      fireEvent.press(screen.getByTestId('t.handle-open'));

      expect(getTranslateX(screen)).toBe(0);
      expect(screen.queryByTestId('t.handle-open')).toBeNull();
    });

    it('exposes the retracted handle as a collapsed expand button', () => {
      const screen = renderRetracted();

      const handle = screen.getByTestId('t.handle-open');
      expect(handle.props.accessibilityRole).toBe('button');
      expect(handle.props.accessibilityState).toEqual({ expanded: false });
    });

    it('passes accessibilityLabel through to the panel', () => {
      const screen = renderSidebar();

      expect(screen.getByTestId('t.panel').props.accessibilityLabel).toBe('Mode');
    });

    it('labels the handle-open button with the sidebar accessibilityLabel', () => {
      const screen = renderRetracted();

      const handle = screen.getByTestId('t.handle-open');
      expect(handle.props.accessibilityLabel).toBe('Mode');
    });
  });
});
