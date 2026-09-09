const mockGameInstructions = jest.fn(() => null);
const mockShowPicture = jest.fn(() => null);

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 320, height: 640, scale: 1, fontScale: 1 })),
  },
  Image: {
    resolveAssetSource: jest.fn(() => ({ uri: 'file:///asset.jpg', width: 320, height: 320 })),
  },
}));

let mockCapturedGestureCallbacks;
let mockCapturedGesture;

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual('react');

  function makeChainable() {
    const record = { __type: 'pan', calls: [] };
    const handler = {
      get(_t, prop) {
        if (prop in record) return record[prop];
        return (...args) => {
          record.calls.push({ method: prop, args });
          return proxy;
        };
      },
    };
    const proxy = new Proxy(record, handler);
    mockCapturedGesture = proxy;
    mockCapturedGestureCallbacks = record;
    return proxy;
  }
  return {
    Gesture: {
      Pan: () => makeChainable(),
      Race: (...gs) => ({ __type: 'race', gestures: gs }),
      Exclusive: (...gs) => ({ __type: 'exclusive', gestures: gs }),
      Simultaneous: (...gs) => ({ __type: 'sim', gestures: gs }),
    },
    GestureDetector: ({ children, ...props }) =>
      React.createElement('GestureDetector', props, children),
    GestureHandlerRootView: ({ children, ...props }) =>
      React.createElement('GestureHandlerRootView', props, children),
  };
});

jest.mock('../components/Instructions/GameInstructions', () => {
  return function MockGameInstructions(props) {
    mockGameInstructions(props);
    return null;
  };
});

jest.mock('../components/Picture/ShowPicture', () => {
  return function MockShowPicture(props) {
    mockShowPicture(props);
    return null;
  };
});

jest.mock('../utils/orientation', () => ({
  handleImageOrientation: jest.fn(),
}));

jest.mock('../utils/imageDimensions', () => ({
  setImageDimensions: jest.fn(() => ({
    maxImageHeight: 100,
    maxImageWidth: 200,
  })),
}));

jest.mock('expo-file-system', () => ({
  __esModule: true,
  File: class MockFile {
    exists = false;
    delete() {}
  },
  Paths: {
    get cache() {
      return { uri: 'file:///cache/', list: () => [] };
    },
  },
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import GuessPicture from '../components/Picture/GuessPicture';

function setE2EMode(enabled) {
  process.env.EXPO_PUBLIC_E2E_MODE = enabled ? 'true' : 'false';
}

describe('GuessPicture', () => {
  const originalE2EEnv = process.env.EXPO_PUBLIC_E2E_MODE;

  afterAll(() => {
    if (originalE2EEnv === undefined) {
      delete process.env.EXPO_PUBLIC_E2E_MODE;
    } else {
      process.env.EXPO_PUBLIC_E2E_MODE = originalE2EEnv;
    }
  });

  const baseProps = {
    imageFile: 'file:///guess.jpg',
    description: 'Find the hidden point',
    imageIsPortrait: false,
    imageHeight: 240,
    imageWidth: 320,
    hiddenLocation: { x: 0.58, y: 0.46 },
    screenDimensions: { width: 320, height: 640 },
    toAdScreen: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setE2EMode(true);
    mockCapturedGestureCallbacks = undefined;
    mockCapturedGesture = undefined;
  });

  const activeRenderers = [];

  afterEach(() => {
    while (activeRenderers.length) {
      const renderer = activeRenderers.pop();
      try {
        act(() => { renderer.unmount(); });
      } catch (_) {
        // already unmounted
      }
    }
  });

  function getLatestShowPictureProps() {
    return mockShowPicture.mock.calls[mockShowPicture.mock.calls.length - 1][0];
  }

  async function renderToPicture(overrides = {}) {
    let renderer;

    await act(async () => {
      renderer = create(<GuessPicture {...baseProps} {...overrides} />);
    });
    activeRenderers.push(renderer);

    await act(async () => {
      const instructionsProps = mockGameInstructions.mock.calls[mockGameInstructions.mock.calls.length - 1][0];
      instructionsProps.handleFilterClick();
    });

    return renderer;
  }

  it('in non-e2e mode, initializes the target at the picture center on mount', async () => {
    setE2EMode(false);

    await renderToPicture();

    const pictureProps = getLatestShowPictureProps();
    expect(pictureProps.touchLocation).toEqual({ x: '0.50', y: '0.50' });
    expect(pictureProps.target.targetSize).toBe(16);
    expect(pictureProps.target.targetStyle).toEqual(expect.objectContaining({ left: 92, top: 42 }));
    expect(pictureProps.targetGesture).toBeTruthy();
    expect(mockCapturedGestureCallbacks.__type).toBe('pan');
  });

  it('in non-e2e mode, dragging the target moves it and updates the fractional location', async () => {
    setE2EMode(false);

    await renderToPicture();

    const record = mockCapturedGestureCallbacks;
    const onBegin = record.calls.find((c) => c.method === 'onBegin').args[0];
    const onUpdate = record.calls.find((c) => c.method === 'onUpdate').args[0];

    await act(async () => {
      onBegin();
      onUpdate({ translationX: 10, translationY: 0 });
    });

    const pictureProps = getLatestShowPictureProps();
    expect(pictureProps.touchLocation).toEqual({ x: '0.55', y: '0.50' });
    expect(pictureProps.target.targetSize).toBe(16);
    expect(pictureProps.target.targetStyle).toEqual(expect.objectContaining({ left: 102, top: 42 }));
  });

  it('in non-e2e mode, ships the dragged location to toAdScreen on confirm', async () => {
    setE2EMode(false);
    const toAdScreen = jest.fn();

    await renderToPicture({ toAdScreen });

    const record = mockCapturedGestureCallbacks;
    const onBegin = record.calls.find((c) => c.method === 'onBegin').args[0];
    const onUpdate = record.calls.find((c) => c.method === 'onUpdate').args[0];

    await act(async () => {
      onBegin();
      onUpdate({ translationX: 10, translationY: 0 });
    });

    await act(async () => {
      getLatestShowPictureProps().handleConfirm();
    });

    expect(toAdScreen).toHaveBeenCalledTimes(1);
    expect(toAdScreen).toHaveBeenCalledWith({
      location: { x: '0.55', y: '0.50' },
      hiddenLocation: { x: 0.58, y: 0.46 },
      screenWidth: 320,
      screenHeight: 640,
      target: expect.objectContaining({
        targetSize: 16,
        targetStyle: expect.objectContaining({ left: 102, top: 42 }),
      }),
      elapsedMs: expect.any(Number),
    });
  });

  it('in non-e2e mode, opens the confirm modal when the target is tapped without dragging', async () => {
    setE2EMode(false);

    await renderToPicture();

    expect(getLatestShowPictureProps().showModal).toBe(false);

    const record = mockCapturedGestureCallbacks;
    const onBegin = record.calls.find((c) => c.method === 'onBegin').args[0];
    const onFinalize = record.calls.find((c) => c.method === 'onFinalize').args[0];

    await act(async () => {
      onBegin();
      onFinalize({ translationX: 2, translationY: 2 });
    });

    expect(getLatestShowPictureProps().showModal).toBe(true);
  });

  it('in non-e2e mode, does not open the modal when the target is dragged past the tap threshold', async () => {
    setE2EMode(false);

    await renderToPicture();

    const record = mockCapturedGestureCallbacks;
    const onBegin = record.calls.find((c) => c.method === 'onBegin').args[0];
    const onUpdate = record.calls.find((c) => c.method === 'onUpdate').args[0];
    const onFinalize = record.calls.find((c) => c.method === 'onFinalize').args[0];

    await act(async () => {
      onBegin();
      onUpdate({ translationX: 30, translationY: 0 });
      onFinalize({ translationX: 30, translationY: 0 });
    });

    expect(getLatestShowPictureProps().showModal).toBe(false);
  });

  it('in non-e2e mode, does not move the target when the picture surface is tapped', async () => {
    setE2EMode(false);

    await renderToPicture();

    const before = getLatestShowPictureProps();

    await act(async () => {
      getLatestShowPictureProps().handlePress({ nativeEvent: { locationX: 10, locationY: 10 } });
    });

    const after = getLatestShowPictureProps();
    expect(after.touchLocation).toEqual(before.touchLocation);
    expect(after.target).toEqual(before.target);
    expect(after.touchLocation).toEqual({ x: '0.50', y: '0.50' });
  });

  it('in e2e mode, starts with no target and places it at the deterministic hide location on a surface tap', async () => {
    await renderToPicture();

    const initialProps = getLatestShowPictureProps();
    expect(initialProps.touchLocation).toBeNull();
    expect(initialProps.target).toBeNull();
    expect(initialProps.targetGesture).toBeUndefined();

    await act(async () => {
      getLatestShowPictureProps().handlePress();
    });

    const pictureProps = getLatestShowPictureProps();
    expect(pictureProps.touchLocation).toEqual({ x: '0.58', y: '0.46' });
    expect(pictureProps.target.targetSize).toBe(16);
    expect(pictureProps.target.targetStyle.left).toBeCloseTo(108);
    expect(pictureProps.target.targetStyle.top).toBeCloseTo(38);
  });

  it('passes defaultOpen={false} to ShowPicture on a first-card route (skipInstructions falsy)', async () => {
    await renderToPicture();
    expect(getLatestShowPictureProps().defaultOpen).toBe(false);
  });

  it('passes defaultOpen={true} to ShowPicture on a second-card route (skipInstructions=true)', async () => {
    await act(async () => {
      create(<GuessPicture {...baseProps} skipInstructions={true} />);
    });

    expect(getLatestShowPictureProps().defaultOpen).toBe(true);
  });

  it('skipInstructions flips true after mount → overlay hides reactively (ShowPicture renders)', async () => {
    setE2EMode(false);
    let renderer;
    await act(async () => {
      renderer = create(<GuessPicture {...baseProps} skipInstructions={false} />);
    });
    activeRenderers.push(renderer);

    expect(mockShowPicture).not.toHaveBeenCalled();
    expect(mockGameInstructions).toHaveBeenCalled();

    await act(async () => {
      renderer.update(<GuessPicture {...baseProps} skipInstructions={true} />);
    });

    expect(mockShowPicture).toHaveBeenCalled();
  });

  describe('PB2 disabled prop (input gating)', () => {
    // PB2: when disabled=true is passed (advance state machine mid-cycle),
    // useTargetDrag is constructed with enabled=false → panHandlers undefined
    // → ShowPicture receives no targetPanHandlers → tap/drag cannot move the
    // target or open the confirm modal during a resolve. Pre-fix, the prop
    // was silently dropped (omitted from GuessPictureProps), so the screen's
    // `disabled={advance.state !== 'idle'}` had no effect.

    it('disabled=true → useTargetDrag enabled=false → ShowPicture receives no targetGesture', async () => {
      setE2EMode(false);
      await renderToPicture({ disabled: true });

      expect(getLatestShowPictureProps().targetGesture).toBeUndefined();
    });

    it('disabled=false (default) → useTargetDrag enabled=true → ShowPicture receives targetGesture', async () => {
      setE2EMode(false);
      await renderToPicture();

      expect(getLatestShowPictureProps().targetGesture).toBeTruthy();
    });

    it('disabled=true + e2e mode → still no targetGesture (e2e path keeps its own surface-tap wiring)', async () => {
      setE2EMode(true);
      await renderToPicture({ disabled: true });

      expect(getLatestShowPictureProps().targetGesture).toBeUndefined();
    });
  });

  it('uses a deterministic incorrect location on long press in e2e mode', async () => {
    const toAdScreen = jest.fn();

    await act(async () => {
      create(
        <GuessPicture
          {...baseProps}
          toAdScreen={toAdScreen}
        />
      );
    });

    await act(async () => {
      const instructionsProps = mockGameInstructions.mock.calls[mockGameInstructions.mock.calls.length - 1][0];
      instructionsProps.handleFilterClick();
    });

    await act(async () => {
      getLatestShowPictureProps().handleLongPress();
    });

    const afterLongPress = getLatestShowPictureProps();
    expect(afterLongPress.touchLocation).toEqual({ x: '0.18', y: '0.18' });
    expect(afterLongPress.target.targetSize).toBe(16);
    expect(afterLongPress.target.targetStyle.left).toBeCloseTo(28);
    expect(afterLongPress.target.targetStyle.top).toBeCloseTo(10);

    await act(async () => {
      getLatestShowPictureProps().handleConfirm();
    });

    expect(getLatestShowPictureProps().showModal).toBe(false);

    expect(toAdScreen).toHaveBeenCalledTimes(1);
    expect(toAdScreen).toHaveBeenCalledWith({
      location: { x: '0.18', y: '0.18' },
      hiddenLocation: { x: 0.58, y: 0.46 },
      screenWidth: 320,
      screenHeight: 640,
      target: expect.objectContaining({
        targetSize: 16,
        targetStyle: expect.objectContaining({ left: expect.closeTo(28), top: expect.closeTo(10) }),
      }),
      elapsedMs: 0,
    });
  });

  describe('speed timer', () => {
    it('in e2e mode does not start a real interval and ships elapsedMs=0', async () => {
      const toAdScreen = jest.fn();
      await renderToPicture({ toAdScreen });

      await act(async () => {
        getLatestShowPictureProps().handleConfirm();
      });

      expect(toAdScreen).toHaveBeenCalledWith(expect.objectContaining({ elapsedMs: 0 }));
    });

    it('in non-e2e mode starts the timer on instructions dismiss', () => {
      setE2EMode(false);
      const toAdScreen = jest.fn();
      jest.useFakeTimers();
      try {
        act(() => {
          activeRenderers.push(create(<GuessPicture {...baseProps} toAdScreen={toAdScreen} />));
        });
        act(() => {
          const instructionsProps = mockGameInstructions.mock.calls[mockGameInstructions.mock.calls.length - 1][0];
          instructionsProps.handleFilterClick();
        });
        act(() => {
          jest.advanceTimersByTime(600);
        });
        act(() => {
          const record = mockCapturedGestureCallbacks;
          const onBegin = record.calls.find((c) => c.method === 'onBegin').args[0];
          const onFinalize = record.calls.find((c) => c.method === 'onFinalize').args[0];
          onBegin();
          onFinalize({ translationX: 2, translationY: 2 });
        });
        act(() => {
          getLatestShowPictureProps().handleConfirm();
        });

        expect(toAdScreen).toHaveBeenCalledWith(expect.objectContaining({ elapsedMs: expect.any(Number) }));
        const payload = toAdScreen.mock.calls[0][0];
        expect(typeof payload.elapsedMs).toBe('number');
        expect(payload.elapsedMs).toBeGreaterThanOrEqual(0);
      } finally {
        jest.useRealTimers();
      }
    });

    it('cleans up the interval on unmount without warnings', () => {
      setE2EMode(false);
      let renderer;
      jest.useFakeTimers();
      try {
        act(() => {
          renderer = create(<GuessPicture {...baseProps} />);
        });
        act(() => {
          const instructionsProps = mockGameInstructions.mock.calls[mockGameInstructions.mock.calls.length - 1][0];
          instructionsProps.handleFilterClick();
        });
        act(() => {
          jest.advanceTimersByTime(300);
        });
        expect(() => {
          act(() => {
            renderer.unmount();
          });
        }).not.toThrow();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('reading grace', () => {
    beforeEach(() => {
      setE2EMode(false);
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('on a first card (skipInstructions falsy) skips the grace: ring is active right after instructions dismiss', () => {
      act(() => {
        activeRenderers.push(create(<GuessPicture {...baseProps} />));
      });
      act(() => {
        const instructionsProps = mockGameInstructions.mock.calls[mockGameInstructions.mock.calls.length - 1][0];
        instructionsProps.handleFilterClick();
      });

      expect(getLatestShowPictureProps().speedRingActive).toBe(true);
    });

    it('on a second card (skipInstructions=true) the ring is inactive during the grace window', () => {
      act(() => {
        activeRenderers.push(create(<GuessPicture {...baseProps} skipInstructions={true} />));
      });

      expect(getLatestShowPictureProps().speedRingActive).toBe(false);

      act(() => {
        jest.advanceTimersByTime(2999);
      });

      expect(getLatestShowPictureProps().speedRingActive).toBe(false);
    });

    it('on a second card, the ring activates once the grace window elapses', () => {
      act(() => {
        activeRenderers.push(create(<GuessPicture {...baseProps} skipInstructions={true} />));
      });

      expect(getLatestShowPictureProps().speedRingActive).toBe(false);

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(getLatestShowPictureProps().speedRingActive).toBe(true);
    });

    it('on a second card, closing the description ends the grace immediately', () => {
      act(() => {
        activeRenderers.push(create(<GuessPicture {...baseProps} skipInstructions={true} />));
      });

      expect(getLatestShowPictureProps().speedRingActive).toBe(false);

      act(() => {
        getLatestShowPictureProps().onDescriptionClosed();
      });

      expect(getLatestShowPictureProps().speedRingActive).toBe(true);
    });

    it('on a second card, elapsedMs stays 0 during the grace and only advances after', () => {
      const toAdScreen = jest.fn();
      act(() => {
        activeRenderers.push(create(<GuessPicture {...baseProps} skipInstructions={true} toAdScreen={toAdScreen} />));
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(toAdScreen).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(getLatestShowPictureProps().speedRingActive).toBe(true);

      act(() => {
        const record = mockCapturedGestureCallbacks;
        const onBegin = record.calls.find((c) => c.method === 'onBegin').args[0];
        const onFinalize = record.calls.find((c) => c.method === 'onFinalize').args[0];
        onBegin();
        onFinalize({ translationX: 2, translationY: 2 });
      });
      act(() => {
        getLatestShowPictureProps().handleConfirm();
      });

      expect(toAdScreen).toHaveBeenCalledWith(expect.objectContaining({ elapsedMs: expect.any(Number) }));
      const payload = toAdScreen.mock.calls[0][0];
      expect(typeof payload.elapsedMs).toBe('number');
    });
  });
});
