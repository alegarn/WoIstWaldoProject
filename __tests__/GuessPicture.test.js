// GuessPicture behavior suite.
//
// Renders the REAL subtree (GuessPicture → GameInstructions / ShowPicture,
// EnigmaOverlay, SpeedRing, CenteredModal, real image-dimension and target math)
// and drives it through user-visible interactions: the instructions Start
// button, surface taps / long presses, the target drag recognizer, and the
// confirm-modal buttons.
//
// Only system boundaries are mocked:
// - react-native-gesture-handler (native gestures; Pan handler chains are
//   captured so tests can fire the same callbacks the native layer would)
// - @react-native-vector-icons/ionicons (native font component)
// - expo-screen-orientation (native; exercised by the real utils/orientation)
// - expo-file-system (native file IO)
// Everything else runs REAL. Assertions target rendered output: testIDs,
// resolved target geometry, the enigma overlay, the speed ring, and the
// toAdScreen payload.

// Captured Pan gestures. Tests fire the same callbacks the native gesture
// layer would invoke. Referenced lazily inside the mock factory (never during
// module evaluation).
const mockPanGestures = [];

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual('react');

  function makePan() {
    const gesture = {};
    mockPanGestures.push(gesture);
    gesture.activeOffsetX = () => gesture;
    gesture.activeOffsetY = () => gesture;
    gesture.failOffsetX = () => gesture;
    gesture.failOffsetY = () => gesture;
    gesture.enabled = () => gesture;
    gesture.onStart = (cb) => {
      gesture.onStartHandler = cb;
      return gesture;
    };
    gesture.onBegin = (cb) => {
      gesture.onBeginHandler = cb;
      return gesture;
    };
    gesture.onUpdate = (cb) => {
      gesture.onUpdateHandler = cb;
      return gesture;
    };
    gesture.onEnd = (cb) => {
      gesture.onEndHandler = cb;
      return gesture;
    };
    gesture.onFinalize = (cb) => {
      gesture.onFinalizeHandler = cb;
      return gesture;
    };
    return gesture;
  }

  return {
    Gesture: { Pan: makePan },
    GestureDetector: ({ children }) => React.createElement(React.Fragment, null, children),
    GestureHandlerRootView: ({ children }) => React.createElement(React.Fragment, null, children),
  };
});

jest.mock('@react-native-vector-icons/ionicons', () => ({
  __esModule: true,
  default: () => null,
  Ionicons: () => null,
}));

jest.mock('expo-screen-orientation', () => ({
  getOrientationAsync: jest.fn().mockResolvedValue(3),
  getOrientationLockAsync: jest.fn().mockResolvedValue('PORTRAIT_UP'),
  lockAsync: jest.fn().mockResolvedValue(undefined),
  OrientationLock: {
    PORTRAIT_UP: 'PORTRAIT_UP',
    PORTRAIT_DOWN: 'PORTRAIT_DOWN',
    LANDSCAPE_LEFT: 'LANDSCAPE_LEFT',
    LANDSCAPE_RIGHT: 'LANDSCAPE_RIGHT',
  },
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
import { act, fireEvent, render } from '@testing-library/react-native';

import GuessPicture from '../components/Picture/GuessPicture';
import { getE2EShapeOutline } from '../utils/e2eMode';

// Real setImageDimensions (landscape 640×480 onto a 320×640 screen) resolves
// the picture surface to 320×240; the target is min(w,h) * 0.05 = 16 and its
// drag ring is twice that.
const IMAGE_WIDTH = 320;
const IMAGE_HEIGHT = 240;
const TARGET_SIZE = 16;
const DRAG_SIZE = TARGET_SIZE * 2;

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
    imageHeight: 480,
    imageWidth: 640,
    hiddenLocation: { x: 0.58, y: 0.46 },
    screenDimensions: { width: 320, height: 640 },
    toAdScreen: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setE2EMode(true);
    mockPanGestures.length = 0;
  });

  // The target drag recognizer is the only captured Pan that registers
  // onFinalize (ShowPicture's surface swipe registers onEnd).
  function findTargetPan() {
    return [...mockPanGestures].reverse().find((g) => g.onFinalizeHandler);
  }

  // The ShapeCanvas draw recognizer is the only captured Pan that registers
  // onStart (point target registers onBegin, surface swipe only onEnd).
  function findShapePan() {
    return [...mockPanGestures].reverse().find((g) => g.onStartHandler);
  }

  // Fires the ShapeCanvas draw recognizer the way the native Pan layer would:
  // an absolute start point inside the image rect, updates through the
  // remaining vertices, then end (finalizes the stroke).
  async function fireShapePan(vertices) {
    const pan = findShapePan();
    if (!pan) {
      throw new Error('no shape draw Pan gesture is attached to the rendered surface');
    }
    await act(async () => {
      pan.onStartHandler({ x: vertices[0].x, y: vertices[0].y });
      for (const vertex of vertices.slice(1)) {
        pan.onUpdateHandler({ x: vertex.x, y: vertex.y });
      }
      pan.onEndHandler({}, true);
    });
  }

  async function fireTargetPan(handlers) {
    const pan = findTargetPan();
    if (!pan) {
      throw new Error('no target Pan gesture is attached to the rendered target');
    }
    await act(async () => {
      if (handlers.begin) pan.onBeginHandler();
      if (handlers.update) pan.onUpdateHandler(handlers.update);
      if (handlers.finalize) pan.onFinalizeHandler(handlers.finalize);
    });
  }

  // Ring around the target: the drag style built from the target's pixel
  // location (centered on it). Animated flattens the style array it is given.
  function targetRingStyle(screen) {
    const style = screen.getByTestId('game.picture.guess-target-wrap').props.style;
    return Array.isArray(style) ? style[0] : style;
  }

  function ringCenter(ring) {
    return { x: ring.left + ring.width / 2, y: ring.top + ring.height / 2 };
  }

  function confirmModalQuery(screen) {
    return screen.queryByTestId('game.picture.guess-modal.confirm');
  }

  async function renderToPicture(overrides = {}) {
    const screen = render(<GuessPicture {...baseProps} {...overrides} />);
    fireEvent.press(screen.getByTestId('game.instructions.guess.start'));
    return screen;
  }

  it('in non-e2e mode, places the target at the picture center on mount', async () => {
    setE2EMode(false);

    const screen = await renderToPicture();

    const ring = targetRingStyle(screen);
    expect(ring.width).toBe(DRAG_SIZE);
    expect(ring.height).toBe(DRAG_SIZE);
    expect(ringCenter(ring)).toEqual({ x: IMAGE_WIDTH / 2, y: IMAGE_HEIGHT / 2 });
  });

  it('in non-e2e mode, dragging the target moves it across the picture', async () => {
    setE2EMode(false);

    const screen = await renderToPicture();

    await fireTargetPan({ begin: true, update: { translationX: 10, translationY: 0 } });

    const ring = targetRingStyle(screen);
    expect(ringCenter(ring)).toEqual({ x: IMAGE_WIDTH / 2 + 10, y: IMAGE_HEIGHT / 2 });
  });

  it('in non-e2e mode, ships the dragged location to toAdScreen on confirm', async () => {
    setE2EMode(false);
    const toAdScreen = jest.fn();

    const screen = await renderToPicture({ toAdScreen });

    await fireTargetPan({ begin: true, update: { translationX: 10, translationY: 0 } });
    await fireTargetPan({ begin: true, finalize: { translationX: 2, translationY: 2 } });
    fireEvent.press(screen.getByTestId('game.picture.guess-modal.confirm'));

    expect(toAdScreen).toHaveBeenCalledTimes(1);
    expect(toAdScreen).toHaveBeenCalledWith({
      location: { x: '0.53', y: '0.50' },
      hiddenLocation: { x: 0.58, y: 0.46 },
      screenWidth: 320,
      screenHeight: 640,
      target: expect.objectContaining({
        targetSize: TARGET_SIZE,
        targetStyle: expect.objectContaining({ left: 162, top: 112 }),
      }),
      elapsedMs: expect.any(Number),
    });
  });

  it('in non-e2e mode, opens the confirm modal when the target is tapped without dragging', async () => {
    setE2EMode(false);

    const screen = await renderToPicture();

    expect(confirmModalQuery(screen)).toBeNull();

    await fireTargetPan({ begin: true, finalize: { translationX: 2, translationY: 2 } });

    expect(confirmModalQuery(screen)).not.toBeNull();
  });

  it('in non-e2e mode, does not open the modal when the target is dragged past the tap threshold', async () => {
    setE2EMode(false);

    const screen = await renderToPicture();

    await fireTargetPan({
      begin: true,
      update: { translationX: 30, translationY: 0 },
      finalize: { translationX: 30, translationY: 0 },
    });

    expect(confirmModalQuery(screen)).toBeNull();
  });

  it('in non-e2e mode, does not move the target when the picture surface is tapped', async () => {
    setE2EMode(false);

    const screen = await renderToPicture();

    const before = targetRingStyle(screen);

    fireEvent.press(screen.getByTestId('game.picture.guess-surface'));

    const after = targetRingStyle(screen);
    expect(ringCenter(after)).toEqual(ringCenter(before));
    expect(ringCenter(after)).toEqual({ x: IMAGE_WIDTH / 2, y: IMAGE_HEIGHT / 2 });
  });

  it('in e2e mode, starts with no target and places it at the deterministic hide location on a surface tap', async () => {
    const screen = await renderToPicture();

    expect(screen.queryByTestId('game.picture.guess-target-wrap')).toBeNull();
    expect(confirmModalQuery(screen)).toBeNull();

    fireEvent.press(screen.getByTestId('game.picture.guess-surface'));

    const ring = targetRingStyle(screen);
    expect(ring.width).toBe(DRAG_SIZE);
    expect(ringCenter(ring).x).toBeCloseTo(0.58 * IMAGE_WIDTH);
    expect(ringCenter(ring).y).toBeCloseTo(0.46 * IMAGE_HEIGHT);
  });

  it('keeps the description overlay closed on a first card (skipInstructions falsy)', async () => {
    const screen = await renderToPicture();

    expect(screen.queryByTestId('guess.enigma.panel')).toBeNull();
  });

  it('opens the description overlay immediately on a second card (skipInstructions=true)', async () => {
    const screen = render(<GuessPicture {...baseProps} skipInstructions={true} />);

    expect(screen.getByTestId('guess.enigma.panel')).toBeTruthy();
    expect(screen.getByText('Find the hidden point')).toBeTruthy();
  });

  it('flipping skipInstructions to true after mount swaps the instructions for the picture reactively', async () => {
    setE2EMode(false);
    const screen = render(<GuessPicture {...baseProps} skipInstructions={false} />);

    expect(screen.queryByTestId('game.instructions.guess.start')).not.toBeNull();
    expect(screen.queryByTestId('game.picture.guess-image')).toBeNull();

    screen.rerender(<GuessPicture {...baseProps} skipInstructions={true} />);

    expect(screen.queryByTestId('game.instructions.guess.start')).toBeNull();
    expect(screen.queryByTestId('game.picture.guess-image')).not.toBeNull();
  });

  describe('PB2 disabled prop (input gating)', () => {
    it('with disabled=true no drag recognizer is attached to the target and the confirm modal stays closed', async () => {
      setE2EMode(false);

      const screen = await renderToPicture({ disabled: true });

      expect(targetRingStyle(screen)).toBeTruthy();
      expect(findTargetPan()).toBeUndefined();
      expect(confirmModalQuery(screen)).toBeNull();
    });

    it('with disabled=false (default) tapping the attached target recognizer opens the confirm modal', async () => {
      setE2EMode(false);

      const screen = await renderToPicture();

      expect(findTargetPan()).toBeDefined();
      await fireTargetPan({ begin: true, finalize: { translationX: 2, translationY: 2 } });

      expect(confirmModalQuery(screen)).not.toBeNull();
    });

    it('with disabled=true in e2e mode, surface taps still place the target', async () => {
      setE2EMode(true);

      const screen = await renderToPicture({ disabled: true });

      expect(findTargetPan()).toBeUndefined();

      fireEvent.press(screen.getByTestId('game.picture.guess-surface'));

      expect(targetRingStyle(screen)).toBeTruthy();
      expect(ringCenter(targetRingStyle(screen)).x).toBeCloseTo(0.58 * IMAGE_WIDTH);
    });
  });

  it('uses a deterministic incorrect location on long press in e2e mode', async () => {
    const toAdScreen = jest.fn();

    const screen = await renderToPicture({ toAdScreen });

    fireEvent(screen.getByTestId('game.picture.guess-surface'), 'longPress');

    const ring = targetRingStyle(screen);
    expect(ringCenter(ring).x).toBeCloseTo(0.18 * IMAGE_WIDTH);
    expect(ringCenter(ring).y).toBeCloseTo(0.18 * IMAGE_HEIGHT);

    fireEvent.press(screen.getByTestId('game.picture.clear-guess'));
    fireEvent.press(screen.getByTestId('game.picture.guess-modal.confirm'));

    expect(confirmModalQuery(screen)).toBeNull();

    expect(toAdScreen).toHaveBeenCalledTimes(1);
    expect(toAdScreen).toHaveBeenCalledWith({
      location: { x: '0.18', y: '0.18' },
      hiddenLocation: { x: 0.58, y: 0.46 },
      screenWidth: 320,
      screenHeight: 640,
      target: expect.objectContaining({
        targetSize: TARGET_SIZE,
        targetStyle: expect.objectContaining({ left: expect.closeTo(49.6), top: expect.closeTo(35.2) }),
      }),
      elapsedMs: 0,
    });
  });

  describe('speed timer', () => {
    it('in e2e mode does not start a real interval and ships elapsedMs=0', async () => {
      const toAdScreen = jest.fn();
      const screen = await renderToPicture({ toAdScreen });

      fireEvent.press(screen.getByTestId('game.picture.guess-surface'));
      fireEvent.press(screen.getByTestId('game.picture.clear-guess'));
      fireEvent.press(screen.getByTestId('game.picture.guess-modal.confirm'));

      expect(toAdScreen).toHaveBeenCalledWith(expect.objectContaining({ elapsedMs: 0 }));
    });

    it('in non-e2e mode starts the timer on instructions dismiss', async () => {
      setE2EMode(false);
      const toAdScreen = jest.fn();
      jest.useFakeTimers();
      try {
        const screen = render(<GuessPicture {...baseProps} toAdScreen={toAdScreen} />);
        fireEvent.press(screen.getByTestId('game.instructions.guess.start'));
        await act(async () => {
          jest.advanceTimersByTime(600);
        });
        await fireTargetPan({ begin: true, finalize: { translationX: 2, translationY: 2 } });
        fireEvent.press(screen.getByTestId('game.picture.guess-modal.confirm'));

        expect(toAdScreen).toHaveBeenCalledWith(expect.objectContaining({ elapsedMs: expect.any(Number) }));
        const payload = toAdScreen.mock.calls[0][0];
        expect(typeof payload.elapsedMs).toBe('number');
        expect(payload.elapsedMs).toBeGreaterThanOrEqual(0);
      } finally {
        jest.useRealTimers();
      }
    });

    it('cleans up the interval on unmount without warnings', async () => {
      setE2EMode(false);
      jest.useFakeTimers();
      try {
        const screen = render(<GuessPicture {...baseProps} />);
        fireEvent.press(screen.getByTestId('game.instructions.guess.start'));
        await act(async () => {
          jest.advanceTimersByTime(300);
        });
        expect(() => screen.unmount()).not.toThrow();
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

    function speedRingQuery(screen) {
      return screen.queryByTestId('guess.speed-ring');
    }

    it('on a first card (skipInstructions falsy) skips the grace: ring is active right after instructions dismiss', () => {
      const screen = render(<GuessPicture {...baseProps} />);
      fireEvent.press(screen.getByTestId('game.instructions.guess.start'));

      expect(speedRingQuery(screen)).not.toBeNull();
    });

    it('on a second card (skipInstructions=true) the ring is inactive during the grace window', () => {
      const screen = render(<GuessPicture {...baseProps} skipInstructions={true} />);

      expect(speedRingQuery(screen)).toBeNull();

      act(() => {
        jest.advanceTimersByTime(2999);
      });

      expect(speedRingQuery(screen)).toBeNull();
    });

    it('on a second card, the ring activates once the grace window elapses', () => {
      const screen = render(<GuessPicture {...baseProps} skipInstructions={true} />);

      expect(speedRingQuery(screen)).toBeNull();

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(speedRingQuery(screen)).not.toBeNull();
    });

    it('on a second card, closing the description ends the grace immediately', () => {
      const screen = render(<GuessPicture {...baseProps} skipInstructions={true} />);

      expect(speedRingQuery(screen)).toBeNull();

      fireEvent.press(screen.getByTestId('guess.enigma.close'));

      expect(speedRingQuery(screen)).not.toBeNull();
    });

    it('on a second card, elapsedMs stays 0 during the grace and only advances after', async () => {
      const toAdScreen = jest.fn();
      const screen = render(
        <GuessPicture {...baseProps} skipInstructions={true} toAdScreen={toAdScreen} />
      );

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(toAdScreen).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(speedRingQuery(screen)).not.toBeNull();

      await fireTargetPan({ begin: true, finalize: { translationX: 2, translationY: 2 } });
      fireEvent.press(screen.getByTestId('game.picture.guess-modal.confirm'));

      expect(toAdScreen).toHaveBeenCalledWith(expect.objectContaining({ elapsedMs: expect.any(Number) }));
      const payload = toAdScreen.mock.calls[0][0];
      expect(typeof payload.elapsedMs).toBe('number');
    });
  });

  describe('shape mode (guess)', () => {
    // Hidden shape shipped on shape cards (normalized [0,1], closed).
    const HIDDEN_SHAPE = [
      { x: 0.5, y: 0.3 },
      { x: 0.7, y: 0.5 },
      { x: 0.5, y: 0.7 },
      { x: 0.3, y: 0.5 },
      { x: 0.5, y: 0.3 },
    ];
    // Landscape 640×480 image on the 320×640 screen renders a 320×240 surface,
    // so this triangle normalizes to (0.1,0.1) → (0.9,0.1) → (0.5,0.9) (+ auto-close).
    const STROKE_VERTICES = [{ x: 32, y: 24 }, { x: 288, y: 24 }, { x: 160, y: 216 }];
    const NORMALIZED_STROKE = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.5, y: 0.9 },
      { x: 0.1, y: 0.1 },
    ];

    it('renders the draw surface instead of the point target', async () => {
      setE2EMode(false);

      const screen = await renderToPicture({ mode: 'shape', shape: HIDDEN_SHAPE });

      expect(screen.queryByTestId('game.picture.guess-target-wrap')).toBeNull();
      expect(screen.queryByTestId('game.picture.clear-guess')).toBeNull();
      expect(screen.queryByTestId('game.picture.shape-surface')).not.toBeNull();
    });

    it('ships the normalized drawn outline to toAdScreen on confirm', async () => {
      setE2EMode(false);
      const toAdScreen = jest.fn();

      const screen = await renderToPicture({ mode: 'shape', shape: HIDDEN_SHAPE, toAdScreen });

      expect(confirmModalQuery(screen)).toBeNull();

      await fireShapePan(STROKE_VERTICES);

      expect(confirmModalQuery(screen)).not.toBeNull();

      fireEvent.press(screen.getByTestId('game.picture.guess-modal.confirm'));

      expect(toAdScreen).toHaveBeenCalledTimes(1);
      expect(toAdScreen).toHaveBeenCalledWith({
        location: null,
        hiddenLocation: { x: 0.58, y: 0.46 },
        screenWidth: 320,
        screenHeight: 640,
        target: null,
        elapsedMs: 0,
        mode: 'shape',
        shape: NORMALIZED_STROKE,
      });
    });

    it('in e2e mode a surface tap seeds the hit outline and confirm ships it', async () => {
      const toAdScreen = jest.fn();

      const screen = await renderToPicture({ mode: 'shape', shape: HIDDEN_SHAPE, toAdScreen });

      fireEvent.press(screen.getByTestId('game.picture.guess-surface'));

      expect(confirmModalQuery(screen)).not.toBeNull();

      fireEvent.press(screen.getByTestId('game.picture.guess-modal.confirm'));

      expect(toAdScreen).toHaveBeenCalledTimes(1);
      expect(toAdScreen).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'shape',
        shape: getE2EShapeOutline('hit'),
      }));
    });

    it('in e2e mode a surface long press seeds the miss outline', async () => {
      const toAdScreen = jest.fn();

      const screen = await renderToPicture({ mode: 'shape', shape: HIDDEN_SHAPE, toAdScreen });

      fireEvent(screen.getByTestId('game.picture.guess-surface'), 'longPress');

      expect(confirmModalQuery(screen)).not.toBeNull();

      fireEvent.press(screen.getByTestId('game.picture.guess-modal.confirm'));

      expect(toAdScreen).toHaveBeenCalledTimes(1);
      expect(toAdScreen).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'shape',
        shape: getE2EShapeOutline('miss'),
      }));
    });

    it('renders explicit enigma and exit controls; exit fires onEdgeSwipe', async () => {
      setE2EMode(false);
      const onEdgeSwipe = jest.fn();

      const screen = await renderToPicture({ mode: 'shape', shape: HIDDEN_SHAPE, onEdgeSwipe });

      expect(screen.queryByTestId('game.picture.shape-enigma')).not.toBeNull();
      expect(screen.queryByTestId('game.picture.shape-exit')).not.toBeNull();
      expect(screen.queryByTestId('guess.enigma.panel')).toBeNull();

      fireEvent.press(screen.getByTestId('game.picture.shape-exit'));

      expect(onEdgeSwipe).toHaveBeenCalledTimes(1);
    });

    it('re-opens the enigma from the explicit control after closing it', async () => {
      setE2EMode(false);

      // skipInstructions=true renders the picture directly (no Start button).
      const screen = render(
        <GuessPicture {...baseProps} mode="shape" shape={HIDDEN_SHAPE} skipInstructions={true} />
      );

      expect(screen.getByTestId('guess.enigma.panel')).toBeTruthy();

      fireEvent.press(screen.getByTestId('guess.enigma.close'));
      expect(screen.queryByTestId('guess.enigma.panel')).toBeNull();

      fireEvent.press(screen.getByTestId('game.picture.shape-enigma'));

      expect(screen.getByTestId('guess.enigma.panel')).toBeTruthy();
    });

    it('renders no shape enigma/exit controls in point mode', async () => {
      setE2EMode(false);

      const screen = await renderToPicture();

      expect(screen.queryByTestId('game.picture.shape-enigma')).toBeNull();
      expect(screen.queryByTestId('game.picture.shape-exit')).toBeNull();
      expect(screen.queryByTestId('game.picture.shape-surface')).toBeNull();
    });
  });
});
