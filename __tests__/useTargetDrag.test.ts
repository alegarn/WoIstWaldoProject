import React from 'react';
import { act, create } from 'react-test-renderer';

import { useTargetDrag } from '../hooks/useTargetDrag';
import type { UseTargetDragArgs, UseTargetDragSelection } from '../hooks/useTargetDrag';
import { buildSelectionFromPixels } from '../utils/targetLocation';

let capturedPanResponder: any;

jest.mock('react-native', () => ({
  PanResponder: {
    create: jest.fn((config: any) => {
      capturedPanResponder = config;
      return { panHandlers: { testID: 'mock-target-pan-handlers' } };
    }),
  },
}));

jest.mock('../utils/targetLocation', () => ({
  buildSelectionFromPixels: jest.fn(),
}));

const mockedBuildSelectionFromPixels = buildSelectionFromPixels as unknown as jest.Mock;
const mockedPanResponderCreate = (require('react-native') as any).PanResponder.create as jest.Mock;

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
    capturedPanResponder = undefined;
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

  it('returns panHandlers=undefined, null touchLocation, null target, and does not call PanResponder.create when enabled=false', () => {
    act(() => {
      renderer = renderProbe(defaultProps({ enabled: false, initialSelection: null }));
    });

    expect(captured.panHandlers).toBeUndefined();
    expect(captured.touchLocation).toBeNull();
    expect(captured.target).toBeNull();
    expect(mockedPanResponderCreate).not.toHaveBeenCalled();
  });

  it('initializes touchLocation and target from initialSelection when enabled=true', () => {
    act(() => {
      renderer = renderProbe(defaultProps());
    });

    expect(captured.touchLocation).toEqual({ x: '0.50', y: '0.50' });
    expect(captured.target).toEqual(centeredSelection.target);
    expect(captured.panHandlers).toEqual({ testID: 'mock-target-pan-handlers' });
    expect(mockedPanResponderCreate).toHaveBeenCalledTimes(1);
  });

  it('on grant + move(dx=10, dy=0) calls buildSelectionFromPixels with clamp(dragStart.x + 10, 0, dims.width) and clamp(dragStart.y + 0, 0, dims.height)', () => {
    act(() => {
      renderer = renderProbe(defaultProps());
    });

    act(() => {
      capturedPanResponder.onPanResponderGrant(null, { dx: 0, dy: 0 });
      capturedPanResponder.onPanResponderMove(null, { dx: 10, dy: 0 });
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

  it('on grant + release(dx=2, dy=2) calls onTap (moved < TAP_THRESHOLD=8)', () => {
    const onTap = jest.fn();
    act(() => {
      renderer = renderProbe(defaultProps({ onTap }));
    });

    act(() => {
      capturedPanResponder.onPanResponderGrant(null, { dx: 0, dy: 0 });
      capturedPanResponder.onPanResponderRelease(null, { dx: 2, dy: 2 });
    });

    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('on grant + release(dx=30, dy=0) does NOT call onTap (moved >= TAP_THRESHOLD)', () => {
    const onTap = jest.fn();
    act(() => {
      renderer = renderProbe(defaultProps({ onTap }));
    });

    act(() => {
      capturedPanResponder.onPanResponderGrant(null, { dx: 0, dy: 0 });
      capturedPanResponder.onPanResponderRelease(null, { dx: 30, dy: 0 });
    });

    expect(onTap).not.toHaveBeenCalled();
  });

  it('onPanResponderGrant calls onInteract when provided', () => {
    const onInteract = jest.fn();
    act(() => {
      renderer = renderProbe(defaultProps({ onInteract }));
    });

    act(() => {
      capturedPanResponder.onPanResponderGrant(null, { dx: 0, dy: 0 });
    });

    expect(onInteract).toHaveBeenCalledTimes(1);
  });

  it('onStartShouldSetPanResponderCapture returns true', () => {
    act(() => {
      renderer = renderProbe(defaultProps());
    });

    expect(capturedPanResponder.onStartShouldSetPanResponderCapture()).toBe(true);
  });

  it('onPanResponderTerminationRequest returns false', () => {
    act(() => {
      renderer = renderProbe(defaultProps());
    });

    expect(capturedPanResponder.onPanResponderTerminationRequest()).toBe(false);
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

    act(() => {
      capturedPanResponder.onPanResponderGrant(null, { dx: 0, dy: 0 });
      capturedPanResponder.onPanResponderMove(null, { dx: 10, dy: 0 });
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
