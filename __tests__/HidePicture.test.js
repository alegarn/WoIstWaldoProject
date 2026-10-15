// HidePicture behavior suite.
//
// Renders the REAL subtree (HidePicture → GameInstructions / ShowPicture /
// RetractableSidebar / ShapeCanvas / CenteredModal, real image-dimension and
// outline math) and drives it through user-visible interactions: the
// instructions Start button, the mode chips, the ShapeCanvas draw recognizer,
// the sidebar retract pan, the surface tap, and the confirm-modal buttons.
//
// Only system boundaries are mocked:
// - react-native Animated (timing applied synchronously so sidebar
//   translateX.__getValue() is deterministic without timers)
// - react-native-gesture-handler (native gestures; Pan chains are captured as
//   Proxy arg-recording records so tests can fire the same callbacks the
//   native layer would AND assert config args like failOffsetY)
// - @react-native-vector-icons/ionicons (native font component)
// - expo-screen-orientation (native; exercised by the real utils/orientation)
// Everything else runs REAL. Assertions target rendered output: testIDs and
// the SetInstructions navigation payload.

const mockPanRecords = [];

jest.mock('react-native', () => {
  const actualRN = jest.requireActual('react-native');
  actualRN.Animated.timing = (value, config) => ({
    start: (callback) => {
      if (typeof config?.toValue !== 'undefined' && value?.setValue) {
        value.setValue(config.toValue);
      }
      callback?.();
    },
  });
  // Start the pulse child once; never re-iterate (a sync timing would make a
  // real loop recurse infinitely).
  actualRN.Animated.loop = (animation) => ({
    start: (callback) => animation?.start?.(callback),
    stop: () => animation?.stop?.(),
    reset: () => animation?.reset?.(),
  });
  return actualRN;
});

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual('react');

  function makeChainablePan() {
    const record = { __type: 'pan', calls: [] };
    const handler = {
      get(_target, prop) {
        if (prop === '__type' || prop === 'calls') return record[prop];
        if (prop === 'then') return undefined;
        return (...args) => {
          record.calls.push({ method: prop, args });
          return proxy;
        };
      },
    };
    const proxy = new Proxy(record, handler);
    mockPanRecords.push(record);
    return proxy;
  }

  return {
    Gesture: { Pan: () => makeChainablePan() },
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
import { act, fireEvent, render, within } from '@testing-library/react-native';

import HidePicture from '../components/Picture/HidePicture';
import { E2E_SHAPE_POLYGON } from '../utils/e2eMode';
import { LOUPE_LONG_PRESS_MS } from '../utils/loupeGeometry';

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
    mockPanRecords.length = 0;
  });

  function panCallback(record, method) {
    const call = record?.calls.find((c) => c.method === method);
    if (!call) {
      throw new Error(`pan never registered ${method}`);
    }
    return call.args[0];
  }

  // D4 discrimination: the sidebar Pan is the only captured Pan that chains
  // failOffsetY([-40, 40]) (bidirectional array) — the ShowPicture surface
  // classifier chains failOffsetY(10) (scalar).
  function findSidebarPan() {
    return mockPanRecords.find((record) =>
      record.calls.some(
        (c) =>
          c.method === 'failOffsetY' &&
          Array.isArray(c.args[0]) &&
          c.args[0][0] === -40 &&
          c.args[0][1] === 40
      )
    );
  }

  // The ShapeCanvas draw recognizer: registers onStart WITHOUT the precision
  // long-press gate and WITHOUT any failOffsetY chain (the sidebar pan and
  // the surface classifier both chain failOffsetY and register no onStart).
  function findShapePan() {
    return [...mockPanRecords].reverse().find(
      (record) =>
        record.calls.some((c) => c.method === 'onStart') &&
        !record.calls.some((c) => c.method === 'activateAfterLongPress') &&
        !record.calls.some((c) => c.method === 'failOffsetY')
    );
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
      panCallback(pan, 'onStart')({ x: vertices[0].x, y: vertices[0].y });
      for (const vertex of vertices.slice(1)) {
        panCallback(pan, 'onUpdate')({ x: vertex.x, y: vertex.y });
      }
      panCallback(pan, 'onEnd')({}, true);
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

  it('renders the mode chips inside the retractable sidebar panel (pill removed)', async () => {
    const screen = await renderToPicture();

    const panel = screen.getByTestId('game.picture.mode-sidebar.panel');

    expect(screen.getAllByTestId('game.picture.mode-chip-point')).toHaveLength(1);
    expect(within(panel).getByTestId('game.picture.mode-picker')).not.toBeNull();
    expect(within(panel).getByTestId('game.picture.mode-chip-point')).not.toBeNull();
    expect(within(panel).getByTestId('game.picture.mode-chip-shape')).not.toBeNull();
  });

  describe('mode sidebar', () => {
    it('starts open, retracts via the sidebar pan, reopens, and keeps the selected mode', async () => {
      const screen = await renderToPicture();

      expect(screen.queryByTestId('game.picture.mode-sidebar.handle-open')).toBeNull();

      fireEvent.press(screen.getByTestId('game.picture.mode-chip-shape'));
      expect(screen.queryByTestId('game.picture.shape-surface')).not.toBeNull();

      const sidebarPan = findSidebarPan();
      expect(sidebarPan).toBeTruthy();
      await act(async () => {
        panCallback(sidebarPan, 'onEnd')({ translationX: 60, translationY: 0 }, true);
      });

      fireEvent.press(screen.getByTestId('game.picture.mode-sidebar.handle-open'));

      expect(screen.queryByTestId('game.picture.mode-sidebar.handle-open')).toBeNull();
      expect(screen.queryByTestId('game.picture.shape-surface')).not.toBeNull();

      fireEvent.press(screen.getByTestId('game.picture.mode-chip-point'));
      expect(screen.queryByTestId('game.picture.shape-surface')).toBeNull();
    });
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

  describe('point precision placement (press-hold)', () => {
    // The precision Pan is identified BY its activateAfterLongPress call —
    // the surface classifier, the ShapeCanvas draw Pan and the sidebar pan
    // never chain it.
    function findPrecisionPan() {
      return [...mockPanRecords]
        .reverse()
        .find((record) =>
          record.calls.some((c) => c.method === 'activateAfterLongPress')
        );
    }

    it('press-hold-drag-release places the point and dismisses the loupe (marker persists)', async () => {
      const screen = await renderToPicture();

      const precision = findPrecisionPan();
      expect(precision).toBeTruthy();
      expect(panCallback(precision, 'activateAfterLongPress')).toBe(LOUPE_LONG_PRESS_MS);

      await act(async () => {
        panCallback(precision, 'onBegin')({ x: 100, y: 200 });
        panCallback(precision, 'onStart')({ x: 100, y: 200 });
        panCallback(precision, 'onUpdate')({ x: 140, y: 180 });
      });

      expect(screen.queryByTestId('game.picture.loupe')).not.toBeNull();

      await act(async () => {
        panCallback(precision, 'onEnd')({ x: 140, y: 180 }, true);
      });

      expect(screen.queryByTestId('game.picture.loupe')).toBeNull();
      // The placed point persists: the precision pan payload fed the same
      // selection pipeline as a tap, so the marker (clear-hide icon) renders.
      expect(screen.queryByTestId('game.picture.clear-hide')).not.toBeNull();
      expect(confirmModalQuery(screen)).toBeNull();
    });
  });
});
