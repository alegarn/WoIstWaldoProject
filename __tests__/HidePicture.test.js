// HidePicture behavior suite.
//
// Renders the REAL subtree (HidePicture → GameInstructions / ShowPicture /
// ShapeCanvas / CenteredModal, real image-dimension and outline math) and
// drives it through user-visible interactions: the instructions Start button,
// the mode chips, the ShapeCanvas draw recognizer, the surface tap, and the
// confirm-modal buttons.
//
// Only system boundaries are mocked:
// - react-native-gesture-handler (native gestures; Pan handler chains are
//   captured so tests can fire the same callbacks the native layer would)
// - @react-native-vector-icons/ionicons (native font component)
// - expo-screen-orientation (native; exercised by the real utils/orientation)
// Everything else runs REAL. Assertions target rendered output: testIDs and
// the SetInstructions navigation payload.

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

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import HidePicture from '../components/Picture/HidePicture';
import { E2E_SHAPE_POLYGON } from '../utils/e2eMode';

// Landscape 640×480 image on a 320×640 screen resolves the picture surface to
// 320×240, so this triangle normalizes to (0.1,0.1) → (0.9,0.1) → (0.5,0.9)
// (+ auto-close) — the same drawable stroke the guess side pins.
const STROKE_VERTICES = [{ x: 32, y: 24 }, { x: 288, y: 24 }, { x: 160, y: 216 }];
const NORMALIZED_STROKE = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.5, y: 0.9 },
  { x: 0.1, y: 0.1 },
];

function setE2EMode(enabled) {
  process.env.EXPO_PUBLIC_E2E_MODE = enabled ? 'true' : 'false';
}

describe('HidePicture', () => {
  const originalE2EEnv = process.env.EXPO_PUBLIC_E2E_MODE;

  afterAll(() => {
    if (originalE2EEnv === undefined) {
      delete process.env.EXPO_PUBLIC_E2E_MODE;
    } else {
      process.env.EXPO_PUBLIC_E2E_MODE = originalE2EEnv;
    }
  });

  const baseProps = {
    navigation: { navigate: jest.fn() },
    uri: 'file:///hide.jpg',
    imageIsPortrait: false,
    imageWidth: 640,
    imageHeight: 480,
    screenDimensions: { width: 320, height: 640 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setE2EMode(false);
    mockPanGestures.length = 0;
  });

  // The ShapeCanvas draw recognizer is the only captured Pan that registers
  // onStart.
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

  async function renderToPicture(overrides = {}) {
    const screen = render(<HidePicture {...baseProps} {...overrides} />);
    fireEvent.press(screen.getByTestId('game.instructions.hide.start'));
    return screen;
  }

  function confirmModalQuery(screen) {
    return screen.queryByTestId('game.picture.hide-modal.confirm');
  }

  it('renders the mode picker with point selected by default', async () => {
    const screen = await renderToPicture();

    expect(screen.queryByTestId('game.picture.mode-picker')).not.toBeNull();
    expect(screen.queryByTestId('game.picture.mode-chip-shape')).not.toBeNull();
    expect(screen.queryByTestId('game.picture.shape-surface')).toBeNull();
  });

  describe('shape mode (hide)', () => {
    it('auto-opens the confirm modal when a drawable outline is drawn', async () => {
      const screen = await renderToPicture();

      fireEvent.press(screen.getByTestId('game.picture.mode-chip-shape'));
      expect(screen.queryByTestId('game.picture.shape-surface')).not.toBeNull();
      expect(confirmModalQuery(screen)).toBeNull();

      await fireShapePan(STROKE_VERTICES);

      expect(screen.queryByTestId('game.picture.shape-outline')).not.toBeNull();
      expect(confirmModalQuery(screen)).not.toBeNull();

      fireEvent.press(screen.getByTestId('game.picture.hide-modal.confirm'));

      expect(baseProps.navigation.navigate).toHaveBeenCalledTimes(1);
      expect(baseProps.navigation.navigate).toHaveBeenCalledWith('SetInstructions', expect.objectContaining({
        mode: 'shape',
        shape: NORMALIZED_STROKE,
      }));
    });

    it('does not open the confirm modal on a degenerate stroke', async () => {
      const screen = await renderToPicture();

      fireEvent.press(screen.getByTestId('game.picture.mode-chip-shape'));

      await fireShapePan([{ x: 32, y: 24 }, { x: 33, y: 25 }]);

      expect(screen.queryByTestId('game.picture.shape-outline')).toBeNull();
      expect(confirmModalQuery(screen)).toBeNull();
    });

    it('in e2e mode, picking the shape chip seeds the outline and auto-opens the confirm modal', async () => {
      setE2EMode(true);
      const screen = await renderToPicture();

      expect(confirmModalQuery(screen)).toBeNull();

      fireEvent.press(screen.getByTestId('game.picture.mode-chip-shape'));

      expect(screen.queryByTestId('game.picture.shape-outline')).not.toBeNull();
      expect(confirmModalQuery(screen)).not.toBeNull();

      fireEvent.press(screen.getByTestId('game.picture.hide-modal.confirm'));

      expect(baseProps.navigation.navigate).toHaveBeenCalledWith('SetInstructions', expect.objectContaining({
        mode: 'shape',
        shape: E2E_SHAPE_POLYGON,
      }));
    });
  });

  describe('point mode (untouched)', () => {
    it('in e2e mode, a surface tap seeds the point but does NOT open the modal; the clear-hide icon does', async () => {
      setE2EMode(true);
      const screen = await renderToPicture();

      fireEvent.press(screen.getByTestId('game.picture.hide-surface'));

      expect(screen.queryByTestId('game.picture.clear-hide')).not.toBeNull();
      expect(confirmModalQuery(screen)).toBeNull();

      fireEvent.press(screen.getByTestId('game.picture.clear-hide'));

      expect(confirmModalQuery(screen)).not.toBeNull();
    });
  });
});
