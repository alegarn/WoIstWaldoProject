import { act, create } from 'react-test-renderer';

import * as React from 'react';

import { useTargetDrag } from '../hooks/useTargetDrag';
import type { UseTargetDragArgs, UseTargetDragSelection } from '../hooks/useTargetDrag';
import { buildSelectionFromPixels } from '../utils/targetLocation';

// RNGH mock: each Gesture.Pan() builder records method calls so tests can drive
// the onBegin/onUpdate/onFinalize callbacks with synthetic events.
type GestureRecord = { __type: string; calls: Array<{ method: string; args: any[] }> };

let mockCapturedGestures: GestureRecord[] = [];

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual('react');

  function makeChainable(record: any) {
    const handler = {
      get(_t: any, prop: string) {
        if (prop in record) {
          return (record as any)[prop];
        }
        return (...args: any[]) => {
          record.calls.push({ method: prop, args });
          return proxy;
        };
      },
    };
    const proxy = new Proxy(record, handler as any);
    return proxy;
  }

  return {
    Gesture: {
      Pan: () => {
        const record = { __type: 'pan', calls: [] as Array<{ method: string; args: any[] }> };
        mockCapturedGestures.push(record);
        return makeChainable(record);
      },
      Race: (...gs: any[]) => ({ __type: 'race', gestures: gs }),
      Exclusive: (...gs: any[]) => ({ __type: 'exclusive', gestures: gs }),
      Simultaneous: (...gs: any[]) => ({ __type: 'sim', gestures: gs }),
    },
    GestureDetector: ({ children }: any) =>
      React.createElement('GestureDetector', null, children),
    GestureHandlerRootView: ({ children }: any) =>
      React.createElement('GestureHandlerRootView', null, children),
  };
});

jest.mock('../utils/targetLocation', () => ({
  buildSelectionFromPixels: jest.fn(),
}));

const mockedBuildSelectionFromPixels = buildSelectionFromPixels as unknown as jest.Mock;

function findCall(record: GestureRecord | undefined, method: string) {
  return record?.calls.find((c) => c.method === method);
}

let captured: any;

function Probe(props: UseTargetDragArgs) {
  captured = useTargetDrag(props);
  return null;
}

const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 640;
const IMAGE_DIMS = { width: 200, height: 100 };

const centeredSelection: UseTargetDragSelection = {
  location: { x: '0.50', y: '0.50' },
  target: {
    targetSize: 16,
    targetStyle: { position: 'absolute', left: 92, top: 42, width: 16, height: 16 },
  },
};

const draggedSelection: UseTargetDragSelection = {
  location: { x: '0.55', y: '0.50' },
  target: {
    targetSize: 16,
    targetStyle: { position: 'absolute', left: 102, top: 42, width: 16, height: 16 },
  },
};

const altSelection: UseTargetDragSelection = {
  location: { x: '0.25', y: '0.25' },
  target: {
    targetSize: 16,
    targetStyle: { position: 'absolute', left: 42, top: 17, width: 16, height: 16 },
  },
};

function defaultProps(overrides: Partial<UseTargetDragArgs> = {}): UseTargetDragArgs {
  return {
    enabled: true,
    screenWidth: SCREEN_WIDTH,
    screenHeight: SCREEN_HEIGHT,
    imageDimensionStyle: IMAGE_DIMS,
    initialSelection: centeredSelection,
    ...overrides,
  };
}

function renderProbe(props: UseTargetDragArgs) {
  return create(React.createElement(Probe, props));
}

function updateProbe(renderer: any, props: UseTargetDragArgs) {
  renderer.update(React.createElement(Probe, props));
}

describe('useTargetDrag', () => {
  let renderer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    captured = undefined;
    mockCapturedGestures.length = 0;
    renderer = undefined;
    mockedBuildSelectionFromPixels.mockReturnValue(draggedSelection);
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer.unmount();
      });
      renderer = undefined;
    }
  });

  it('returns gesture=undefined, null touchLocation, null target, and builds no Pan gesture when enabled=false', () => {
    act(() => {
      renderer = renderProbe(defaultProps({ enabled: false, initialSelection: null }));
    });

    expect(captured.gesture).toBeUndefined();
    expect(captured.touchLocation).toBeNull();
    expect(captured.target).toBeNull();
    expect(mockCapturedGestures).toHaveLength(0);
  });

  it('initializes touchLocation and target from initialSelection when enabled=true', () => {
    act(() => {
      renderer = renderProbe(defaultProps());
    });

    expect(captured.touchLocation).toEqual({ x: '0.50', y: '0.50' });
    expect(captured.target).toEqual(centeredSelection.target);
    expect(mockCapturedGestures).toHaveLength(1);
    expect(mockCapturedGestures[0].__type).toBe('pan');
  });

  it('configures the Pan gesture with .enabled(true) and onBegin/onUpdate/onFinalize handlers', () => {
    act(() => {
      renderer = renderProbe(defaultProps());
    });

    const record = mockCapturedGestures[0];
    expect(findCall(record, 'enabled')?.args[0]).toBe(true);
    expect(findCall(record, 'onBegin')).toBeTruthy();
    expect(findCall(record, 'onUpdate')).toBeTruthy();
    expect(findCall(record, 'onFinalize')).toBeTruthy();
  });

  it('exposes the RNGH-built Pan gesture object on the returned hook result', () => {
    act(() => {
      renderer = renderProbe(defaultProps());
    });

    expect(captured.gesture).toBeTruthy();
    expect((captured.gesture as GestureRecord).__type).toBe('pan');
  });

  it('onBegin sets dragStart from current target center and calls onInteract', () => {
    const onInteract = jest.fn();
    act(() => {
      renderer = renderProbe(defaultProps({ onInteract }));
    });

    const onBegin = findCall(mockCapturedGestures[0], 'onBegin')!.args[0];

    act(() => {
      onBegin();
    });

    expect(onInteract).toHaveBeenCalledTimes(1);
  });

  it('onUpdate(translationX=10, translationY=0) calls buildSelectionFromPixels with clamp(dragStart.x + 10, 0, dims.width)', () => {
    act(() => {
      renderer = renderProbe(defaultProps());
    });

    const record = mockCapturedGestures[0];
    const onBegin = findCall(record, 'onBegin')!.args[0];
    const onUpdate = findCall(record, 'onUpdate')!.args[0];

    act(() => {
      onBegin();
      onUpdate({ translationX: 10, translationY: 0 });
    });

    expect(mockedBuildSelectionFromPixels).toHaveBeenCalledWith({
      locationX: 110,
      locationY: 50,
      screenWidth: SCREEN_WIDTH,
      screenHeight: SCREEN_HEIGHT,
      imageDimensionStyle: IMAGE_DIMS,
    });
    expect(captured.touchLocation).toEqual({ x: '0.55', y: '0.50' });
    expect(captured.target).toEqual(draggedSelection.target);
  });

  it('onFinalize(translationX=2, translationY=2) calls onTap (moved < TAP_THRESHOLD=8)', () => {
    const onTap = jest.fn();
    act(() => {
      renderer = renderProbe(defaultProps({ onTap }));
    });

    const record = mockCapturedGestures[0];
    const onBegin = findCall(record, 'onBegin')!.args[0];
    const onFinalize = findCall(record, 'onFinalize')!.args[0];

    act(() => {
      onBegin();
      onFinalize({ translationX: 2, translationY: 2 });
    });

    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('onFinalize(translationX=30, translationY=0) does NOT call onTap (moved >= TAP_THRESHOLD)', () => {
    const onTap = jest.fn();
    act(() => {
      renderer = renderProbe(defaultProps({ onTap }));
    });

    const record = mockCapturedGestures[0];
    const onBegin = findCall(record, 'onBegin')!.args[0];
    const onFinalize = findCall(record, 'onFinalize')!.args[0];

    act(() => {
      onBegin();
      onFinalize({ translationX: 30, translationY: 0 });
    });

    expect(onTap).not.toHaveBeenCalled();
  });

  it('resets to a new initialSelection when it changes before any user interaction', () => {
    act(() => {
      renderer = renderProbe(defaultProps({ initialSelection: centeredSelection }));
    });

    expect(captured.touchLocation).toEqual({ x: '0.50', y: '0.50' });

    act(() => {
      updateProbe(renderer, defaultProps({ initialSelection: altSelection }));
    });

    expect(captured.touchLocation).toEqual({ x: '0.25', y: '0.25' });
    expect(captured.target).toEqual(altSelection.target);
  });

  it('does NOT reset after the user has interacted (userInteractedRef guard)', () => {
    act(() => {
      renderer = renderProbe(defaultProps({ initialSelection: centeredSelection }));
    });

    const record = mockCapturedGestures[0];
    const onBegin = findCall(record, 'onBegin')!.args[0];
    const onUpdate = findCall(record, 'onUpdate')!.args[0];

    act(() => {
      onBegin();
      onUpdate({ translationX: 10, translationY: 0 });
    });

    expect(captured.touchLocation).toEqual({ x: '0.55', y: '0.50' });

    act(() => {
      updateProbe(renderer, defaultProps({ initialSelection: altSelection }));
    });

    expect(captured.touchLocation).toEqual({ x: '0.55', y: '0.50' });
    expect(captured.target).toEqual(draggedSelection.target);
  });

  it('setSelection directly updates touchLocation and target (e2e path)', () => {
    act(() => {
      renderer = renderProbe(defaultProps({ enabled: false, initialSelection: null }));
    });

    expect(captured.touchLocation).toBeNull();
    expect(captured.target).toBeNull();

    act(() => {
      captured.setSelection(altSelection);
    });

    expect(captured.touchLocation).toEqual({ x: '0.25', y: '0.25' });
    expect(captured.target).toEqual(altSelection.target);
  });

  it('cleans up on unmount without warnings', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    act(() => {
      renderer = renderProbe(defaultProps());
    });

    act(() => {
      renderer.unmount();
    });
    renderer = undefined;

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
